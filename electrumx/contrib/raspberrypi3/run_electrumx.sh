#!/bin/sh
###############
# run_electrumx
###############

# configure Nito ElectrumX
export COIN=Nito
export DAEMON_URL=http://CHANGE_ME_RPC_USER:CHANGE_ME_RPC_PASSWORD@127.0.0.1:8825/
export NET=mainnet
export CACHE_MB=400
export DB_DIRECTORY=/home/nito/.electrumx/db
export SSL_CERTFILE=/home/nito/.electrumx/certfile.crt
export SSL_KEYFILE=/home/nito/.electrumx/keyfile.key
export BANNER_FILE=/home/nito/.electrumx/banner
export DONATION_ADDRESS=

# connectivity
export HOST=
export TCP_PORT=50001
export SSL_PORT=50002

# visibility
export REPORT_HOST=electrum.example.com
export RPC_PORT=8000

# run Nito ElectrumX
ulimit -n 10000
/usr/local/bin/electrumx_server 2>> /home/nito/.electrumx/electrumx.log >> /home/nito/.electrumx/electrumx.log &

######################
# auto-start electrumx
######################

# add this line to crontab -e
# @reboot /path/to/run_electrumx.sh
