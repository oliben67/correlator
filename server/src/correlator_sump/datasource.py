"""Data-source contract (cor-CORE.DATASTREAM-001).

Source-agnostic per REQ-000004 / docs/roadmap/cttc-to-correlator-port.md
§6.3: "a source that can be listed, and that emits logs and/or stats" --
no Docker/container assumption is baked in here, only into whichever
concrete data source a plugin registers (every one shipped so far
happens to be Docker-oriented).

`transport` is `Transport | None` (widened by cor-CORE.DATASTREAM-003):
an exec-less source -- e.g. the logstream plugin, which reaches its
target over an HTTP query API rather than by running commands against a
host -- has no `Transport` to offer and registers `None` instead.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from correlator_sump.transport import Transport


@dataclass(frozen=True)
class ContainerRef:
    container_id: str
    container_name: str


class DataSource(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def transport(self) -> Transport | None: ...

    async def list_targets(self) -> list[ContainerRef]: ...
