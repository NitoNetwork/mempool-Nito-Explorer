"""Owned loopback-only processes for local qualification (never production)."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

import psutil

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'blockchain.nito.private.v2.'


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def electrum(port, method, *params):
    with socket.create_connection(('127.0.0.1', port), timeout=30) as sock:
        request = {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}
        sock.sendall(json.dumps(request).encode() + b'\n')
        with sock.makefile('rb') as reader:
            result = json.loads(reader.readline(4_000_000))
        if result.get('error'):
            raise ValueError(result['error'])
        return result['result']


def wait_for(callback, timeout=60):
    end = time.monotonic() + timeout
    last = None
    while time.monotonic() < end:
        try:
            value = callback()
            if value:
                return value
        except (OSError, ValueError, KeyError) as error:
            last = error
        time.sleep(.2)
    raise TimeoutError(f'wait timed out: {last}')


class Runtime:
    def __init__(self, core, output, network='regtest', source_node=None, extra=()):
        self.core, self.output, self.network = str(core), Path(output), network
        self.output.mkdir(parents=True, exist_ok=False)
        self.node_dir = self.output / 'node'
        if source_node:
            shutil.copytree(source_node, self.node_dir)
        else:
            self.node_dir.mkdir()
        self.rpc_port, self.tcp_port, self.admin_port = (free_port() for _ in range(3))
        self.password = secrets.token_hex(24)
        self.auth = base64.b64encode(('qa:' + self.password).encode()).decode()
        self.conf = self.node_dir / 'nito.conf'
        self.conf.write_text(f'rpcuser=qa\nrpcpassword={self.password}\n')
        self.logs, self.servers = [], []
        self.node = None
        self.extra = list(extra)

    def rpc(self, method, *params, wallet=False):
        suffix = ('wallet/' + (wallet if isinstance(wallet, str) else 'faucet')) if wallet else ''
        request = urllib.request.Request(f'http://127.0.0.1:{self.rpc_port}/{suffix}',
            json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode(),
            {'Authorization': 'Basic ' + self.auth, 'Content-Type': 'application/json'})
        try:
            response = urllib.request.urlopen(request, timeout=180)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            result = json.load(response)
        if result.get('error'):
            raise ValueError(result['error'])
        return result['result']

    def log(self, name):
        stream = open(self.output / name, 'w')
        self.logs.append(stream)
        return stream

    def __enter__(self):
        chain = {'mainnet': 'main', 'testnet': 'test'}.get(self.network, self.network)
        self.node = subprocess.Popen([self.core, f'-datadir={self.node_dir}', f'-chain={chain}', '-server',
            '-listen=0', '-connect=0', '-dnsseed=0', '-discover=0', '-txindex=1', '-orchardindex=0',
            '-coinstatsindex=1', '-dbcache=64', '-par=2', f'-rpcport={self.rpc_port}',
            '-fallbackfee=0.00002', '-keypool=20', *self.extra], stdout=self.log('core.log'), stderr=subprocess.STDOUT)
        try:
            wait_for(lambda: self.rpc('getblockchaininfo'))
        except BaseException:
            self.__exit__(None, None, None)
            raise
        return self

    def start_server(self, name='electrum', source=ROOT, db=None, diagnostic=False, overrides=None):
        db = Path(db or self.output / (name + '-db'))
        db.mkdir(exist_ok=True)
        env = dict(os.environ, PYTHONPATH=str(Path(source) / 'src'), COIN='Nito', NET=self.network,
            DB_DIRECTORY=str(db), DB_ENGINE='leveldb', DAEMON_URL=f'http://qa:{self.password}@127.0.0.1:{self.rpc_port}',
            SERVICES=f'tcp://127.0.0.1:{self.tcp_port},rpc://127.0.0.1:{self.admin_port}',
            PEER_DISCOVERY='OFF', PEER_ANNOUNCE='', CACHE_MB='16', ANON_LOGS='1', LOG_SESSIONS='0',
            LOG_FORMAT='%(levelname)s:%(name)s:%(message)s', MAX_SEND='4000000',
            DAEMON_POLL_INTERVAL_BLOCKS='100', DAEMON_POLL_INTERVAL_MEMPOOL='100', RAYON_NUM_THREADS='2')
        env.update(overrides or {})
        command = [sys.executable, '-m', 'electrumx.cli.electrumx_server']
        if diagnostic:
            command = [sys.executable, '-c',
                'import runpy,gc,sys,traceback; '
                'sys.unraisablehook=lambda e: traceback.print_exception(e.exc_type,e.exc_value,e.exc_traceback); '
                'runpy.run_module("electrumx.cli.electrumx_server",run_name="__main__"); '
                'print("COLLECT BEFORE FINALIZATION",flush=True); gc.collect()']
        server = subprocess.Popen(command, cwd=source, env=env, stdout=self.log(name + '.log'), stderr=subprocess.STDOUT)
        self.servers.append(server)
        return server

    def synced(self, timeout=180):
        def check():
            if self.servers and self.servers[-1].poll() is not None:
                raise RuntimeError('ElectrumX exited; see log')
            state = electrum(self.tcp_port, PREFIX + 'get_state')
            return state if state['block_hash'] == self.rpc('getbestblockhash') else None
        return wait_for(check, timeout)

    def stop_server(self, process):
        if process.poll() is None:
            try:
                electrum(self.admin_port, 'stop')
                process.wait(timeout=45)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                self.kill_server(process)

    def kill_server(self, process):
        """Kill the real interpreter as well as Windows' venv launcher."""
        if process.poll() is None:
            parent = psutil.Process(process.pid)
            children = parent.children(recursive=True)
            for child in reversed(children):
                try:
                    child.kill()
                except psutil.NoSuchProcess:
                    pass
            try:
                parent.kill()
            except psutil.NoSuchProcess:
                pass
            process.wait(timeout=20)
            psutil.wait_procs(children, timeout=20)

    def __exit__(self, *args):
        for server in self.servers:
            self.stop_server(server)
        if self.node is not None and self.node.poll() is None:
            try:
                self.rpc('stop')
                self.node.wait(timeout=45)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                self.node.terminate()
                self.node.wait(timeout=20)
        for log in self.logs:
            log.close()
        self.conf.unlink(missing_ok=True)


def digest_tree(path):
    return {str(p.relative_to(path)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in Path(path).rglob('*') if p.is_file()}
