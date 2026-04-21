# ─────────────────────────────────────────────
# Stage 1: install production dependencies
# ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────────
# Stage 2: production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 kovia

COPY --chown=kovia:nodejs --from=deps /app/node_modules ./node_modules
COPY --chown=kovia:nodejs . .

USER kovia

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
