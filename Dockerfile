# ==============================================================================
# Multi-Stage Dockerfile for Backend (API & Worker)
# Supports Puppeteer PDF rendering with Noto Sans Devanagari Hindi font support
# ==============================================================================

# Stage 1: Build & compile TypeScript
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Install production dependencies only
RUN npm prune --omit=dev

# Stage 2: Production Runtime
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Chromium, fonts, and required shared libraries for headless PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-deva \
    fonts-freefont-ttf \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built application & dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/modules/reports/templates ./dist/modules/reports/templates
COPY --from=builder /app/src/assets ./dist/assets

# Use non-root node user
USER node

EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health || exit 1

# Default command starts API server. Worker uses `node dist/worker.js` from the same image.
CMD ["node", "dist/server.js"]

