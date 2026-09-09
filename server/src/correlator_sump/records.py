"""`GET /records` query logic (cor-CORE.QUERY-002): time-range, kind, and
post-filters over the per-daemon-per-kind streams `cor-CORE.QUERY-001`
writes, with independent per-kind cursor pagination. Contract ported
from `log-sump`'s own `log-server` (`~/sources/log-sump-server/docs/
api.md`).

Filters by each record's own `ts` field, not the Redis Stream entry ID's
implicit (ingestion-time) timestamp -- ingestion time and event time can
diverge (buffering, network delay), and it's event time a correlation UI
needs to bound by. This means every query does a full `XRANGE` scan of
the relevant stream(s) rather than an ID-bounded one -- a known
performance trade-off, not a scale-tested design, appropriate for this
phase's scope (see `REQ-000007`'s Open questions).
"""

from __future__ import annotations

import json
from collections.abc import Awaitable
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

DEFAULT_LIMIT = 200
MAX_LIMIT = 1000


class RedisLike(Protocol):
    def xrange(
        self, name: str, min: str, max: str
    ) -> Awaitable[list[tuple[Any, dict[Any, Any] | None]] | None]: ...


def _parse_ts(ts: str) -> datetime:
    # `ts` is ISO 8601 with a trailing "Z" -- `fromisoformat` wants "+00:00".
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _decode(value: Any) -> str:
    return value.decode() if isinstance(value, bytes) else value


def _json_field(fields: dict) -> str:
    return _decode(fields.get(b"json", fields.get("json")))


async def _fetch_kind(
    redis_client: RedisLike,
    docker_host: str,
    kind: str,
    start: datetime,
    end: datetime,
    limit: int,
    cursor: str | None,
    post_filter: Any,
) -> tuple[list[dict], str | None]:
    stream_key = f"logsump:stream:{docker_host}:{kind}"
    raw_entries = await redis_client.xrange(stream_key, min="-", max="+") or []

    matched: list[tuple[str, datetime, dict]] = []
    for entry_id_raw, fields in raw_entries:
        if fields is None:
            continue
        entry_id = _decode(entry_id_raw)
        record = json.loads(_json_field(fields))
        ts = _parse_ts(record["ts"])
        if not (start <= ts <= end):
            continue
        if not post_filter(record):
            continue
        matched.append((entry_id, ts, record))

    matched.sort(key=lambda triple: (triple[1], triple[0]))

    start_idx = 0
    if cursor is not None:
        start_idx = len(matched)
        for i, (entry_id, _ts, _record) in enumerate(matched):
            if entry_id == cursor:
                start_idx = i + 1
                break

    page = matched[start_idx : start_idx + limit]
    has_more = start_idx + limit < len(matched)
    next_cursor = page[-1][0] if has_more and page else None
    return [record for _entry_id, _ts, record in page], next_cursor


async def query_records(
    redis_client: RedisLike,
    docker_host: str,
    kind: str = "both",
    container_id: str | None = None,
    level: str | None = None,
    q: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    log_cursor: str | None = None,
    metric_cursor: str | None = None,
    limit: int = DEFAULT_LIMIT,
) -> dict[str, Any]:
    """Records for `docker_host` in `[start, end]` (inclusive), matching
    `kind`/`container_id`/`level`/`q`, up to `limit` per kind. `kind=both`
    returns both kinds' matches interleaved by `ts`."""
    now = datetime.now(UTC)
    start = start or (now - timedelta(hours=1))
    end = end or now
    limit = min(limit, MAX_LIMIT)

    def post_filter(record: dict) -> bool:
        if container_id is not None and record.get("container_id") != container_id:
            return False
        if record["kind"] == "log":
            if level is not None and record.get("level") != level:
                return False
            if q is not None and q.lower() not in record.get("message", "").lower():
                return False
        return True

    records: list[dict] = []
    next_log_cursor: str | None = None
    next_metric_cursor: str | None = None

    if kind in ("log", "both"):
        log_records, next_log_cursor = await _fetch_kind(
            redis_client, docker_host, "log", start, end, limit, log_cursor, post_filter
        )
        records.extend(log_records)
    if kind in ("metric", "both"):
        metric_records, next_metric_cursor = await _fetch_kind(
            redis_client, docker_host, "metric", start, end, limit, metric_cursor, post_filter
        )
        records.extend(metric_records)

    records.sort(key=lambda r: r["ts"])

    return {
        "records": records,
        "next_log_cursor": next_log_cursor,
        "next_metric_cursor": next_metric_cursor,
    }
