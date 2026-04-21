# ─────────────────────────────────────────────
# Stage 1: install dependencies with pnpm
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────
# Stage 2: build Vite SPA
# VITE_* vars are embedded at build time.
# Pass the public URLs via --build-arg per env.
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_ADMIN_API_URL=http://localhost:3001
ARG VITE_FORM_URL_BASE=http://localhost:4321
ENV VITE_ADMIN_API_URL=$VITE_ADMIN_API_URL \
    VITE_FORM_URL_BASE=$VITE_FORM_URL_BASE

RUN pnpm build

# ─────────────────────────────────────────────
# Stage 3: serve with nginx
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist      /usr/share/nginx/html
COPY nginx.conf                    /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
