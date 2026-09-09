"""The second correlator Sump data-stream plugin (cor-CORE.DATASTREAM-003).

Polls an external `log-sump` deployment's own authenticated `GET
/catalog`/`GET /records` HTTP query API and relays fetched records
directly into the local Sump's `IngestAdapter.ingest()` via a
`register_background_task` hookimpl -- unlike `sump-plugin-ssh`, this
plugin never execs anything against a target host: `log-sump` already
does its own Docker orchestration on the other end.
"""

__version__ = "0.1.0"
