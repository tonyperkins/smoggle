#!/bin/sh
# Runs as root, fixes ownership of the (possibly pre-existing, root-owned) data
# volume so the unprivileged 'smoggle' user can write the DB, SSH key and auth
# file, then drops privileges to that user for the actual process.
set -e

chown -R smoggle:smoggle /app/data 2>/dev/null || true

exec gosu smoggle "$@"
