# Build from the repository root:
# docker build -f contrib/Dockerfile -t nito-electrumx .

FROM python:3.12-bookworm

WORKDIR /usr/src/electrumx

RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        build-essential libleveldb-dev \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN python -m venv /opt/electrumx \
    && /opt/electrumx/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/electrumx/bin/pip install --no-cache-dir .[rapidjson]

ENV SERVICES="tcp://:50001"
ENV COIN=Nito
ENV NET=mainnet
ENV DB_DIRECTORY=/var/lib/nito-electrumx
ENV DAEMON_URL="http://CHANGE_ME_RPC_USER:CHANGE_ME_RPC_PASSWORD@127.0.0.1:8825/"
ENV ALLOW_ROOT=true
ENV DB_ENGINE=leveldb
ENV MAX_SEND=10000000
ENV BANDWIDTH_UNIT_COST=50000
ENV CACHE_MB=2000

VOLUME /var/lib/nito-electrumx

RUN mkdir -p "$DB_DIRECTORY"

CMD ["/opt/electrumx/bin/electrumx_server"]
