"""Poll-and-relay loop: an external `log-sump`'s `GET /records` -> the
local Sump's `IngestAdapter.ingest()` (cor-CORE.DATASTREAM-003).

No Fluent-Bit/TCP round-trip: this plugin has no `docker logs -f`
subprocess whose stdout needs capturing (unlike `ssh`/`self`), so the
relay task calls `ingest()` directly, in-process.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class LogSumpClientLike(Protocol):
    async def get_records(
        self,
        docker_host: str,
        *,
        kind: str = "both",
        start: str | None = None,
        end: str | None = None,
        log_cursor: str | None = None,
        metric_cursor: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]: ...


class IngestAdapterLike(Protocol):
    async def ingest(self, raw: bytes) -> bool: ...


@dataclass(frozen=True)
class Cursors:
    log_cursor: str | None = None
    metric_cursor: str | None = None


async def relay_once(
    client: LogSumpClientLike,
    docker_host: str,
    adapter: IngestAdapterLike,
    cursors: Cursors,
) -> Cursors:
    """Fetch one `/records` page since `cursors` and ingest every record
    in it, re-serialized to JSON bytes (`log-server`'s `LogRecord`/
    `MetricRecord` already carry the `kind`/`docker_host` fields
    `IngestAdapter.ingest()` requires -- confirmed during this
    requirement's upstream survey, no translation needed). Never raises
    for a single malformed record: `adapter.ingest()` already drops and
    logs one on its own (cor-CORE.INGEST-001), matching that posture
    rather than adding a second layer of validation here."""
    page = await client.get_records(
        docker_host,
        log_cursor=cursors.log_cursor,
        metric_cursor=cursors.metric_cursor,
    )
    for record in page.get("records", []):
        raw = json.dumps(record).encode("utf-8")
        await adapter.ingest(raw)
    return Cursors(
        log_cursor=page.get("next_log_cursor"),
        metric_cursor=page.get("next_metric_cursor"),
    )


async def run_relay_loop(
    client: LogSumpClientLike,
    docker_host: str,
    adapter: IngestAdapterLike,
    *,
    interval_s: float = 5.0,
) -> None:
    """Calls `relay_once` forever, sleeping `interval_s` between polls.
    A poll failure (e.g. the target `log-sump` is briefly unreachable) is
    logged and retried after the same interval -- "sleep, don't crash",
    matching `sump-plugin-ssh`'s own posture for an unavailable target --
    rather than killing this long-lived task outright. Cancellation
    (`create_app`'s lifespan tearing the task down) propagates normally
    through `asyncio.sleep`."""
    cursors = Cursors()
    while True:
        try:
            cursors = await relay_once(client, docker_host, adapter, cursors)
        except Exception:
            logger.exception("logstream relay poll failed for docker_host=%r", docker_host)
        await asyncio.sleep(interval_s)
