"""Proves the pytest/ruff/ty toolchain runs clean against the empty
scaffold — see rules/env/env-rules.md `env-TEST-001`."""

import re

import correlator_sump


def test_package_is_importable() -> None:
    assert re.fullmatch(r"\d+\.\d+\.\d+", correlator_sump.__version__)
