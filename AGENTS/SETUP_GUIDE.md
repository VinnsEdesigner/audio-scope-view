# Setup Guide for Audio Scope View

## Quick Start

### 1. Install Dependencies Without Hanging

```bash
# Disable pnpm prompts to prevent hanging
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTOINSTALL=0
export PNPM_TELEMETRY=0

# Install pnpm and dependencies
cd /workspace/project/audio-scope-view
pnpm install
```

### 2. Build the Project

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @vyzorix/api-client run build
pnpm --filter @vyzorix/web run build
```

### 3. Run Development Server

```bash
# Run web app dev server
pnpm dev:web

# Or run from root
pnpm dev
```

## Linting

```bash
# Run linting on all packages
pnpm lint

# Run linting with auto-fix
pnpm lint --fix
```

## Troubleshooting

### pnpm Hanging

**Solution:** Set these environment variables before running pnpm:

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export COREPACK_ENABLE_AUTOINSTALL=0
export PNPM_TELEMETRY=0
```

### Build Errors

**Solution:** Clean and rebuild:

```bash
pnpm clean
pnpm install
pnpm build
```
