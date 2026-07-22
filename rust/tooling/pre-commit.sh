#!/bin/bash
# Pre-commit hook for Rust projects
# Install: cp tooling/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "Running Rust pre-commit hooks..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if files were modified
if ! git diff-index --quiet HEAD -- '*.rs' 'Cargo.toml' 'Cargo.lock'; then
    echo -e "${YELLOW}Rust files modified, running checks...${NC}"
else
    echo -e "${GREEN}No Rust files modified, skipping checks.${NC}"
    exit 0
fi

# Get list of changed Rust files
CHANGED_FILES=$(git diff --name-only -- '*.rs' | head -20)

# Format check
echo -e "${YELLOW}Checking formatting...${NC}"
if ! cargo fmt -- --check 2>/dev/null; then
    echo -e "${RED}Formatting issues found. Run 'cargo fmt' to fix.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Formatting OK${NC}"

# Clippy check
echo -e "${YELLOW}Running Clippy...${NC}"
if ! cargo clippy --all-targets --all-features -- -D warnings 2>/dev/null; then
    echo -e "${RED}Clippy found issues.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Clippy OK${NC}"

# Quick test (if files in src/ changed)
if echo "$CHANGED_FILES" | grep -q "^src/"; then
    echo -e "${YELLOW}Running quick tests...${NC}"
    if ! cargo test --quick 2>/dev/null; then
        echo -e "${RED}Tests failed.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Tests OK${NC}"
fi

echo -e "${GREEN}All pre-commit checks passed!${NC}"
exit 0
