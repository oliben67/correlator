"""Reader/writer for the `*.recording`/`*.track` archive format (zip +
`manifest.json`), implementing cor-CORE.ARCHIVE-001.

Ported mechanism, not a novel design: cttc/log-sump's own
`sample_archive.py` (`log_sump.common.sample_archive`) -- the same
zip+manifest+sha256-integrity-hash shape, extensions renamed
(`.cttc-record` -> `.recording`, `.cttc-metric` -> `.track`), manifest
version reset to `1` (no claim of reading old `.cttc-*` files -- that
compatibility requirement was specific to the prior gateway
implementation cttc's own format targeted, not something correlator
inherits). Docker-Swarm-specific fields (`swarm_services`, `is_host`)
are dropped -- not modeled anywhere in correlator's plugin-sourced
data-stream world.

A `.recording` holds one or more *log* sources; a `.track` holds a
single named numeric series. "A recording contains tracks" (the
roadmap's own vocabulary) is a catalog-level relationship
(`tracks.recording_id`), not physical file nesting -- these two archive
kinds are independently self-contained and never embed one another.

Dependency-free (no Redis/FastAPI ties), matching the original's own
design principle: callers gather the data, this module only knows the
archive's own shape.
"""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

RECORDING_EXT = ".recording"
TRACK_EXT = ".track"

MANIFEST_VERSION = 1

# Which monitored system a source/track came from -- host telemetry is
# never conflated with container telemetry in the correlation UI (see
# cor-CORE.CORRELATE-00X, the multi-series project view). Additive to the
# manifest: an archive written before this field existed has no
# "system_kind" key at all, and is read back as "container" -- the
# existing (untyped) default every pre-existing source/track already was,
# since no real host-metric producer exists yet either (see the port
# plan's own Step 0 note).
SystemKind = Literal["host", "container"]
DEFAULT_SYSTEM_KIND: SystemKind = "container"


def is_sample_archive(name: str) -> bool:
    return name.endswith(RECORDING_EXT) or name.endswith(TRACK_EXT)


@dataclass(frozen=True)
class ArchivedLogRow:
    ts_ms: float
    text: str


@dataclass(frozen=True)
class RecordingArchive:
    t0: float
    t1: float
    created: str
    sources: dict[str, list[ArchivedLogRow]] = field(default_factory=dict)
    system_kinds: dict[str, SystemKind] = field(default_factory=dict)


@dataclass(frozen=True)
class TrackArchive:
    t0: float
    t1: float
    created: str
    series_name: str
    points: list[tuple[float, float]] = field(default_factory=list)
    system_kind: SystemKind = DEFAULT_SYSTEM_KIND


def _manifest_hash(manifest_without_hash: dict) -> str:
    """sha256 over the canonical (sorted-keys) JSON of a manifest --
    tamper-evidence only (permissive-read bias, matching the ported
    format's own reference implementation): a mismatch is never raised
    on read, only available for a caller to check if it cares."""
    payload = json.dumps(manifest_without_hash, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def write_recording(
    t0: float, t1: float, log_sources: list[tuple[str, SystemKind, list[tuple[float, str]]]]
) -> bytes:
    """`log_sources` is `(name, system_kind, [(ts_ms, text), ...])` per
    source (e.g. one per container, or the host). Sources with no rows
    are skipped."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        sources_meta: list[dict] = []
        for i, (name, system_kind, rows) in enumerate(log_sources):
            if not rows:
                continue
            fn = f"logs/{i}.jsonl"
            lines = "\n".join(json.dumps({"ts": ts, "text": text}) for ts, text in rows)
            z.writestr(fn, lines)
            sources_meta.append(
                {"name": name, "file": fn, "count": len(rows), "system_kind": system_kind}
            )

        manifest = {
            "version": MANIFEST_VERSION,
            "kind": "recording",
            "from": t0,
            "to": t1,
            "created": _now_iso(),
            "sources": sources_meta,
        }
        manifest["integrity_sha256"] = _manifest_hash(manifest)
        z.writestr("manifest.json", json.dumps(manifest))
    return buf.getvalue()


def read_recording(data: bytes) -> RecordingArchive:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        manifest = json.loads(z.read("manifest.json"))
        manifest.pop("integrity_sha256", None)

        sources: dict[str, list[ArchivedLogRow]] = {}
        system_kinds: dict[str, SystemKind] = {}
        for meta in manifest["sources"]:
            content = z.read(meta["file"])
            rows = []
            for line in content.splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                rows.append(ArchivedLogRow(ts_ms=row["ts"], text=row.get("text", "")))
            sources[meta["name"]] = rows
            system_kinds[meta["name"]] = meta.get("system_kind", DEFAULT_SYSTEM_KIND)

        return RecordingArchive(
            t0=manifest["from"],
            t1=manifest["to"],
            created=manifest.get("created", ""),
            sources=sources,
            system_kinds=system_kinds,
        )


def write_track(
    t0: float,
    t1: float,
    series_name: str,
    points: list[tuple[float, float]],
    system_kind: SystemKind = DEFAULT_SYSTEM_KIND,
) -> bytes:
    """`points` is `[(ts_ms, value), ...]` for the one series this track
    captures."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        fn = "series.json"
        z.writestr(fn, json.dumps({"points": [list(p) for p in points]}))

        manifest = {
            "version": MANIFEST_VERSION,
            "kind": "track",
            "from": t0,
            "to": t1,
            "created": _now_iso(),
            "series_name": series_name,
            "system_kind": system_kind,
            "file": fn,
        }
        manifest["integrity_sha256"] = _manifest_hash(manifest)
        z.writestr("manifest.json", json.dumps(manifest))
    return buf.getvalue()


def read_track(data: bytes) -> TrackArchive:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        manifest = json.loads(z.read("manifest.json"))
        manifest.pop("integrity_sha256", None)
        content = z.read(manifest["file"])
        payload = json.loads(content)
        points = [(row[0], row[1]) for row in payload["points"]]

        return TrackArchive(
            t0=manifest["from"],
            t1=manifest["to"],
            created=manifest.get("created", ""),
            series_name=manifest["series_name"],
            points=points,
            system_kind=manifest.get("system_kind", DEFAULT_SYSTEM_KIND),
        )
