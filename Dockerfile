# syntax=docker/dockerfile:1
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
# No apk packages are installed here on purpose: nothing in the current
# dependency set needs them. Add `libc6-compat` back via `apk add` when sharp
# becomes a dependency for next/image on musl.
WORKDIR /app

# --- dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# Retries and a bounded fetch timeout: the registry used by the lockfile has
# been observed to hang a socket rather than fail fast.
RUN npm ci --fetch-retries=8 --fetch-retry-mintimeout=15000 --fetch-timeout=180000

# --- build ----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* is inlined and frozen into the client bundle here, so it must
# be present at build time. NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is embedded in
# the build output and must be identical across every instance of a deployment.
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
    NEXT_TELEMETRY_DISABLED=1

# `next build` shells out to the local tsc binary, so devDependencies are required.
RUN npm run build

# --- runtime --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# standalone/ carries server.js and only the node_modules it traced; public/ and
# .next/static/ are deliberately excluded from it and copied in explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
