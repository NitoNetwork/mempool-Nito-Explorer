#!/bin/sh

set -eu

backend_dir=${MEMPOOL_BACKEND_DIR:-/app/backend}
template_path=${MEMPOOL_CONFIG_TEMPLATE:-${backend_dir}/mempool-config.template.json}
config_path=${MEMPOOL_CONFIG_FILE:-${backend_dir}/cache/mempool-config.json}
renderer_path=${MEMPOOL_CONFIG_RENDERER:-/usr/local/lib/mempool-render-config.mjs}

cd "${backend_dir}"
mkdir -p "${MEMPOOL_CACHE_DIR:-./cache}"

node "${renderer_path}" "${template_path}" "${config_path}"

if [ "${MEMPOOL_CONFIG_ONLY:-false}" = "true" ]; then
  exit 0
fi

exec node --max-old-space-size=2048 /app/backend/dist/index.js
