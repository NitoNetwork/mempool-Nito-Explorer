#!/usr/bin/env python3
"""Build the pinned upstream Core library outside source Git, then bind its hash.

Run on the target Linux architecture for Docker:
python3 scripts/build-orchard.py CORE_CHECKOUT EXTERNAL_BUILD_DIRECTORY
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
AUDITED_PUBLIC_CORE_REFERENCE = '1d81bbd5f79d6b857c80420d5c81915ea326adff'
AUDITED_NATIVE_CRATE_TREE = '19f63b4fa2b293671e6e395233e6179e03a21fcf'
AUDITED_RUST_TOOLCHAIN = '1.97.0'


def export_sources(core, output):
    """Export the qualified public Core revision and verify its audited crate tree."""
    revision = AUDITED_PUBLIC_CORE_REFERENCE
    tree = subprocess.check_output(['git', '-C', str(core), 'rev-parse',
        revision + ':src/private/orchard_ffi'], text=True).strip()
    if tree != AUDITED_NATIVE_CRATE_TREE:
        raise SystemExit('Public Orchard source differs from the audited native crate')
    prefix = 'src/private/orchard_ffi/'
    names = subprocess.check_output(['git', '-C', str(core), 'ls-tree', '-r',
        '--name-only', revision, prefix], text=True).splitlines()
    if not names:
        raise SystemExit('Public Orchard crate is empty')
    source = output / 'source'
    # Reusing a Cargo target cache is safe; adding untracked source files is not.
    source.mkdir(parents=True, exist_ok=False)
    hashes = {}
    for name in names:
        data = subprocess.check_output(['git', '-C', str(core), 'show', f'{revision}:{name}'])
        hashes[name] = hashlib.sha256(data).hexdigest()
        path = source / name.removeprefix(prefix)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    manifest = source / 'Cargo.toml'
    original = manifest.read_bytes()
    before = b'crate-type = ["staticlib", "rlib"]'
    after = b'crate-type = ["cdylib", "rlib"]'
    if original.count(before) != 1:
        raise SystemExit('Audited crate-type declaration changed')
    manifest.write_bytes(original.replace(before, after))
    return source, hashes


def main():
    core, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
    if output == ROOT or ROOT in output.parents or output == core or core in output.parents:
        raise SystemExit('Build artifacts must remain outside both source repositories')
    subprocess.run([sys.executable, str(ROOT / 'scripts/vendor-electrumx.py'), '--check'], check=True)
    lock = json.loads((ROOT / 'electrumx-provenance.json').read_text())
    source, hashes = export_sources(core, output)
    # Same recipe as the pinned upstream builder, using its identical public tree.
    subprocess.run(['cargo', f'+{AUDITED_RUST_TOOLCHAIN}', 'build', '--locked', '--release', '--manifest-path', str(source / 'Cargo.toml'),
                    '--target-dir', str(output / 'target')], env=dict(os.environ, CARGO_BUILD_JOBS='2'), check=True)
    library = output / 'target/release/libnito_orchard_ffi.so'
    if not library.is_file():
        raise SystemExit('Docker requires the Linux .so built for its target architecture')
    provenance = {'core_revision': AUDITED_PUBLIC_CORE_REFERENCE,
                  'compatible_core_revision': AUDITED_PUBLIC_CORE_REFERENCE,
                  'electrumx_revision': lock['revision'],
                  'core_crate_tree': AUDITED_NATIVE_CRATE_TREE,
                  'rust_toolchain': AUDITED_RUST_TOOLCHAIN,
                  'source_sha256': hashes, 'only_change': 'crate-type: cdylib, rlib',
                  'library_sha256': hashlib.sha256(library.read_bytes()).hexdigest()}
    (output / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print(provenance['library_sha256'])


if __name__ == '__main__':
    main()
