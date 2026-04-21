# ─────────────────────────────────────────────
# Stage 1: install dependencies
# ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ─────────────────────────────────────────────
# Stage 2: build Astro standalone server
# PUBLIC_API_URL is embedded at build time for
# client-side JS; override with --build-arg for
# each environment.
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG PUBLIC_API_URL=http://localhost:3001
ENV PUBLIC_API_URL=$PUBLIC_API_URL

RUN npm run build

# ─────────────────────────────────────────────
# Stage 3: lean production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 astro

COPY --chown=astro:nodejs --from=builder /app/dist         ./dist
COPY --chown=astro:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=astro:nodejs --from=builder /app/package.json ./package.json

USER astro

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4321/ || exit 1

CMD ["node", "./dist/server/entry.mjs"]
