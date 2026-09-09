"""cor-CORE.FEDERATION-003: ownership + peer-discovery mesh sync.

Ported from cttc's `test_gateway_mesh.py`/`test_auth.py` (renamed
gateway->sump/peer), including the real `ssh-keygen -Y sign`/`verify`
round-trip for `verify_owner_signature` -- the SSHSIG format is the
whole reason that function shells out rather than using `paramiko`, so
it's worth confirming against the actual tool, not a mock of it.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from fakeredis import FakeAsyncRedis

from correlator_sump import mesh

# ── ownership ────────────────────────────────────────────────────────────


async def test_write_ownership_is_first_claim_wins() -> None:
    redis = FakeAsyncRedis()
    first = {"ownerLabel": "alice", "ownerPublicKey": "key-a"}
    second = {"ownerLabel": "bob", "ownerPublicKey": "key-b"}

    assert await mesh.write_ownership(redis, first) is True
    assert await mesh.write_ownership(redis, second) is False  # already claimed
    stored = await mesh.read_ownership(redis)
    assert stored is not None
    assert stored["ownerLabel"] == "alice"


async def test_read_ownership_returns_none_when_unclaimed() -> None:
    redis = FakeAsyncRedis()
    assert await mesh.read_ownership(redis) is None


async def test_overwrite_ownership_replaces_an_existing_record() -> None:
    redis = FakeAsyncRedis()
    await mesh.write_ownership(redis, {"ownerLabel": "alice"})

    await mesh.overwrite_ownership(redis, {"ownerLabel": "bob"})

    stored = await mesh.read_ownership(redis)
    assert stored is not None
    assert stored["ownerLabel"] == "bob"


# ── nonces ───────────────────────────────────────────────────────────────


async def test_consume_nonce_is_single_use() -> None:
    redis = FakeAsyncRedis()
    await mesh.remember_nonce(redis, "nonce-1", 120)

    assert await mesh.consume_nonce(redis, "nonce-1") is True
    assert await mesh.consume_nonce(redis, "nonce-1") is False  # already consumed


async def test_consume_unknown_nonce_returns_false() -> None:
    redis = FakeAsyncRedis()
    assert await mesh.consume_nonce(redis, "never-issued") is False


# ── require_owner_signature ─────────────────────────────────────────────


async def test_require_owner_signature_rejects_when_no_owner_claimed() -> None:
    redis = FakeAsyncRedis()
    with pytest.raises(PermissionError):
        await mesh.require_owner_signature(redis, {"nonce": "n", "signature": "s"}, "rotate")


async def test_require_owner_signature_rejects_missing_nonce_or_signature() -> None:
    redis = FakeAsyncRedis()
    await mesh.write_ownership(redis, {"ownerLabel": "alice", "ownerPublicKey": "key-a"})
    with pytest.raises(PermissionError):
        await mesh.require_owner_signature(redis, {}, "rotate")


async def test_require_owner_signature_rejects_invalid_nonce() -> None:
    redis = FakeAsyncRedis()
    await mesh.write_ownership(redis, {"ownerLabel": "alice", "ownerPublicKey": "key-a"})
    with pytest.raises(PermissionError):
        await mesh.require_owner_signature(
            redis, {"nonce": "never-issued", "signature": "s"}, "rotate"
        )


async def test_require_owner_signature_burns_the_nonce_even_on_bad_signature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A wrong-signature attempt still consumes the nonce, so it can't be
    retried -- `consume_nonce` runs before verification."""
    redis = FakeAsyncRedis()
    await mesh.write_ownership(redis, {"ownerLabel": "alice", "ownerPublicKey": "key-a"})
    await mesh.remember_nonce(redis, "nonce-1", 120)
    monkeypatch.setattr(mesh, "verify_owner_signature", _fake_verify(False))

    with pytest.raises(PermissionError):
        await mesh.require_owner_signature(
            redis, {"nonce": "nonce-1", "signature": "bad-sig"}, "rotate"
        )
    assert await mesh.consume_nonce(redis, "nonce-1") is False  # already gone


