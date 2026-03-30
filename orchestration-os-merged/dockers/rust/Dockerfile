FROM rust:1.77-slim

# Install system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl bash vim nano jq \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install evcxr REPL for interactive Rust
RUN cargo install evcxr_repl

# Install Rust AI crates
RUN cargo install \
    assistant \
    cargo-audit \
    cargo-expand

WORKDIR /app

COPY agent.rs /app/agent.rs

EXPOSE 8888

CMD ["cargo", "run", "--release", "--manifest-path", "/app/Cargo.toml"]
