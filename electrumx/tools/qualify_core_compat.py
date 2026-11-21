"""Qualify one transparent ElectrumX DB across Nito Core v3 and v4.

All processes are loopback-only and owned by this script.  No production
service or public network is contacted.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

import psutil

from nito_qa_runtime import electrum, free_port, wait_for


class Scenario:
    def __init__(self, args):
        self.args = args
        self.output = args.output.resolve()
        self.output.mkdir(parents=True, exist_ok=False)
        self.node_dir = self.output / 'node'
        self.node_dir.mkdir()
        self.db_dir = self.output / 'electrum-db'
        self.db_dir.mkdir()
        self.rpc_port, self.tcp_port, self.admin_port = (free_port() for _ in range(3))
        self.password = secrets.token_hex(24)
        self.auth = base64.b64encode(f'qa:{self.password}'.encode()).decode()
        (self.node_dir / 'nito.conf').write_text(
            f'rpcuser=qa\nrpcpassword={self.password}\n', encoding='ascii')
        self.core = None
        self.server = None
        self.logs = []

    def log(self, name):
        stream = open(self.output / name, 'w', encoding='utf-8')
        self.logs.append(stream)
        return stream

    def rpc(self, method, *params, wallet=None):
        suffix = f'wallet/{wallet}' if wallet else ''
        request = urllib.request.Request(
            f'http://127.0.0.1:{self.rpc_port}/{suffix}',
            json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method,
                        'params': params}).encode(),
            {'Authorization': 'Basic ' + self.auth,
             'Content-Type': 'application/json'})
        try:
            response = urllib.request.urlopen(request, timeout=120)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            result = json.load(response)
        if result.get('error'):
            raise ValueError(result['error'])
        return result['result']

    def start_core(self, binary, v4, name):
        command = [str(binary), f'-datadir={self.node_dir}', '-regtest', '-server',
                   '-listen=0', '-connect=0', '-dnsseed=0', '-discover=0',
                   '-txindex=1', '-coinstatsindex=1', '-dbcache=64', '-par=2',
                   f'-rpcport={self.rpc_port}', '-fallbackfee=0.00002']
        if v4:
            command.append('-orchardindex=0')
        self.core = subprocess.Popen(command, stdout=self.log(name + '.log'),
                                     stderr=subprocess.STDOUT)
        wait_for(lambda: self.rpc('getblockchaininfo'), 90)

    def stop_core(self):
        if self.core and self.core.poll() is None:
            try:
                self.rpc('stop')
                self.core.wait(timeout=45)
            except Exception:
                self.kill(self.core)
        self.core = None

    @staticmethod
    def kill(process):
        if process and process.poll() is None:
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

    def start_electrum(self, name, orchard_library=None, repair_token=''):
        env = dict(os.environ, PYTHONPATH=str(self.args.source / 'src'),
                   COIN='Nito', NET='regtest', DB_DIRECTORY=str(self.db_dir),
                   DB_ENGINE='leveldb',
                   DAEMON_URL=f'http://qa:{self.password}@127.0.0.1:{self.rpc_port}',
                   SERVICES=f'tcp://127.0.0.1:{self.tcp_port},rpc://127.0.0.1:{self.admin_port}',
                   PEER_DISCOVERY='OFF', PEER_ANNOUNCE='', CACHE_MB='16',
                   ANON_LOGS='1', LOG_SESSIONS='0',
                   LOG_FORMAT='%(levelname)s:%(name)s:%(message)s',
                   DAEMON_POLL_INTERVAL_BLOCKS='100',
                   DAEMON_POLL_INTERVAL_MEMPOOL='100', RAYON_NUM_THREADS='2')
        env.pop('NITO_ORCHARD_LIBRARY', None)
        if orchard_library:
            env['NITO_ORCHARD_LIBRARY'] = str(orchard_library)
        if repair_token:
            env['NITO_ORCHARD_REPAIR'] = repair_token
        self.server = subprocess.Popen(
            [sys.executable, '-m', 'electrumx.cli.electrumx_server'],
            cwd=self.args.source, env=env, stdout=self.log(name + '.log'),
            stderr=subprocess.STDOUT)

    def stop_electrum(self):
        if self.server and self.server.poll() is None:
            try:
                electrum(self.admin_port, 'stop')
                self.server.wait(timeout=45)
            except Exception:
                self.kill(self.server)
        self.server = None

    def wait_height(self, height):
        def check():
            if self.server.poll() is not None:
                raise RuntimeError('ElectrumX exited; inspect its log')
            return electrum(self.tcp_port, 'blockchain.headers.subscribe')['height'] == height
        wait_for(check, 180)

    def transparent_snapshot(self, script_hash):
        return {
            'header': electrum(self.tcp_port, 'blockchain.headers.subscribe'),
            'balance': electrum(self.tcp_port, 'blockchain.scripthash.get_balance', script_hash),
            'history': electrum(self.tcp_port, 'blockchain.scripthash.get_history', script_hash),
            'unspent': electrum(self.tcp_port, 'blockchain.scripthash.listunspent', script_hash),
        }

    def close(self):
        self.stop_electrum()
        self.stop_core()
        for stream in self.logs:
            stream.close()
        (self.node_dir / 'nito.conf').unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--core-v3', type=Path, required=True)
    parser.add_argument('--core-v4', type=Path, required=True)
    parser.add_argument('--orchard-library', type=Path, required=True)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    scenario = Scenario(args)
    report = {'result': 'failed', 'checks': [], 'production': False}
    try:
        scenario.start_core(args.core_v3, False, 'core-v3')
        scenario.rpc('createwallet', 'faucet')
        address = scenario.rpc('getnewaddress', '', 'legacy', wallet='faucet')
        scenario.rpc('generatetoaddress', 105, address)
        script = bytes.fromhex(scenario.rpc('getaddressinfo', address, wallet='faucet')['scriptPubKey'])
        script_hash = hashlib.sha256(script).digest()[::-1].hex()
        height = scenario.rpc('getblockcount')
        scenario.start_electrum('electrum-v3')
        scenario.wait_height(height)
        v3_private = electrum(scenario.tcp_port, 'blockchain.nito.private.v2.get_state')
        assert v3_private['mode'] == 'transparent' and not v3_private['available']
        before = scenario.transparent_snapshot(script_hash)
        scenario.stop_electrum()
        scenario.stop_core()
        report['checks'].append('Core v3 opens and serves the existing transparent protocol without Rust')

        scenario.start_core(args.core_v4, True, 'core-v4')
        pools = scenario.rpc('getorchardpools')
        scenario.start_electrum('electrum-v4', args.orchard_library)
        scenario.wait_height(height)
        after = scenario.transparent_snapshot(script_hash)
        state = electrum(scenario.tcp_port, 'blockchain.nito.private.v2.get_state')
        assert before == after
        assert state['height'] == height and state['action_count'] == 0
        assert state['activation_height'] == pools['privateTxActivationHeight']
        report['checks'].append('same transparent DB is preserved while Orchard alone replays from activation')
        scenario.stop_electrum()

        token = 'qa-forced-repair-v1'
        scenario.start_electrum('electrum-v4-forced-repair', args.orchard_library, token)
        scenario.wait_height(height)
        repaired = scenario.transparent_snapshot(script_hash)
        repaired_state = electrum(scenario.tcp_port, 'blockchain.nito.private.v2.get_state')
        assert repaired == before and repaired_state == state
        report['checks'].append('operator Orchard-only reset preserves transparent responses')
        scenario.stop_electrum()
        report.update({
            'result': 'passed', 'height': height,
            'activation_height': pools['privateTxActivationHeight'],
            'v3_private_state': v3_private, 'v4_private_state': state,
            'script_hash': script_hash, 'owned_processes_stopped': True,
        })
    except BaseException as error:
        report['error'] = repr(error)
        raise
    finally:
        scenario.close()
        report['owned_processes_stopped'] = True
        (scenario.output / 'result.json').write_text(
            json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
