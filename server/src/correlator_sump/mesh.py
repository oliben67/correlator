"""Ownership + peer-discovery mesh (cor-CORE.FEDERATION-003).

Ported (renamed, `gateway`->`sump`/`peer`) from cttc's
`app/server-logsump/src/log_sump/server/gateway_mesh.py` -- built on
that prior art per the roadmap's own direction, rather than designing
federation semantics from scratch.
"""

from __future__ import annotations

import asyncio
import json
import tempfile
from collections.abc import Awaitable
from pathlib import Path
from typing import Any, Protocol


class RedisLike(Protocol):
    def get(self, name: str) -> Awaitable[Any]: ...
    def set(
        self, name: str, value: str, *, nx: bool = False, ex: int | None = None
    ) -> Awaitable[Any]: ...
    def getdel(self, name: str) -> Awaitable[Any]: ...


#: The `-n` namespace `ssh-keygen -Y sign`/`verify` both must agree on --
#: renamed from cttc's `cttc-admin-auth`, kept fixed (not configurable)
#: for the same reason cttc's own value is fixed: it has to match
#: whatever a client's own signing tooling already hardcodes.
ADMIN_SIGNATURE_NAMESPACE = "correlator-admin-auth"


def ownership_key() -> str:
    return "sump:mesh:ownership"


def nonce_key(nonce: str) -> str:
    return f"sump:mesh:nonce:{nonce}"


def peer_list_key() -> str:
    return "sump:mesh:peers"


# ── ownership (ported from gateway_mesh.write_ownership/read_ownership/overwrite_ownership) ──


async def write_ownership(redis: RedisLike, record: dict[str, Any]) -> bool:
    """`SET NX` -- first claim wins, atomically, so a second client
    connecting to an already-owned Sump can never race a rewrite.
    Returns whether this call actually wrote the record."""
    wrote = await redis.set(ownership_key(), json.dumps(record), nx=True)
    return bool(wrote)


async def read_ownership(redis: RedisLike) -> dict[str, Any] | None:
    raw = await redis.get(ownership_key())
    return json.loads(raw) if raw is not None else None


async def overwrite_ownership(redis: RedisLike, record: dict[str, Any]) -> None:
    """Unconditional `SET` -- the one path allowed to replace an
    existing ownership record. Callers (`POST /mesh/ownership/rotate`)
    are responsible for the authorization check
    (`require_owner_signature`) before ever reaching this."""
    await redis.set(ownership_key(), json.dumps(record))


# ── admin-action nonces (ported from gateway_mesh.remember_nonce/consume_nonce) ──


async def remember_nonce(redis: RedisLike, nonce: str, ttl_seconds: float) -> None:
    if not nonce:
        return
    await redis.set(nonce_key(nonce), "1", ex=int(ttl_seconds))


async def consume_nonce(redis: RedisLike, nonce: str) -> bool:
    """Atomic exists+delete (`GETDEL`) -- two concurrent admin requests
    racing to consume the same nonce must never both succeed."""
    if not nonce:
        return False
    deleted = await redis.getdel(nonce_key(nonce))
    return deleted is not None


