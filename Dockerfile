FROM alpine

# Install system dependencies
RUN apk add --no-cache \
  rclone \
  curl \
  bash

# Install viteplus
RUN curl -fsSL https://vite.plus | bash

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages packages
COPY apps apps

# Install dependencies
RUN vp install

# Build
RUN vp run build -r

# Use the worker CLI as entrypoint via vp exec
ENTRYPOINT ["vp", "exec", "node", "apps/worker/dist/cli.mjs"]
