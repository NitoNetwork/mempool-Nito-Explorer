FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    COIN=Nito \
    NET=mainnet \
    DB_DIRECTORY=/data/electrumx \
    DB_ENGINE=leveldb \
    SERVICES=tcp://0.0.0.0:51001,rpc://127.0.0.1:8000 \
    REPORT_SERVICES="" \
    PEER_DISCOVERY=off \
    PEER_ANNOUNCE="" \
    CACHE_MB=512 \
    LOG_LEVEL=info

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        libleveldb-dev \
        libsnappy-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/nito-explorer

COPY --from=orchard_library /target/release/libnito_orchard_ffi.so /opt/orchard/libnito_orchard_ffi.so
COPY --from=orchard_library /provenance.json /opt/orchard/provenance.json
ENV NITO_ORCHARD_LIBRARY=/opt/orchard/libnito_orchard_ffi.so

COPY electrumx/ ./electrumx/
COPY electrumx-provenance.json ./
COPY scripts/vendor-electrumx.py scripts/build-orchard.py ./scripts/
COPY docker/electrumx/requirements.lock /opt/requirements.lock
COPY docker/electrumx/start.py /usr/local/bin/nito-electrumx-start.py

RUN python scripts/vendor-electrumx.py --check
RUN python -c 'import json,hashlib,ctypes,runpy; p=json.load(open("/opt/orchard/provenance.json")); lock=json.load(open("electrumx-provenance.json")); audit=runpy.run_path("scripts/build-orchard.py"); assert p["core_revision"]==audit["AUDITED_PUBLIC_CORE_REFERENCE"]; assert p["compatible_core_revision"]==audit["AUDITED_PUBLIC_CORE_REFERENCE"]; assert p["electrumx_revision"]==lock["revision"]; assert p["core_crate_tree"]==audit["AUDITED_NATIVE_CRATE_TREE"]; assert p["rust_toolchain"]==audit["AUDITED_RUST_TOOLCHAIN"]; assert hashlib.sha256(open("/opt/orchard/libnito_orchard_ffi.so","rb").read()).hexdigest()==p["library_sha256"]; ctypes.CDLL("/opt/orchard/libnito_orchard_ffi.so")'

WORKDIR /opt/nito-explorer/electrumx

RUN cp -a . /tmp/electrumx-package \
    && python -m pip install --no-cache-dir -c /opt/requirements.lock /tmp/electrumx-package \
    && rm -rf /tmp/electrumx-package \
    && python /opt/nito-explorer/scripts/vendor-electrumx.py --check

RUN groupadd --gid 10001 electrumx \
    && useradd --uid 10001 --gid electrumx --home-dir /data/electrumx --no-create-home electrumx \
    && mkdir -p /data/electrumx \
    && chown electrumx:electrumx /data/electrumx

USER 10001:10001
VOLUME ["/data/electrumx"]

EXPOSE 51001 8000

ENTRYPOINT ["python", "/usr/local/bin/nito-electrumx-start.py"]
