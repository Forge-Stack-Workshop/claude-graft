# syntax=docker/dockerfile:1
# Production image. It must not know that a development environment exists.

FROM <RUNTIME>:<PINNED> AS base
RUN groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
# system packages needed at RUNTIME only

FROM base AS deps
COPY <MANIFEST> <LOCKFILE> ./
RUN <INSTALL_FROM_LOCKFILE_FROZEN>

FROM deps AS runtime
COPY --chown=app:app <SOURCE_DIR> ./<SOURCE_DIR>
USER app
EXPOSE <PORT>
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD <HEALTHCHECK_COMMAND>
CMD [<START_COMMAND>]
