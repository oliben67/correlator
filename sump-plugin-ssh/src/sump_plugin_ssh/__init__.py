"""The first correlator Sump data-stream plugin (cor-CORE.DATASTREAM-002).

Ports `log-sump`'s `LocalTransport`/`SSHTransport`, packaged as an
installable entry-point plugin under the `sump.plugins` group,
implementing `register_transport` and `register_data_source`. Performs
self-host detection at startup (self-filtered by default; opt-in
self-watch).
"""

__version__ = "0.1.0"
