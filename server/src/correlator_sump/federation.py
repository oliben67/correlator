"""Per-user data-source catalog + privacy (cor-CORE.FEDERATION-002).

A Sump reachable by more than one correlator client needs the privacy
flag enforced where those requests actually converge -- server-side,
not the client-side `data_streams.owner_user_id`/`is_private` columns
(`cor-CORE.PROVISION-001`) alone, which another client is free to
ignore. This module is that enforcement point; the client's own catalog
columns mirror it for local display, not the other way around.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Any, Protocol


class RedisLike(Protocol):
    def get(self, name: str) -> Awaitable[Any]: ...
    def set(self, name: str, value: str) -> Awaitable[Any]: ...


def privacy_key(name: str) -> str:
    return f"sump:datasource:privacy:{name}"


@dataclass(frozen=True)
class PrivacyRecord:
    owner_user_id: str
    is_private: bool


async def get_privacy(redis: RedisLike, name: str) -> PrivacyRecord | None:
    raw = await redis.get(privacy_key(name))
    if raw is None:
        return None
    doc = json.loads(raw)
    return PrivacyRecord(owner_user_id=doc["owner_user_id"], is_private=doc["is_private"])


class OwnershipConflictError(Exception):
    """A caller other than the recorded owner tried to change a
    data source's privacy flag."""


async def set_privacy(redis: RedisLike, name: str, user_id: str, is_private: bool) -> PrivacyRecord:
    """The first caller to set a source's privacy flag becomes its
    recorded owner (first-claim-wins, matching
    `cor-CORE.FEDERATION-003`'s ownership scheme); every later call must
    present that same owner's user id, else `OwnershipConflictError`."""
    current = await get_privacy(redis, name)
    if current is not None and current.owner_user_id != user_id:
        raise OwnershipConflictError(f"{name!r} is owned by a different user")
    record = PrivacyRecord(owner_user_id=user_id, is_private=is_private)
    await redis.set(
        privacy_key(name),
        json.dumps({"owner_user_id": record.owner_user_id, "is_private": record.is_private}),
    )
    return record


def visible_data_sources(
    names: list[str], privacy: dict[str, PrivacyRecord], requester_user_id: str | None
) -> list[str]:
    """Filters `names` (every registered data source) down to the ones
    `requester_user_id` may see: a source with no privacy record, or one
    that isn't private, is always visible; a private one is visible
    only to its recorded owner."""
    visible = []
    for name in names:
        record = privacy.get(name)
        if record is None or not record.is_private:
            visible.append(name)
        elif requester_user_id is not None and record.owner_user_id == requester_user_id:
            visible.append(name)
    return visible
