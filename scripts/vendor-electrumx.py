#!/usr/bin/env python3
"""Import an explicitly validated ElectrumX commit, or verify every vendored byte.

The receipt is operator evidence, supplied separately from the source repository:
{"revision": "<40 hex>", "core_revision": "<40 hex>", "status": "validated"}.
This utility never selects main and never interprets a successful import as tests.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'electrumx'
LOCK = ROOT / 'electrumx-provenance.json'


def hashes(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()}


def check():
    lock = json.loads(LOCK.read_text())
    if lock['validation'] != 'validated' or not re.fullmatch('[0-9a-f]{40}', lock.get('revision') or ''):
        raise SystemExit('No validated ElectrumX revision is pinned. Integration is not qualified.')
    if not lock['files'] or hashes(DEST) != lock['files']:
        raise SystemExit('Vendored ElectrumX differs from its validated manifest.')
    print(lock['revision'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--receipt', type=Path)
    parser.add_argument('--core-revision', help='Explicitly select a new validated Core compatibility reference')
    args = parser.parse_args()
    if args.check:
        check()
        return
    if not args.source or not args.receipt:
        parser.error('--source and --receipt are required')
    receipt = json.loads(args.receipt.read_text())
    sha = receipt.get('revision', '')
    if receipt.get('status') != 'validated' or not re.fullmatch('[0-9a-f]{40}', sha):
        raise SystemExit('A validated exact-commit receipt is required')
    target_core = args.core_revision or json.loads(LOCK.read_text())['core_revision']
    if not re.fullmatch('[0-9a-f]{40}', target_core) or receipt.get('core_revision') != target_core:
        raise SystemExit('Receipt targets a different Core revision')
    dirty = subprocess.check_output(['git', '-C', str(ROOT), 'status', '--porcelain', '--', 'electrumx'], text=True)
    if dirty:
        raise SystemExit('Preserve local ElectrumX edits before importing')
    actual = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', sha + '^{commit}'], text=True).strip()
    if actual != sha:
        raise SystemExit('Commit does not resolve exactly')
    archive = subprocess.check_output(['git', '-C', str(args.source), 'archive', sha])
    with tempfile.TemporaryDirectory(prefix='nito-electrumx-') as temp:
        staging = Path(temp) / 'source'
        staging.mkdir()
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(staging, filter='data')
        builder = (staging / 'tools/build_orchard.py').read_text()
        native_revision = re.search(r"CORE_REVISION = '([0-9a-f]{40})'", builder)
        if not native_revision:
            raise SystemExit('Upstream native builder has no exact Core revision')
        manifest = {'repository': 'https://github.com/NitoNetwork/electrumx-NITO',
                    'revision': sha, 'core_revision': receipt['core_revision'],
                    'native_core_revision': native_revision.group(1),
                    'git_archive_sha256': hashlib.sha256(archive).hexdigest(),
                    'validation': 'validated', 'files': hashes(staging)}
        # The destination is a fixed child of this checkout, never user supplied.
        if DEST.resolve().parent != ROOT.resolve() or DEST.is_symlink():
            raise SystemExit('Unsafe vendor destination')
        backup = ROOT / '.electrumx-import-backup'
        if backup.exists():
            raise SystemExit('An earlier import backup exists; inspect it first')
        original_lock = LOCK.read_bytes()
        DEST.rename(backup)
        try:
            shutil.copytree(staging, DEST)
            LOCK.write_text(json.dumps(manifest, indent=2) + '\n')
            check()
        except BaseException:
            if DEST.exists():
                shutil.rmtree(DEST)
            backup.rename(DEST)
            LOCK.write_bytes(original_lock)
            raise
        shutil.rmtree(backup)


if __name__ == '__main__':
    main()
