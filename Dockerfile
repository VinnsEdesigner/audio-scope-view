FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy env file for build-time variables
COPY .env* ./

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && rm -f packages/api-client/tsconfig.tsbuildinfo && pnpm --filter @audio-scope-view/api-client build

FROM rust:1.75 AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y musl-tools libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*
COPY rust/ ./rust/
WORKDIR /app/rust
RUN cargo build --release --locked

FROM debian:bookworm-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
COPY --from=frontend-builder /app/apps/vyzorWeb/dist ./apps/vyzorWeb/dist
COPY --from=frontend-builder /app/packages/api-client/dist ./packages/api-client/dist
COPY --from=backend-builder /app/rust/target/release/audio-scope-view /usr/local/bin/
RUN mkdir -p /app/data
COPY rust/config.toml /app/config.toml
COPY simple-server.cjs /app/simple-server.cjs
ENV NODE_ENV=production
ENV PORT=3000
ENV RUST_BACKTRACE=1
EXPOSE 3000 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
CMD sh -c 'echo "Starting Rust backend..." && BOOTSTRAP_KEY="${BOOTSTRAP_KEY}" /usr/local/bin/audio-scope-view & RUST_PID=$! && sleep 2 && echo "Starting Node.js frontend..." && node /app/simple-server.cjs & NODE_PID=$! && trap "kill $RUST_PID $NODE_PID 2>/dev/null" EXIT && wait'
