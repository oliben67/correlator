"""Shapes `cor-CORE.QUERY-002` query results into `cor-CORE.ARCHIVE-001`
archives -- the logic behind `GET /recordings/export`/`GET
/tracks/export` (cor-CORE.ARCHIVE-002), factored out of `app.py` so it's
directly unit-testable without an HTTP round-trip.
"""

from __future__ import annotations

from datetime import datetime

from correlator_sump.archive import write_recording, write_track

#: Every numeric field a MetricRecord (cor-CORE.QUERY-001) can carry --
#: matches app/renderer/src/correlator-api.d.ts's MetricRecord exactly.
VALID_METRIC_FIELDS = frozenset(
    {
        "cpu_pct",
        "mem_used_bytes",
        "mem_limit_bytes",
        "mem_pct",
        "net_rx_bytes",
        "net_tx_bytes",
        "blk_read_bytes",
        "blk_write_bytes",
        "pids",
    }
)


def _ts_to_ms(ts: str) -> float:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000


def build_recording_archive(records: list[dict], start: datetime, end: datetime) -> bytes:
    """Groups `records` (log-kind, from `query_records`) by
    `container_id` (falling back to `docker_host` for daemon-level
    records with none) into one log source per container."""
    grouped: dict[str, list[tuple[float, str]]] = {}
    for record in records:
        key = record.get("container_id") or record["docker_host"]
        grouped.setdefault(key, []).append((_ts_to_ms(record["ts"]), record.get("message") or ""))

    log_sources = list(grouped.items())
    return write_recording(start.timestamp() * 1000, end.timestamp() * 1000, log_sources)


def build_track_archive(
    records: list[dict], metric_field: str, start: datetime, end: datetime
) -> bytes:
    """Extracts one numeric field from `records` (metric-kind, from
    `query_records`) into `(ts_ms, value)` points -- a track is a single
    captured series, not cttc's fixed multi-field stats bundle."""
    points: list[tuple[float, float]] = []
    for record in records:
        value = record.get(metric_field)
        if value is None:
            continue
        points.append((_ts_to_ms(record["ts"]), float(value)))

    return write_track(start.timestamp() * 1000, end.timestamp() * 1000, metric_field, points)
