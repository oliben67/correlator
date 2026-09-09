"""Thin HTTP client for a `log-sump` `log-server` instance
(cor-CORE.DATASTREAM-003).

Wraps an injected `httpx.AsyncClient` -- base URL and the `X-API-Key`
auth header are already configured on that client by the caller
(`plugin.py`), so this class never handles auth itself, only the two
routes this plugin needs: `GET /catalog` (daemon discovery) and `GET
/records` (cursor-paginated log/metric fetch). Matches `log-server`'s
own documented contract exactly (`~/sources/log-sump-server/packages/
log-sump-server/src/log_sump_server/routers/{catalog,records}.py`) --
also the same shape `correlator_sump`'s own `GET /records`
(cor-CORE.QUERY-002) already implements, confirmed during this
requirement's upstream survey to not be a coincidence.
"""

from __future__ import annotations

from typing import Any

import httpx


class LogSumpClient:
    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self._http = http_client

    async def get_catalog(self) -> list[dict[str, Any]]:
        response = await self._http.get("/catalog")
        response.raise_for_status()
        return response.json()

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
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"docker_host": docker_host, "kind": kind}
        if start is not None:
            params["start"] = start
        if end is not None:
            params["end"] = end
        if log_cursor is not None:
            params["log_cursor"] = log_cursor
        if metric_cursor is not None:
            params["metric_cursor"] = metric_cursor
        if limit is not None:
            params["limit"] = limit
        response = await self._http.get("/records", params=params)
        response.raise_for_status()
        return response.json()
