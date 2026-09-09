"""cor-CORE.DATASTREAM-004: Kibana plugin interface validation.

Design-spike validation only (§6.5/§12 item 6 of the roadmap) -- no
`sump-plugin-kibana` package exists or is being built here. This just
proves, with a real stub checked against the actual `DataSource`
Protocol (not just re-read by eye), that a non-container,
Elasticsearch-backed source can register cleanly through the existing
interface with zero changes to `datasource.py`/`plugins.py`.
"""

from __future__ import annotations

from correlator_sump.datasource import ContainerRef
from correlator_sump.plugins import PluginManager
from correlator_sump.transport import Transport


class _StubKibanaDataSource:
    """Structurally satisfies `DataSource` with no `Transport` at all --
    the same reason `cor-CORE.DATASTREAM-003`'s logstream plugin needed
    `Transport | None` in the first place: nothing here execs a
    command against a host, so there is no target for one."""

    def __init__(self, name: str, index_patterns: list[str]) -> None:
        self._name = name
        self._index_patterns = index_patterns

    @property
    def name(self) -> str:
        return self._name

    @property
    def transport(self) -> Transport | None:
        return None

    async def list_targets(self) -> list[ContainerRef]:
        # Genuinely non-container values -- an Elasticsearch index
        # pattern's id/label, not a Docker container id/name -- proving
        # ContainerRef's *shape* (two identifying strings) works for a
        # source this far from Docker, even though its *field names*
        # (container_id/container_name) are a Docker-flavored leak this
        # rule's Notes flag but deliberately don't fix.
        return [
            ContainerRef(container_id=pattern, container_name=pattern)
            for pattern in self._index_patterns
        ]


async def test_stub_kibana_source_satisfies_data_source_protocol() -> None:
    stub = _StubKibanaDataSource("kibana-stub", ["access-logs-*", "app-errors-*"])

    manager = PluginManager(disabled=["ssh", "logstream"])
    manager.add_data_source(stub.name, stub)

    registered = manager.data_sources["kibana-stub"]
    assert registered is stub
    assert registered.transport is None

    targets = await registered.list_targets()
    assert [t.container_id for t in targets] == ["access-logs-*", "app-errors-*"]
