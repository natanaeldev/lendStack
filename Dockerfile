# ─── Next.js Web Application ─────────────────────────────────────────────────
#
# Multi-stage build:
#   deps    → install production dependencies
#   builder → compile Next.js (transpile, optimize, tree-shake)
#   runner  → minimal final image (no dev tools, no source code)
#
# Result: ~200MB image vs ~1GB if you copy node_modules directly.
# Uses the official Next.js standalone output mode which copies only
# the files needed to run the app (no full node_modules in the image).

# ── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps

# Required for bcryptjs native binding compilation
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfile and manifests first — Docker layer cache: only re-runs
# npm ci when package.json or package-lock.json changes.
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy all source files
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Enable Next.js standalone output — generates a self-contained server.js
# that doesn't require node_modules in the final image.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time placeholder values for env vars needed by Next.js at build time.
# Runtime secrets are injected by ECS from Secrets Manager — never baked in.
ENV NEXTAUTH_URL=https://placeholder.example.com
ENV NEXTAUTH_SECRET=build-time-placeholder-not-real

RUN npm run build

# ── Stage 3: Minimal production runner ───────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache curl  # Required for health check CMD

WORKDIR /app

# Run as non-root user — defense in depth
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy only the standalone output — contains everything needed to run
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs

EXPOSE 3000

# next start is handled by the standalone server.js
CMD ["node", "server.js"]
