"""
routers/status.py — SSE stream for real-time resource monitoring.

Pushes JSON every 3 seconds. Each push SSHes into the target Mac and runs a
single compound command that reads CPU %, memory, swap, and pgrep results.
All SSH I/O is offloaded via async_run() to avoid blocking the event loop.
"""
import asyncio
import json
import re
from typing import AsyncGenerator

from fastapi import APIRouter
from sqlmodel import Session
from sse_starlette.sse import EventSourceResponse

from backend.database import engine, Target
from backend.executor import SSHExecutor, async_run

router = APIRouter(prefix="/api/status", tags=["status"])

# Active SSE client count per target_id — SSH polling only runs while count > 0
_active_clients: dict[int, int] = {}

# Single compound command run on the Mac every 3s.
# Sections separated by "---SMOGGLE---" sentinel so we can split reliably.
_STATS_CMD = r"""
python3 - <<'PYEOF'
import subprocess, json, re

# ── CPU (top one-shot, user+sys) ──────────────────────────────────────
try:
    top_out = subprocess.check_output(
        ["top", "-l", "1", "-n", "0", "-s", "0"], text=True, timeout=8
    )
    cpu_match = re.search(r"CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys", top_out)
    cpu_percent = float(cpu_match.group(1)) + float(cpu_match.group(2)) if cpu_match else 0.0
except Exception:
    cpu_percent = 0.0

# ── Memory (vm_stat) ──────────────────────────────────────────────────
try:
    vm = subprocess.check_output(["vm_stat"], text=True, timeout=5)
    page_size_m = re.search(r"page size of (\d+) bytes", vm)
    page_size = int(page_size_m.group(1)) if page_size_m else 16384

    def pages(label):
        m = re.search(rf"{label}:\s+(\d+)", vm)
        return int(m.group(1)) if m else 0

    free      = pages("Pages free")
    active    = pages("Pages active")
    inactive  = pages("Pages inactive")
    wired     = pages("Pages wired down")
    compressed= pages("Pages occupied by compressor")

    total_pages = free + active + inactive + wired + compressed
    used_pages  = active + wired + compressed
    memory_total_gb = round(total_pages * page_size / 1e9, 2)
    memory_used_gb  = round(used_pages  * page_size / 1e9, 2)
except Exception:
    memory_total_gb = memory_used_gb = 0.0

# ── Swap ──────────────────────────────────────────────────────────────
try:
    sysctl_out = subprocess.check_output(
        ["sysctl", "vm.swapusage"], text=True, timeout=5
    )
    used_m = re.search(r"used\s*=\s*([\d.]+)M", sysctl_out)
    swap_used_gb = round(float(used_m.group(1)) / 1024, 3) if used_m else 0.0
except Exception:
    swap_used_gb = 0.0

# ── Memory pressure breakdown ──────────────────────────────────────────
try:
    memory_active_gb    = round(active     * page_size / 1e9, 2)
    memory_wired_gb     = round(wired      * page_size / 1e9, 2)
    memory_compressed_gb= round(compressed * page_size / 1e9, 2)
    memory_inactive_gb  = round(inactive   * page_size / 1e9, 2)
    memory_free_gb      = round(free       * page_size / 1e9, 2)
except Exception:
    memory_active_gb = memory_wired_gb = memory_compressed_gb = memory_inactive_gb = memory_free_gb = 0.0

# ── CPU user/sys split ─────────────────────────────────────────────────
try:
    cpu_user = float(cpu_match.group(1)) if cpu_match else 0.0
    cpu_sys  = float(cpu_match.group(2)) if cpu_match else 0.0
    idle_m   = re.search(r"(\d+\.\d+)%\s+idle", top_out) if cpu_match else None
    cpu_idle = float(idle_m.group(1)) if idle_m else max(0.0, 100.0 - cpu_user - cpu_sys)
except Exception:
    cpu_user = cpu_sys = cpu_idle = 0.0

# ── Top processes (grouped by parent, aggregated RSS) ─────────────────
try:
    ps_out = subprocess.check_output(
        ["ps", "-Axo", "pid,ppid,pcpu,pmem,rss,comm"],
        text=True, timeout=6
    )
    raw = []
    for line in ps_out.strip().splitlines()[1:]:
        parts = line.split(None, 5)
        if len(parts) == 6:
            pid, ppid, pcpu, pmem, rss, comm = parts
            try:
                raw.append({
                    "pid":    int(pid),
                    "ppid":   int(ppid),
                    "cpu":    float(pcpu),
                    "mem":    float(pmem),
                    "rss_mb": round(int(rss) / 1024, 1),
                    "name":   comm.strip().split("/")[-1],
                })
            except (ValueError, TypeError):
                pass

    # Build pid→proc map, then group children under their parent
    by_pid = {p["pid"]: p for p in raw}
    aggregated = {}
    for p in raw:
        # Walk up to find the root app process (stop at PID 1 / launchd)
        root = p
        visited = set()
        while root["ppid"] > 1 and root["ppid"] in by_pid and root["ppid"] not in visited:
            visited.add(root["pid"])
            root = by_pid[root["ppid"]]
        key = root["pid"]
        if key not in aggregated:
            aggregated[key] = {
                "pid":       root["pid"],
                "name":      root["name"],
                "cpu":       0.0,
                "rss_mb":    0.0,
                "children":  0,
            }
        aggregated[key]["cpu"]    += p["cpu"]
        aggregated[key]["rss_mb"] += p["rss_mb"]
        if p["pid"] != key:
            aggregated[key]["children"] += 1

    top_procs = [
        {**v, "cpu": round(v["cpu"], 1), "rss_mb": round(v["rss_mb"], 1)}
        for v in aggregated.values()
        if v["rss_mb"] > 5  # filter out tiny idle daemons
    ]
    top_procs_by_rss = sorted(top_procs, key=lambda p: p["rss_mb"], reverse=True)[:12]
    top_procs_by_cpu = sorted(top_procs, key=lambda p: p["cpu"],    reverse=True)[:12]
except Exception:
    top_procs_by_rss = []
    top_procs_by_cpu = []

# ── Inference servers ─────────────────────────────────────────────────
def pgrep(pattern, exact=False):
    flag = ["-x"] if exact else ["-f"]
    try:
        out = subprocess.check_output(["pgrep"] + flag + [pattern], text=True, timeout=3)
        pids = [int(p) for p in out.strip().split() if p.isdigit()]
        return pids[0] if pids else None
    except subprocess.CalledProcessError:
        return None
    except Exception:
        return None

ollama_pid = pgrep("ollama", exact=True)
mlx_pid    = pgrep("mlx_lm.server")

result = {
    "cpu_percent":      round(cpu_percent, 1),
    "cpu_user":         round(cpu_user, 1),
    "cpu_sys":          round(cpu_sys, 1),
    "cpu_idle":         round(cpu_idle, 1),
    "memory_used_gb":   memory_used_gb,
    "memory_total_gb":  memory_total_gb,
    "memory_active_gb":     memory_active_gb,
    "memory_wired_gb":      memory_wired_gb,
    "memory_compressed_gb": memory_compressed_gb,
    "memory_inactive_gb":   memory_inactive_gb,
    "memory_free_gb":       memory_free_gb,
    "swap_used_gb":     swap_used_gb,
    "top_procs_by_rss": top_procs_by_rss,
    "top_procs_by_cpu": top_procs_by_cpu,
    "inference_servers": [
        {"name": "ollama",  "running": ollama_pid is not None, "pid": ollama_pid},
        {"name": "mlx_lm",  "running": mlx_pid   is not None, "pid": mlx_pid},
    ],
}
print(json.dumps(result))
PYEOF
""".strip()

