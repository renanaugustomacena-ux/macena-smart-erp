# syntax=docker/dockerfile:1.7
# ── Stage 1: Build ──────────────────────────────────────────────
# Base image digest pin — rotated during each release cut by the
# `update-base-digests` action. Pin format: <tag>@sha256:<64-hex>.
# Current pin is a placeholder; the CI `base-image-digest-guard` job
# fails the build if this line is unpinned before a prod release.
# Override at build time:  docker build --build-arg NODE_IMAGE=node:20-alpine@sha256:<digest>
ARG NODE_IMAGE=node:20-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Pinned OS packages (hadolint DL3018). Versions are Alpine 3.19 defaults
# as of node:20-alpine; re-pin on image rotation.
RUN apk add --no-cache \
      python3=~3.11 \
      make=~4.4 \
      g++=~13.2

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && cp -R node_modules prod_node_modules
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM ${NODE_IMAGE} AS production

WORKDIR /app

RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

COPY --from=builder /app/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3001
ENV OTEL_SERVICE_NAME=smarterp-backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

USER nestjs

CMD ["node", "dist/main"]
