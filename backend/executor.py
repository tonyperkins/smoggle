"""
executor.py — SSH and local command executor abstractions.

SSHExecutor.run() is synchronous/blocking (Paramiko). All callers inside
async route handlers must use async_run() instead of calling run() directly,
to avoid blocking the FastAPI / uvicorn event loop.
"""
from abc import ABC, abstractmethod
from typing import Optional
import asyncio
import base64
import functools
import hashlib
import hmac
import threading
import os
import paramiko


class BaseExecutor(ABC):
    @abstractmethod
    def run(self, command: str) -> tuple[str, str, int]:
        """Execute a command. Returns (stdout, stderr, exit_code)."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Return True if the connection is reachable and usable."""
        pass

    @abstractmethod
    def close(self):
        """Release any held connections."""
        pass


def _fingerprint(key: paramiko.PKey) -> str:
    """OpenSSH-style SHA256 fingerprint of a host key (e.g. 'SHA256:abc…')."""
    digest = hashlib.sha256(key.asbytes()).digest()
    return "SHA256:" + base64.b64encode(digest).decode("ascii").rstrip("=")


class _HostKeyPinPolicy(paramiko.MissingHostKeyPolicy):
    """Trust-on-first-use host-key pinning.

    Known-hosts is never loaded, so this fires on every new connection. With no
    expected fingerprint we record what we see and accept (TOFU); with one we
    require an exact match and reject otherwise (defends against LAN MITM).
    """

    def __init__(self, executor: "SSHExecutor"):
        self._executor = executor

    def missing_host_key(self, client, hostname, key):
        fp = _fingerprint(key)
        expected = self._executor.host_key_fingerprint
        if expected is None:
            self._executor.captured_fingerprint = fp
            return  # first contact — trust and remember
        if hmac.compare_digest(fp, expected):
            return  # matches the pinned key
        raise paramiko.SSHException(
            f"host key changed for {hostname}: expected {expected}, got {fp}"
        )


class SSHExecutor(BaseExecutor):
    """Paramiko-backed SSH executor with connection pooling per target.

    Paramiko's SSHClient is NOT safe for concurrent exec_command calls from
    multiple threads on the same transport. We serialise all run() calls per
    target with a per-key threading.Lock so that asyncio.gather() batches
    work correctly without corrupting channels.
    """

    _pool: dict = {}          # pool_key -> paramiko.SSHClient
    _pool_lock: threading.Lock = threading.Lock()   # guards pool dict itself
    _cmd_locks: dict = {}     # pool_key -> threading.Lock (serialises exec_command)

    def __init__(
        self,
        host: str,
        username: str,
        key_path: str,
        port: int = 22,
        timeout: int = 10,
        host_key_fingerprint: Optional[str] = None,
    ):
        self.host = host
        self.username = username
        self.key_path = os.path.expanduser(key_path)
        self.port = port
        self.timeout = timeout
        # Pinned fingerprint (None => trust-on-first-use). After a first-contact
        # connect, captured_fingerprint holds what we saw so the caller can
        # persist it onto the Target.
        self.host_key_fingerprint = host_key_fingerprint
        self.captured_fingerprint: Optional[str] = None
        self._pool_key = f"{username}@{host}:{port}"
        # Ensure a command-serialisation lock exists for this target
        with SSHExecutor._pool_lock:
            if self._pool_key not in SSHExecutor._cmd_locks:
                SSHExecutor._cmd_locks[self._pool_key] = threading.Lock()

    def _get_client(self) -> paramiko.SSHClient:
        with SSHExecutor._pool_lock:
            client = SSHExecutor._pool.get(self._pool_key)
            if client is None or not client.get_transport() or not client.get_transport().is_active():
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(_HostKeyPinPolicy(self))
                client.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    key_filename=self.key_path,
                    timeout=self.timeout,
                    allow_agent=False,
                    look_for_keys=False,
                )
                SSHExecutor._pool[self._pool_key] = client
            return client

    def run(self, command: str) -> tuple[str, str, int]:
        cmd_lock = SSHExecutor._cmd_locks[self._pool_key]
        with cmd_lock:
            try:
                client = self._get_client()
                _, stdout_f, stderr_f = client.exec_command(command, timeout=self.timeout)
                exit_code = stdout_f.channel.recv_exit_status()
                stdout = stdout_f.read().decode("utf-8", errors="replace").strip()
                stderr = stderr_f.read().decode("utf-8", errors="replace").strip()
                return stdout, stderr, exit_code
            except Exception as exc:
                with SSHExecutor._pool_lock:
                    SSHExecutor._pool.pop(self._pool_key, None)
                return "", str(exc), 1

    def test_connection(self) -> bool:
        try:
            stdout, _, code = self.run("echo ok")
            return code == 0 and stdout.strip() == "ok"
        except Exception:
            return False

    def close(self):
        with SSHExecutor._pool_lock:
            client = SSHExecutor._pool.pop(self._pool_key, None)
            if client:
                try:
                    client.close()
                except Exception:
                    pass


class LocalExecutor(BaseExecutor):
    """Reserved for future local mode. Not implemented in v1."""

    def run(self, command: str) -> tuple[str, str, int]:
        raise NotImplementedError("Local mode not implemented in v1")

    def test_connection(self) -> bool:
        raise NotImplementedError("Local mode not implemented in v1")

    def close(self):
        raise NotImplementedError("Local mode not implemented in v1")


def build_executor(target) -> SSHExecutor:
    """Construct an SSHExecutor for a Target using the app-managed identity key
    and the target's pinned host-key fingerprint. Single source of truth for
    executor creation across all routers."""
    from backend import ssh_identity  # local import avoids any import cycle

    return SSHExecutor(
        host=target.host,
        username=target.username,
        key_path=ssh_identity.KEY_PATH,
        port=target.port,
        host_key_fingerprint=target.host_key_fingerprint,
    )


async def async_run(executor: BaseExecutor, command: str) -> tuple[str, str, int]:
    """
    Awaitable wrapper around BaseExecutor.run().

    SSHExecutor.run() blocks on Paramiko I/O. This helper offloads the call
    to the default asyncio thread-pool executor so the FastAPI / uvicorn event
    loop is never blocked.  Use this in every async route handler instead of
    calling executor.run() directly.

    Usage:
        stdout, stderr, code = await async_run(executor, "echo ok")
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, functools.partial(executor.run, command))


async def async_test_connection(executor: BaseExecutor) -> bool:
    """Awaitable wrapper around BaseExecutor.test_connection()."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, executor.test_connection)
