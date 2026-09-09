# syntax=docker/dockerfile:1

# cor-CORE.PACKAGING-001: a plain uv-built Python/uvicorn image -- no
# bundled Redis/Fluent-Bit (unlike cttc's/log-sump-container's own
# single-image, s6-overlay-supervised shape). Those are separate
# services in docker-compose.yml, matching cor-CORE.PROVISION-002's
# own compose-based deploy design.

FROM python:3.12-slim AS builder
RUN pip install --no-cache-dir uv
WORKDIR /build
COPY pyproject.toml uv.lock ./
COPY src src
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.12-slim AS runtime
COPY --from=builder /build/.venv /opt/correlator-sump/.venv
ENV PATH="/opt/correlator-sump/.venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health')" || exit 1

# python -m uvicorn, not the uvicorn console-script directly -- uv sync
# bakes the builder stage's own absolute path (/build/.venv/bin/python)
# into that script's shebang, which no longer exists once the venv is
# copied to its runtime-stage path above; invoking the module directly
# only relies on $PATH resolving to the (correctly relocated) venv
# python, sidestepping the mismatch entirely.
CMD ["python", "-m", "uvicorn", "correlator_sump.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8765"]
