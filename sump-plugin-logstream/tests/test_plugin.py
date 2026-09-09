"""cor-CORE.DATASTREAM-003 Requirement 3: `SumpPluginLogstream`'s
env-var-driven registration."""

from unittest.mock import MagicMock

import pytest

from sump_plugin_logstream.plugin import SumpPluginLogstream

_ALL_ENV_VARS = ("LOGSTREAM_BASE_URL", "LOGSTREAM_API_KEY", "LOGSTREAM_DOCKER_HOST")


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch):
    for var in _ALL_ENV_VARS:
        monkeypatch.delenv(var, raising=False)


def _set_full_env(monkeypatch) -> None:
    monkeypatch.setenv("LOGSTREAM_BASE_URL", "http://logsump.example")
    monkeypatch.setenv("LOGSTREAM_API_KEY", "secret")
    monkeypatch.setenv("LOGSTREAM_DOCKER_HOST", "h1")


def test_register_background_task_with_full_env_registers_one_task(monkeypatch) -> None:
    _set_full_env(monkeypatch)
    manager = MagicMock()
    manager.ingest_adapter = MagicMock()

    SumpPluginLogstream().register_background_task(manager)

    assert manager.add_background_task.call_count == 1
    name, factory = manager.add_background_task.call_args[0]
    assert name == "logstream-h1"
    assert callable(factory)


@pytest.mark.parametrize("missing", _ALL_ENV_VARS)
def test_register_background_task_with_any_var_missing_registers_nothing(
    monkeypatch, missing
) -> None:
    _set_full_env(monkeypatch)
    monkeypatch.delenv(missing, raising=False)
    manager = MagicMock()
    manager.ingest_adapter = MagicMock()

    SumpPluginLogstream().register_background_task(manager)

    manager.add_background_task.assert_not_called()


def test_register_background_task_without_ingest_adapter_registers_nothing(monkeypatch) -> None:
    _set_full_env(monkeypatch)
    manager = MagicMock()
    manager.ingest_adapter = None

    SumpPluginLogstream().register_background_task(manager)

    manager.add_background_task.assert_not_called()


def test_register_data_source_with_full_env_registers_one_source(monkeypatch) -> None:
    _set_full_env(monkeypatch)
    manager = MagicMock()

    SumpPluginLogstream().register_data_source(manager)

    assert manager.add_data_source.call_count == 1
    name, source = manager.add_data_source.call_args[0]
    assert name == "h1"
    assert source.name == "h1"
    assert source.transport is None


async def test_registered_data_source_list_targets_works_despite_null_transport(
    monkeypatch,
) -> None:
    _set_full_env(monkeypatch)
    manager = MagicMock()

    SumpPluginLogstream().register_data_source(manager)

    _name, source = manager.add_data_source.call_args[0]
    targets = await source.list_targets()

    assert [t.container_id for t in targets] == ["h1"]


def test_register_data_source_without_env_registers_nothing() -> None:
    manager = MagicMock()

    SumpPluginLogstream().register_data_source(manager)

    manager.add_data_source.assert_not_called()
