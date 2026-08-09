FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy env file for build-time variables
COPY .env* ./

RUN corepack enable && corepack prepare pnpm@11.15.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && rm -f packages/api-client/tsconfig.tsbuildinfo && pnpm --filter @audio-scope-view/api-client build

FROM rust:1.97-bookworm AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y musl-tools libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*
COPY rust/ ./rust/
WORKDIR /app/rust
RUN cargo build --release

FROM node:22-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=frontend-builder /app/apps/vyzorWeb/dist ./apps/vyzorWeb/dist
COPY --from=frontend-builder /app/packages/api-client/dist ./packages/api-client/dist
COPY --from=backend-builder /app/rust/target/release/audio-scope-view /usr/local/bin/
COPY rust/config.toml /app/config.toml
COPY data/ /app/data/
COPY apps/vyzorWeb/scripts/static-server.cjs /app/apps/vyzorWeb/scripts/static-server.cjs
RUN npm install ws@^8.21.1
ENV NODE_ENV=production
ENV PORT=3000
ENV RUST_BACKTRACE=1
ENV APP__SERVER__HOST=127.0.0.1
ENV APP__SERVER__PORT=8080
EXPOSE 3000 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
CMD sh -c 'echo "Starting Rust backend..." && /usr/local/bin/audio-scope-view & RUST_PID=$! && sleep 2 && echo "Starting Node.js frontend..." && node /app/apps/vyzorWeb/scripts/static-server.cjs & NODE_PID=$! && trap "kill $RUST_PID $NODE_PID 2>/dev/null" EXIT && wait'
