FROM debian:trixie-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  rclone \
  curl \
  bash \
  ca-certificates \
  git \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Switch to non-root user
USER appuser

# Set up PATH for viteplus
ENV PATH="/home/appuser/.vite-plus/bin:$PATH"

# Install viteplus
RUN curl -fsSL https://vite.plus | bash

WORKDIR /app

# Copy all files with correct ownership
COPY --chown=appuser:appuser . .

# Install dependencies
RUN vp install

# Build
RUN vp run build -r

# Use the worker CLI as entrypoint via vp exec
ENTRYPOINT ["/home/appuser/.vite-plus/bin/vp", "exec", "node", "apps/worker/dist/cli.mjs"]