async def verify_owner_signature(nonce: str, signature: str, owner_public_key: str) -> bool:
    """Verifies `signature` (an `ssh-keygen -Y sign` SSHSIG armor blob)
    over `nonce`, against `owner_public_key`, by shelling out to
    `ssh-keygen -Y verify` -- ported from cttc's own
    `_verify_owner_signature` verbatim, including why: not `paramiko`
    (already a dependency via `sump-plugin-ssh`) -- its own signature
    verification speaks the raw SSH auth-protocol wire format, not the
    SSHSIG envelope `ssh-keygen -Y sign` produces, so it has no SSHSIG
    parser; shelling to the real OS tool avoids hand-rolling one.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        allowed_signers = tmp_path / "allowed_signers"
        allowed_signers.write_text(f"owner {owner_public_key}\n")
        sig_file = tmp_path / "nonce.sig"
        sig_file.write_text(signature)
        try:
            proc = await asyncio.create_subprocess_exec(
                "ssh-keygen",
                "-Y",
                "verify",
                "-f",
                str(allowed_signers),
                "-I",
                "owner",
                "-n",
                ADMIN_SIGNATURE_NAMESPACE,
                "-s",
                str(sig_file),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
        except FileNotFoundError:
            return False
        try:
            await asyncio.wait_for(proc.communicate(nonce.encode()), timeout=5.0)
        except TimeoutError:
            proc.kill()
            await proc.wait()
            return False
        return proc.returncode == 0


async def require_owner_signature(
    redis: RedisLike, body: dict[str, Any], action: str
) -> dict[str, Any]:
    """The gate for every admin-tier mesh action: raises `PermissionError`
    unless `body` carries a `{nonce, signature}` pair that verifies
    against the current owner's public key. Returns the ownership
    record on success. `consume_nonce` runs *before* signature
    verification, deliberately -- a wrong-signature attempt still burns
    that nonce, so retrying it with a different signature can never
    become a brute-force loop against one still-valid challenge.
    Ported from cttc's `require_owner_signature`, dropping the
    audit-log/`client_host` plumbing (no logger wired up for this
    module yet -- a genuine follow-up, not this rule's own concern).
    """
    ownership = await read_ownership(redis)
    if ownership is None:
        raise PermissionError(f"no owner has claimed this Sump yet (action={action!r})")
    nonce = body.get("nonce")
    signature = body.get("signature")
    if not nonce or not signature:
        raise PermissionError("'nonce' and 'signature' are required")
    if not await consume_nonce(redis, nonce):
        raise PermissionError("invalid, expired, or already-used nonce")
    if not await verify_owner_signature(nonce, signature, ownership["ownerPublicKey"]):
        raise PermissionError("signature did not verify against the owner's public key")
    return ownership


# ── peer-discovery list (ported from gateway_mesh's canonical_gateway_key/ ──
# ── merge_gateway_entry/load_gateway_list/save_gateway_list) ──


def canonical_peer_key(host: str, port: int) -> str:
    return f"{(host or '').lower()}:{port}"


def merge_peer_entry(current: dict[str, Any] | None, incoming: dict[str, Any]) -> dict[str, Any]:
    """One incoming (relayed, untrusted) entry merged against this
    Sump's own persisted record for the same canonical key. A
    brand-new key is always added with `existence` forced to
    `"unknown"`, regardless of what was reported; an existing key keeps
    whichever side has the more recent `last_contact_at` (ties prefer a
    verified `existence` over `unknown`); a locally verified
    `existing`/`absent` is never downgraded to a relayed `unknown`, no
    matter how recent that relayed value claims to be -- checked first,
    ahead of (and overriding) the recency comparison. Ported from
    `gateway_mesh.merge_gateway_entry` unchanged.
    """
    if current is None:
        merged = dict(incoming)
        merged["existence"] = "unknown"
        return merged
    current_verified = current.get("existence") in ("existing", "absent")
    incoming_verified = incoming.get("existence") in ("existing", "absent")
    if current_verified and not incoming_verified:
        return current
    incoming_ts = str(incoming.get("last_contact_at") or "")
    current_ts = str(current.get("last_contact_at") or "")
    if incoming_ts > current_ts:
        return dict(incoming)
    if incoming_ts < current_ts:
        return current
    return dict(incoming) if (incoming_verified and not current_verified) else current


async def load_peer_list(redis: RedisLike) -> dict[str, Any]:
    raw = await redis.get(peer_list_key())
    return json.loads(raw) if raw is not None else {}


async def save_peer_list(redis: RedisLike, entries: dict[str, Any]) -> None:
    await redis.set(peer_list_key(), json.dumps(entries))
