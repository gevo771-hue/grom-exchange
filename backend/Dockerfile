# syntax=docker/dockerfile:1.6
# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install only what's needed to install deps reproducibly.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# Copy source and strip dev-only artefacts.
COPY . .
RUN rm -rf tests __tests__ *.test.js .eslintrc* .prettier* .git .github

# ---- runtime stage ----
FROM node:20-alpine AS runtime

# tini = proper PID-1, curl = healthcheck, ca-certs = HTTPS to upstreams.
RUN apk add --no-cache tini curl ca-certificates \
 && addgroup -S -g 10001 grom \
 && adduser  -S -u 10001 -G grom grom

ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=900" \
    NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

COPY --from=build --chown=grom:grom /app/node_modules ./node_modules
COPY --from=build --chown=grom:grom /app/src          ./src
COPY --from=build --chown=grom:grom /app/package.json ./package.json

USER grom:grom

EXPOSE 4000 4001 9464

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:4000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
