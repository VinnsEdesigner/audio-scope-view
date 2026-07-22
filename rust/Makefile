# Makefile for audio-scope-view Rust server

.PHONY: all build test clippy fmt lint clean install run release debug
.PHONY: check check-all audit doc doc-open watch install-hooks help

# Default target - run all checks
all: check

## Build targets
build:
	cargo build

build-real-audio:
	cargo build --features real-audio

release:
	cargo build --release

release-real-audio:
	cargo build --release --features real-audio

debug:
	RUST_LOG=debug cargo build

## Run targets
run:
	cargo run

run-release:
	cargo run --release

## Test targets
test:
	cargo test

test-all:
	cargo test --all-features --all-targets

test-doc:
	cargo test --doc

test-quick:
	cargo test -- --quick

## Linting targets
fmt:
	cargo fmt --all

fmt-check:
	cargo fmt --all -- --check

clippy:
	cargo clippy --all-targets --all-features -- -D warnings

clippy-dev:
	cargo clippy --all-targets

clippy-fix:
	cargo clippy --fix --allow-dirty --allow-staged --all-targets --all-features

## Combined check targets
check: fmt clippy test
	@echo "All checks passed!"

check-ci: fmt-check clippy test
	@echo "All CI checks passed!"

check-all: fmt-check clippy test-all

## Documentation targets
doc:
	cargo doc --all --no-deps

doc-open:
	cargo doc --all --no-deps --open

doc-check:
	cargo doc --all --no-deps --document-private-items

## Clean targets
clean:
	cargo clean

distclean:
	cargo clean
	rm -rf target/

## Installation targets
install:
	cargo install --path .

install-hooks:
	@echo "Installing pre-commit hooks..."
	@mkdir -p .git/hooks
	@cp tooling/pre-commit.sh .git/hooks/pre-commit 2>/dev/null || true
	@chmod +x .git/hooks/pre-commit 2>/dev/null || true
	@echo "Pre-commit hooks installed!"

## Development targets
watch:
	cargo watch -x build -x test

check-miri:
	cargo +nightly miri test --all

## Docker targets
docker-build:
	docker build -t audio-scope-view:latest .

docker-run:
	docker run -p 8080:8080 audio-scope-view:latest

## Help
help:
	@echo "audio-scope-view Makefile targets:"
	@echo ""
	@echo "  === Build ==="
	@echo "  build        - Build the project (debug)"
	@echo "  release      - Build release version"
	@echo "  debug        - Build with debug logging"
	@echo ""
	@echo "  === Run ==="
	@echo "  run          - Run the server"
	@echo "  run-release  - Run release build"
	@echo "  watch        - Watch for changes and rebuild"
	@echo ""
	@echo "  === Test ==="
	@echo "  test         - Run unit tests"
	@echo "  test-all     - Run all tests with all features"
	@echo "  test-doc     - Run documentation tests"
	@echo "  test-quick   - Run tests without catching"
	@echo ""
	@echo "  === Lint ==="
	@echo "  fmt          - Format code"
	@echo "  fmt-check    - Check formatting (CI mode)"
	@echo "  clippy       - Run Clippy linter (CI mode)"
	@echo "  clippy-dev   - Run Clippy without warnings-as-errors"
	@echo "  clippy-fix   - Auto-fix Clippy warnings"
	@echo ""
	@echo "  === Checks ==="
	@echo "  check        - Run fmt, clippy, test (dev workflow)"
	@echo "  check-ci     - Run strict checks for CI"
	@echo "  check-all    - Run all checks including features"
	@echo ""
	@echo "  === Docs ==="
	@echo "  doc          - Generate documentation"
	@echo "  doc-open     - Generate and open docs"
	@echo ""
	@echo "  === Clean ==="
	@echo "  clean        - Clean build artifacts"
	@echo "  distclean    - Full clean including target dir"
	@echo ""
	@echo "  === Misc ==="
	@echo "  install      - Install binary via cargo"
	@echo "  help         - Show this help"