_FALLBACK_PAYLOAD = {
    "cpu_percent": 0.0,
    "memory_used_gb": 0.0,
    "memory_total_gb": 0.0,
    "swap_used_gb": 0.0,
    "inference_servers": [
        {"name": "ollama", "running": False, "pid": None},
        {"name": "mlx_lm", "running": False, "pid": None},
    ],
}


def _get_target(target_id: int) -> Target | None:
    with Session(engine) as session:
        return session.get(Target, target_id)


async def _resource_event_generator(target_id: int) -> AsyncGenerator:
    # Register this client — incremented on connect, decremented on disconnect/cancel
    _active_clients[target_id] = _active_clients.get(target_id, 0) + 1
    try:
        while True:
            target = _get_target(target_id)
            if target is None:
                yield {"data": json.dumps({**_FALLBACK_PAYLOAD, "error": "Target not found"})}
                await asyncio.sleep(3)
                continue

            executor = SSHExecutor(
                host=target.host,
                username=target.username,
                key_path=target.key_path,
                port=target.port,
            )

            try:
                stdout, stderr, code = await async_run(executor, _STATS_CMD)
                if code == 0 and stdout.strip():
                    json_line = next(
                        (ln for ln in reversed(stdout.splitlines()) if ln.strip().startswith("{")),
                        None,
                    )
                    payload = json.loads(json_line) if json_line else _FALLBACK_PAYLOAD
                else:
                    payload = {**_FALLBACK_PAYLOAD, "error": stderr[:200] if stderr else "SSH error"}
            except Exception as exc:
                payload = {**_FALLBACK_PAYLOAD, "error": str(exc)[:200]}

            yield {"data": json.dumps(payload)}
            await asyncio.sleep(3)
    finally:
        # Deregister — when count hits 0, no more SSH polls will fire for this target
        _active_clients[target_id] = max(0, _active_clients.get(target_id, 1) - 1)


# This generator is used for future targets that open a stream when nobody is watching
# The real idle-suppression happens because EventSourceResponse cancels the generator
# when the client disconnects — the finally block above decrements the counter, and
# no new generator is started until the next browser connection opens /api/status/stream.


@router.get("/stream")
async def status_stream(target: int):
    """SSE stream — pushes resource stats every 3 seconds."""
    return EventSourceResponse(_resource_event_generator(target))