async def test_require_owner_signature_succeeds_and_returns_ownership_record(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    redis = FakeAsyncRedis()
    record = {"ownerLabel": "alice", "ownerPublicKey": "key-a"}
    await mesh.write_ownership(redis, record)
    await mesh.remember_nonce(redis, "nonce-1", 120)
    monkeypatch.setattr(mesh, "verify_owner_signature", _fake_verify(True))

    result = await mesh.require_owner_signature(
        redis, {"nonce": "nonce-1", "signature": "good-sig"}, "rotate"
    )

    assert result["ownerLabel"] == "alice"


def _fake_verify(result: bool):
    async def _verify(nonce: str, signature: str, owner_public_key: str) -> bool:
        return result

    return _verify


# ── verify_owner_signature: real ssh-keygen round-trip ──────────────────


def _ssh_keygen_sign(
    tmp_path: Path, *, key_name: str, namespace: str, data: bytes
) -> tuple[str, str]:
    """Generates a fresh ed25519 keypair and signs `data` with it via the
    real `ssh-keygen -Y sign` -- returns (public_key, sshsig_armor)."""
    key_path = tmp_path / key_name
    subprocess.run(
        ["ssh-keygen", "-t", "ed25519", "-N", "", "-f", str(key_path)],
        check=True,
        capture_output=True,
    )
    public_key = key_path.with_suffix(".pub").read_text()
    data_file = tmp_path / f"{key_name}.data"
    data_file.write_bytes(data)
    subprocess.run(
        ["ssh-keygen", "-Y", "sign", "-f", str(key_path), "-n", namespace, str(data_file)],
        check=True,
        capture_output=True,
    )
    signature = data_file.with_suffix(data_file.suffix + ".sig").read_text()
    return public_key, signature


async def test_verify_owner_signature_accepts_a_genuine_signature(tmp_path: Path) -> None:
    nonce = "test-nonce-123"
    public_key, signature = _ssh_keygen_sign(
        tmp_path, key_name="owner", namespace=mesh.ADMIN_SIGNATURE_NAMESPACE, data=nonce.encode()
    )

    assert await mesh.verify_owner_signature(nonce, signature, public_key) is True


async def test_verify_owner_signature_rejects_signature_from_a_different_key(
    tmp_path: Path,
) -> None:
    nonce = "test-nonce-123"
    _impostor_public_key, signature = _ssh_keygen_sign(
        tmp_path, key_name="impostor", namespace=mesh.ADMIN_SIGNATURE_NAMESPACE, data=nonce.encode()
    )
    real_owner_public_key, _ = _ssh_keygen_sign(
        tmp_path,
        key_name="real-owner",
        namespace=mesh.ADMIN_SIGNATURE_NAMESPACE,
        data=b"unrelated",
    )

    assert await mesh.verify_owner_signature(nonce, signature, real_owner_public_key) is False


async def test_verify_owner_signature_rejects_a_tampered_nonce(tmp_path: Path) -> None:
    public_key, signature = _ssh_keygen_sign(
        tmp_path,
        key_name="owner",
        namespace=mesh.ADMIN_SIGNATURE_NAMESPACE,
        data=b"original-nonce",
    )

    assert await mesh.verify_owner_signature("a-different-nonce", signature, public_key) is False


async def test_verify_owner_signature_rejects_garbage_signature() -> None:
    result = await mesh.verify_owner_signature(
        "nonce", "not a real signature", "ssh-ed25519 AAAA fake"
    )
    assert result is False


# ── peer-discovery list: pure functions ─────────────────────────────────


def test_canonical_peer_key_lowercases_host() -> None:
    assert mesh.canonical_peer_key("Some-Host.example", 8080) == "some-host.example:8080"


def test_merge_peer_entry_new_key_forces_unknown_existence() -> None:
    incoming = {"host": "h", "port": 1, "last_contact_at": "z", "existence": "existing"}
    merged = mesh.merge_peer_entry(None, incoming)
    assert merged["existence"] == "unknown"


def test_merge_peer_entry_verified_never_downgraded_by_relayed_unknown() -> None:
    current = {"existence": "existing", "last_contact_at": "2026-08-14T00:00:00Z"}
    incoming = {"existence": "unknown", "last_contact_at": "2026-08-15T00:00:00Z"}  # more recent!

    merged = mesh.merge_peer_entry(current, incoming)

    assert merged is current  # recency never overrides "verified beats relayed-unknown"


def test_merge_peer_entry_more_recent_wins_when_both_verified() -> None:
    current = {"existence": "existing", "last_contact_at": "2026-08-14T00:00:00Z"}
    incoming = {"existence": "absent", "last_contact_at": "2026-08-15T00:00:00Z"}

    merged = mesh.merge_peer_entry(current, incoming)

    assert merged is not current
    assert merged["existence"] == "absent"


def test_merge_peer_entry_tie_prefers_verified() -> None:
    current = {"existence": "unknown", "last_contact_at": "2026-08-14T00:00:00Z"}
    incoming = {"existence": "existing", "last_contact_at": "2026-08-14T00:00:00Z"}

    merged = mesh.merge_peer_entry(current, incoming)

    assert merged["existence"] == "existing"


# ── peer-discovery list: redis-backed ────────────────────────────────────


async def test_load_peer_list_defaults_to_empty() -> None:
    redis = FakeAsyncRedis()
    assert await mesh.load_peer_list(redis) == {}


async def test_save_and_load_peer_list_roundtrips() -> None:
    redis = FakeAsyncRedis()
    entries = {"10.0.0.1:8080": {"host": "10.0.0.1", "port": 8080, "existence": "existing"}}

    await mesh.save_peer_list(redis, entries)

    assert await mesh.load_peer_list(redis) == entries
