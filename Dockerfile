# ============================================
# Audio Scope View - Production Docker Image
# ============================================

# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY ./.npmrc ./.nvmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN pnpm build

# ============================================
# Build stage for Rust backend
# ============================================
FROM rust:1.75-alpine AS backend-builder

WORKDIR /app

# Install build dependencies for Rust
RUN apk add --no-cache musl-dev openssl-dev pkgconfig

# Copy Rust source
COPY rust/ ./rust/

# Build Rust backend
WORKDIR /app/rust
RUN cargo build --release --locked

# ============================================
# Production stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install Rust runtime and OpenSSL
RUN apk add --no-cache openssl

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
CMD sh -c '\
    echo "Starting Rust backend..." && \
    BOOTSTRAP_KEY="${BOOTSTRAP_KEY}" /usr/local/bin/audio-scope-view &
    RUST_PID=$! && \
    sleep 2 && \
    echo "Starting Node.js frontend..." && \
    node /app/simple-server.cjs &
    NODE_PID=$! && \
    trap "kill $RUST_PID $NODE_PID 2>/dev/null" EXIT && \
    wait'
