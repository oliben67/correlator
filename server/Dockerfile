# syntax=docker/dockerfile:1

# Single container image bundling correlator-sump, redis-server, and fluent-bit
# supervised by supervisord, exposing ports 8765, 6379, and 5140.

FROM python:3.12-slim AS builder
RUN pip install --no-cache-dir uv
WORKDIR /build
COPY pyproject.toml uv.lock ./
COPY src src
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.12-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gnupg \
        redis-server \
        supervisor \
    && curl -fsSL https://packages.fluentbit.io/fluentbit.key | gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/bookworm bookworm main" > /etc/apt/sources.list.d/fluentbit.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends fluent-bit \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/.venv /opt/correlator-sump/.venv
ENV PATH="/opt/correlator-sump/.venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1

COPY fluent-bit.conf /etc/fluent-bit/fluent-bit.conf
COPY supervisord.conf /etc/supervisor/supervisord.conf

EXPOSE 8765 6379 5140

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health')" || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
