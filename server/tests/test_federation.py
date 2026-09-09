"""cor-CORE.FEDERATION-002: per-user data-source catalog + privacy."""

import fakeredis.aioredis
import pytest

from correlator_sump.federation import (
    OwnershipConflictError,
    PrivacyRecord,
    get_privacy,
    set_privacy,
    visible_data_sources,
)


async def test_get_privacy_is_none_when_never_set() -> None:
    redis = fakeredis.aioredis.FakeRedis()
    assert await get_privacy(redis, "self") is None


async def test_first_setter_becomes_owner() -> None:
    redis = fakeredis.aioredis.FakeRedis()
    record = await set_privacy(redis, "self", "user-a", True)
    assert record == PrivacyRecord(owner_user_id="user-a", is_private=True)
    assert await get_privacy(redis, "self") == record


async def test_owner_may_change_their_own_flag() -> None:
    redis = fakeredis.aioredis.FakeRedis()
    await set_privacy(redis, "self", "user-a", True)
    updated = await set_privacy(redis, "self", "user-a", False)
    assert updated.is_private is False


async def test_non_owner_set_raises_ownership_conflict() -> None:
    redis = fakeredis.aioredis.FakeRedis()
    await set_privacy(redis, "self", "user-a", True)
    with pytest.raises(OwnershipConflictError):
        await set_privacy(redis, "self", "user-b", False)
    # Unchanged after the rejected attempt.
    unchanged = await get_privacy(redis, "self")
    assert unchanged is not None
    assert unchanged.owner_user_id == "user-a"


def test_visible_data_sources_public_always_visible() -> None:
    names = ["self", "remote"]
    privacy = {"self": PrivacyRecord(owner_user_id="user-a", is_private=False)}
    assert visible_data_sources(names, privacy, None) == ["self", "remote"]


def test_visible_data_sources_private_only_to_owner() -> None:
    names = ["self", "remote"]
    privacy = {"remote": PrivacyRecord(owner_user_id="user-a", is_private=True)}
    assert visible_data_sources(names, privacy, "user-a") == ["self", "remote"]
    assert visible_data_sources(names, privacy, "user-b") == ["self"]
    assert visible_data_sources(names, privacy, None) == ["self"]
