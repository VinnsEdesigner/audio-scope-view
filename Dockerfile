# ============================================
# Audio Scope View - Production Docker Image
# ============================================

# Build stage for frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend and api-client (clean tsbuildinfo to force rebuild)
RUN pnpm build && rm -f packages/api-client/tsconfig.tsbuildinfo && pnpm --filter @audio-scope-view/api-client build

# ============================================
# Build stage for Rust backend
# ============================================
FROM rust:1.75 AS backend-builder

WORKDIR /app

# Install build dependencies for Rust
RUN apt-get update && apt-get install -y musl-tools libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*

# Copy Rust source
COPY rust/ ./rust/

# Build Rust backend
WORKDIR /app/rust
RUN cargo build --release --locked

# ============================================
# Production stage
# ============================================
FROM debian:bookworm-slim AS production

WORKDIR /app

# Install Node.js and OpenSSL
RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copy frontend build
COPY --from=frontend-builder /app/apps/vyzorWeb/dist ./apps/vyzorWeb/dist
COPY --from=frontend-builder /app/packages/api-client/dist ./packages/api-client/dist
COPY --from=frontend-builder /app/simple-server.cjs ./simple-server.cjs

# Copy Rust binary
COPY --from=backend-builder /app/rust/target/release/audio-scope-view /usr/local/bin/

# Create data directory
RUN mkdir -p /app/data

# Copy Rust config
COPY rust/config.toml /app/config.toml

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV RUST_BACKTRACE=1

# Expose ports
EXPOSE 3000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start both services
CMD sh -c 'echo "Starting Rust backend..." && BOOTSTRAP_KEY="${BOOTSTRAP_KEY}" /usr/local/bin/audio-scope-view & RUST_PID=$! && sleep 2 && echo "Starting Node.js frontend..." && node /app/simple-server.cjs & NODE_PID=$! && trap "kill $RUST_PID $NODE_PID 2>/dev/null" EXIT && wait'
