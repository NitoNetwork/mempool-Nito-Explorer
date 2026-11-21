FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS builder

RUN apt-get update && apt-get install -y python3 make g++ rsync && rm -rf /var/lib/apt/lists/*

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-install-links

COPY frontend/ ./
COPY frontend/mempool-frontend-config.sample.json ./mempool-frontend-config.json
ARG NITO_NETWORK=mainnet
ARG DOCKER_COMMIT_HASH
RUN node -e 'const fs=require("fs"), p="mempool-frontend-config.json", c=JSON.parse(fs.readFileSync(p)), n=process.env.NITO_NETWORK; if(!["mainnet","testnet","signet","regtest"].includes(n)) throw Error("Invalid Nito network"); c.ROOT_NETWORK=n==="mainnet"?"":n; for(const k of ["mainnet","testnet","signet","regtest"]) c[k.toUpperCase()+"_ENABLED"]=k===n; fs.writeFileSync(p,JSON.stringify(c));'

# The public image ships only the independently qualified English interface.
RUN npm run build:public

# --- Production image ---
FROM nginx:1.30.7-alpine@sha256:caf4e1e032a20f9c3c5e28fc7f25ffd768ad8677b4975c54193075997b3a97e3

# Copy built frontend
COPY --from=builder /app/frontend/dist/mempool/browser /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
