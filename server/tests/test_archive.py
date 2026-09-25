"""cor-CORE.ARCHIVE-001 acceptance tests (REQ-000008 Requirement 1)."""

import json
import zipfile
from io import BytesIO

from correlator_sump.archive import (
    SystemKind,
    is_sample_archive,
    read_recording,
    read_track,
    write_recording,
    write_track,
)

LogSources = list[tuple[str, SystemKind, list[tuple[float, str]]]]


def test_recording_round_trips_every_log_row_byte_for_byte() -> None:
    log_sources: LogSources = [
        ("web-1", "container", [(1000.0, "hello"), (2000.0, "world")]),
        ("db-1", "container", [(1500.0, "connected")]),
    ]

    data = write_recording(1000.0, 2000.0, log_sources)
    archive = read_recording(data)

    assert archive.t0 == 1000.0
    assert archive.t1 == 2000.0
    assert [(r.ts_ms, r.text) for r in archive.sources["web-1"]] == [
        (1000.0, "hello"),
        (2000.0, "world"),
    ]
    assert [(r.ts_ms, r.text) for r in archive.sources["db-1"]] == [(1500.0, "connected")]


def test_recording_skips_sources_with_no_rows() -> None:
    log_sources: LogSources = [("empty", "container", []), ("real", "container", [(50.0, "x")])]
    data = write_recording(0.0, 100.0, log_sources)
    archive = read_recording(data)
    assert "empty" not in archive.sources
    assert "real" in archive.sources


def test_recording_tags_each_source_with_its_system_kind() -> None:
    log_sources: LogSources = [
        ("web-1", "container", [(10.0, "hi")]),
        ("dockerhost-1", "host", [(20.0, "hi")]),
    ]
    data = write_recording(0.0, 100.0, log_sources)
    archive = read_recording(data)
    assert archive.system_kinds == {"web-1": "container", "dockerhost-1": "host"}


def test_recording_missing_system_kind_defaults_to_container() -> None:
    """An archive written before `system_kind` existed has no such key on
    its sources at all -- read back as `"container"`, the existing
    (untyped) default every pre-existing source already was."""
    data = write_recording(0.0, 100.0, [("web-1", "container", [(10.0, "hi")])])
    with zipfile.ZipFile(BytesIO(data)) as z:
        names = z.namelist()
        contents = {n: z.read(n) for n in names}
    manifest = json.loads(contents["manifest.json"])
    for source in manifest["sources"]:
        del source["system_kind"]
    contents["manifest.json"] = json.dumps(manifest).encode()

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, content in contents.items():
            z.writestr(name, content)

    archive = read_recording(buf.getvalue())
    assert archive.system_kinds == {"web-1": "container"}


def test_track_round_trips_every_point_exactly() -> None:
    points = [(0.0, 0.5), (10.0, 0.75), (20.0, 0.1)]

    data = write_track(0.0, 20.0, "cpu_pct", points)
    archive = read_track(data)

    assert archive.series_name == "cpu_pct"
    assert archive.points == points
    assert archive.system_kind == "container"


def test_track_round_trips_explicit_system_kind() -> None:
    data = write_track(0.0, 20.0, "cpu_pct", [(0.0, 0.5)], "host")
    archive = read_track(data)
    assert archive.system_kind == "host"


def test_track_missing_system_kind_defaults_to_container() -> None:
    data = write_track(0.0, 20.0, "cpu_pct", [(0.0, 0.5)])
    with zipfile.ZipFile(BytesIO(data)) as z:
        names = z.namelist()
        contents = {n: z.read(n) for n in names}
    manifest = json.loads(contents["manifest.json"])
    del manifest["system_kind"]
    contents["manifest.json"] = json.dumps(manifest).encode()

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, content in contents.items():
            z.writestr(name, content)

    archive = read_track(buf.getvalue())
    assert archive.system_kind == "container"


def test_tampered_manifest_hash_still_readable() -> None:
    data = write_recording(0.0, 100.0, [("web-1", "container", [(10.0, "hi")])])

    # Corrupt the manifest's own integrity hash directly -- tamper-evidence
    # only, matching the ported format's own permissive-read bias: this
    # must not raise, only make the hash itself untrustworthy.
    with zipfile.ZipFile(BytesIO(data)) as z:
        names = z.namelist()
        contents = {n: z.read(n) for n in names}
    manifest = json.loads(contents["manifest.json"])
    manifest["integrity_sha256"] = "0" * 64
    contents["manifest.json"] = json.dumps(manifest).encode()

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, content in contents.items():
            z.writestr(name, content)

    archive = read_recording(buf.getvalue())
    assert archive.sources["web-1"][0].text == "hi"


def test_is_sample_archive() -> None:
    assert is_sample_archive("x.recording") is True
    assert is_sample_archive("x.track") is True
    assert is_sample_archive("x.json") is False
    assert is_sample_archive("x.recording.bak") is False
