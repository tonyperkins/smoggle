"""
ssh_identity.py — single source of truth for Smoggle's SSH identity key.

The app owns ONE Ed25519 keypair that it uses to authenticate to every target
Mac. The key is generated on first boot into the persistent data volume so the
user never has to create or place a key themselves. Enrolling a Mac just means
authorising this public key (see GET /api/enroll.sh).

Keys are generated with `cryptography` (a paramiko dependency) rather than
shelling out to `ssh-keygen`, so the slim runtime image needs no openssh-client.
"""
import os

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

# Mirrors the _default_db_path pattern in database.py: prefer the explicit env
# var (set to /app/data/id_smoggle in the container), fall back to a local data
# dir for dev.
_default_key_path = os.path.join(os.path.dirname(__file__), "..", "data", "id_smoggle")
KEY_PATH = os.path.abspath(os.getenv("SMOGGLE_KEY_PATH", _default_key_path))
PUB_PATH = KEY_PATH + ".pub"

_KEY_COMMENT = "smoggle"


def ensure_identity() -> str:
    """Generate the app's Ed25519 keypair if it does not already exist.

    Idempotent — safe to call on every boot. Returns the private key path.
    """
    if os.path.exists(KEY_PATH) and os.path.exists(PUB_PATH):
        return KEY_PATH

    os.makedirs(os.path.dirname(KEY_PATH), exist_ok=True)

    private_key = Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.OpenSSH,
        encryption_algorithm=NoEncryption(),
    )
    public_bytes = private_key.public_key().public_bytes(
        encoding=Encoding.OpenSSH,
        format=PublicFormat.OpenSSH,
    )
    public_line = public_bytes.decode("ascii") + " " + _KEY_COMMENT + "\n"

    # Write private key with 0600 from the moment it exists on disk.
    fd = os.open(KEY_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(private_bytes)
    os.chmod(KEY_PATH, 0o600)

    with open(PUB_PATH, "w", encoding="ascii") as f:
        f.write(public_line)

    return KEY_PATH


def get_public_key() -> str:
    """Return the app's public key line (e.g. 'ssh-ed25519 AAAA... smoggle')."""
    ensure_identity()
    with open(PUB_PATH, "r", encoding="ascii") as f:
        return f.read().strip()
