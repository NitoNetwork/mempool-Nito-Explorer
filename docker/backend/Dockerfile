FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS builder

# Install build dependencies for rust-gbt
RUN apt-get update && apt-get install -y \
    python3 make g++ cmake curl \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- \
       -y --profile minimal --default-toolchain 1.84.1 \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy rust GBT module first (for caching)
COPY rust/ /app/rust/

# Copy backend
COPY backend/package.json backend/package-lock.json /app/backend/
WORKDIR /app/backend
RUN npm ci --omit=dev --no-install-links

COPY backend/ /app/backend/
RUN npm run build

# --- Production image ---
FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

WORKDIR /app/backend

COPY --from=builder --chown=node:node /app/backend/dist /app/backend/dist
COPY --from=builder --chown=node:node /app/backend/node_modules /app/backend/node_modules
COPY --from=builder --chown=node:node /app/backend/package.json /app/backend/package.json
COPY --from=builder --chown=node:node /app/backend/rust-gbt /app/backend/rust-gbt
COPY --chown=node:node docker/backend/mempool-config.json /app/backend/mempool-config.template.json
COPY docker/backend/render-config.mjs /usr/local/lib/mempool-render-config.mjs
COPY docker/backend/start.sh /usr/local/bin/mempool-backend-start

RUN install -d -o node -g node /app/backend/cache \
    && chmod 0755 /usr/local/bin/mempool-backend-start \
    && chmod 0644 /usr/local/lib/mempool-render-config.mjs

USER node

EXPOSE 8999

ENTRYPOINT ["/usr/local/bin/mempool-backend-start"]
