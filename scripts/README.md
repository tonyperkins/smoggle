# scripts/

Tooling for validating Smoggle's toggle detection across macOS versions.

## `macos-compat-report.sh`

A **read-only** diagnostic run on a target Mac. It prints (and saves to the
Desktop) the raw output of every command Smoggle uses to read a toggle's state —
`defaults read …`, `pmset -g`, `mdutil -a -s`, etc. — tagged with the macOS
version and hardware.

It changes nothing; it only reads. A handful of system-level reads need admin
rights, so it prompts for a password once (and skips them if declined).

Run it on the Mac:

```sh
sh macos-compat-report.sh
```

Then send back `~/Desktop/smoggle-macos-report.txt`.

## `baselines/`

Known-good captures, one per macOS version (e.g. `macos-14.6.txt`). When a report
comes in from a new version, diff it against the nearest baseline to spot where
Apple changed a command's output (the kind of drift that made `auto_updates`
mis-report on Sonoma). Fix the affected toggle's `cmd_status` in
`backend/toggles_registry.py`, then add the new version to
`SUPPORTED_MACOS_MAJORS` in `backend/compat.py` and drop its report in here as a
new baseline.

`macos-14.6.txt` is the reference: a 2022 M2 MacBook Air, the version Smoggle is
built and tested against.
