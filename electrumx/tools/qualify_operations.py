"""Reconstruct an old index on an isolated archival chain, then migrate by replay."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import threading
import time

import psutil
import plyvel
from nito_qa_runtime import ROOT, Runtime, PREFIX, digest_tree, electrum, wait_for

OLD_REVISION = 'c25a4b65e123ae1a7c83b08251877b293cf11de7'
ORCHARD_EXACT = {b'OV', b'OS', b'OR', b'OD', b'QS'}
ORCHARD_PREFIXES = (b'QB', b'QN', b'QC', b'OB', b'ON')


def logical_db(path, orchard=False):
    with plyvel.DB(str(path)) as db:
        items = dict(db)
    if orchard:
        items = {key: value for key, value in items.items()
                 if key not in ORCHARD_EXACT
                 and not any(key.startswith(prefix) for prefix in ORCHARD_PREFIXES)}
    return items


class Monitor:
    def __init__(self, process):
        self.process = psutil.Process(process.pid)
        self.stop = threading.Event()
        self.result = {'peak_rss_bytes': 0, 'cpu_seconds': 0, 'samples': 0, 'includes_native_allocations': True}
        self.start = time.monotonic()
        self.thread = threading.Thread(target=self.run)
        self.thread.start()

    def run(self):
        while not self.stop.wait(.02):
            try:
                processes = [self.process] + self.process.children(recursive=True)
                rss = sum(p.memory_info().rss for p in processes)
                cpu = sum(p.cpu_times().user + p.cpu_times().system for p in processes)
                self.result['peak_rss_bytes'] = max(self.result['peak_rss_bytes'], rss)
                self.result['cpu_seconds'] = max(self.result['cpu_seconds'], cpu)
                self.result['samples'] += 1
            except psutil.NoSuchProcess:
                break

    def finish(self):
        self.stop.set()
        self.thread.join()
        self.result['wall_seconds'] = round(time.monotonic() - self.start, 3)
        return self.result


def snapshot(runtime):
    state = runtime.synced()
    pages = []
    cursor = state.get('activation_height', 0)
    first_height = cursor
    actions = 0
    while cursor <= state['height']:
        page = electrum(runtime.tcp_port, PREFIX + 'get_compact_range', cursor, 1000, state['block_hash'])
        assert page['start_height'] == cursor and page['next_height'] > cursor
        pages.extend(page['blocks'])
        actions += sum(len(b['actions']) for b in page['blocks'])
        cursor = page['next_height']
    assert len(pages) == state['height'] - first_height + 1 and actions == state['action_count']
    witnesses = [electrum(runtime.tcp_port, PREFIX + 'get_witness', p, state['block_hash'])
                 for p in sorted(set((0, actions // 2, actions - 1))) if actions]
    return {'state': state, 'compact_sha256': hashlib.sha256(json.dumps(pages, sort_keys=True).encode()).hexdigest(),
            'witnesses': witnesses, 'pools': electrum(runtime.tcp_port, 'blockchain.nito.get_orchard_pools')}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--core', required=True)
    p.add_argument('--source-node', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--blocks', type=int, default=20000)
    p.add_argument('--network', choices=['regtest','testnet'], default='regtest')
    p.add_argument('--skip-legacy', action='store_true', help='long replay only; run untouched old software on testnet separately')
    a = p.parse_args()
    original = digest_tree(a.source_node)
    report = {'old_revision': OLD_REVISION, 'history_origin': str(a.source_node),
              'production_migration': False, 'checks': [], 'metrics': {}}
    if a.network != 'regtest' and a.blocks:
        p.error('additional mining here is regtest only')
    with Runtime(a.core, a.output, a.network, source_node=a.source_node) as r:
        try:
            old = r.output / 'old-source'
            old.mkdir()
            with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git', '-C', str(ROOT), 'archive', OLD_REVISION]))) as archive:
                archive.extractall(old, filter='data')
            if a.blocks:
                r.rpc('createwallet', 'history-faucet')
                address = r.rpc('getnewaddress', wallet='history-faucet')
            for _ in range(0, a.blocks, 1000):
                r.rpc('generatetoaddress', min(1000, a.blocks - _), address)
                print('mined history', r.rpc('getblockcount'), flush=True)
            report['height'] = r.rpc('getblockcount')
            report['chain_transactions'] = r.rpc('getchaintxstats')['txcount']
            if not a.skip_legacy:
                def old_synced():
                    if server.poll() is not None:
                        raise RuntimeError('old server exited; inspect old.log')
                    return electrum(r.tcp_port, 'blockchain.headers.subscribe')['height'] == report['height']
                server = r.start_server('old', source=old)
                mon = Monitor(server)
                wait_for(old_synced, 300)
                old_state = electrum(r.tcp_port, 'blockchain.nito.private.get_state')
                report['old_state'] = old_state
                r.stop_server(server)
                report['metrics']['old_index'] = mon.finish()
                legacy_copy = r.output / 'legacy-copy'
                shutil.copytree(r.output / 'old-db', legacy_copy)
                transparent_before = logical_db(legacy_copy / 'utxo', orchard=True)
                history_before = logical_db(legacy_copy / 'hist')
                server = r.start_server('migration-in-place', db=legacy_copy)
                mon = Monitor(server)
                migrated = snapshot(r)
                r.stop_server(server)
                report['metrics']['migration_in_place'] = mon.finish()
                assert logical_db(legacy_copy / 'utxo', orchard=True) == transparent_before
                assert logical_db(legacy_copy / 'hist') == history_before
                report['checks'].append(
                    'old Orchard schema repaired in place without changing transparent UTXOs or history')
            server = r.start_server('fresh')
            mon = Monitor(server)
            expected = snapshot(r)
            # Confirm the Rust DLL is mapped into the measured process.
            parent = psutil.Process(server.pid)
            report['native_library_mapped'] = any('nito_orchard_ffi' in m.path.lower()
                for process in [parent] + parent.children(recursive=True) for m in process.memory_maps())
            assert report['native_library_mapped']
            r.stop_server(server)
            report['metrics']['fresh_index'] = mon.finish()
            report['checks'].append('full archival reconstruction with transparent and Orchard history')
            if not a.skip_legacy:
                assert migrated == expected
                report['checks'].append('Orchard-only migration equals a fresh Orchard index')
            if report['height'] > 1000:
                repair_db = r.output / 'orchard-repair-db'
                shutil.copytree(r.output / 'fresh-db', repair_db)
                repair_token = 'qualification-orchard-repair-v1'
                server = r.start_server('orchard-repair-interrupted', db=repair_db,
                                        overrides={'NITO_ORCHARD_REPAIR': repair_token})
                repair_log = r.output / 'orchard-repair-interrupted.log'
                wait_for(lambda: 'Orchard-only repair from height' in repair_log.read_text(), 60)
                time.sleep(.5)
                r.kill_server(server)
                with plyvel.DB(str(repair_db / 'utxo')) as repair_storage:
                    interrupted_state = json.loads(repair_storage.get(b'OS'))
                    assert repair_storage.get(b'OR') is not None
                assert expected['state']['activation_height'] <= interrupted_state['height'] < report['height']
                server = r.start_server('orchard-repair-resumed', db=repair_db,
                                        overrides={'NITO_ORCHARD_REPAIR': repair_token})
                repaired = snapshot(r)
                assert repaired == expected
                r.stop_server(server)
                report['orchard_repair_interrupted_height'] = interrupted_state['height']
                report['checks'].append(
                    'operator Orchard-only reset resumes from its last durable checkpoint')
            resumed_db = r.output / 'resumed-db'
            for attempt in range(2):
                server = r.start_server(f'interrupted-{attempt}', db=resumed_db)
                wait_for(lambda: (r.output / f'interrupted-{attempt}.log').read_text().find('height:') >= 0, 60)
                time.sleep(.15)
                if attempt == 0:
                    r.stop_server(server)
                else:
                    r.kill_server(server)
            server = r.start_server('resumed', db=resumed_db)
            mon = Monitor(server)
            actual = snapshot(r)
            assert actual == expected
            r.stop_server(server)
            report['metrics']['resumed_index'] = mon.finish()
            report['checks'].append('graceful interruption and process kill followed by replay equal a fresh index')
            report['snapshot'] = expected
            report['database_bytes'] = sum(f.stat().st_size for f in (r.output / 'fresh-db').rglob('*') if f.is_file())
            assert digest_tree(a.source_node) == original
            report['checks'].append('original archival source left byte-for-byte unchanged')
            report['result'] = 'passed'
        except BaseException as error:
            report['result'] = 'failed'
            report['error'] = repr(error)
            raise
        finally:
            (r.output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
