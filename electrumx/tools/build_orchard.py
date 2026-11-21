"""Build the audited Core FFI as a shared library without editing Core.

Usage: python tools/build_orchard.py CORE_CHECKOUT OUTPUT_DIRECTORY
The output directory must be outside the Core checkout. Never publish it.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

CORE_REVISION = '1786d96b8c8d122c38cff570379039934922f7b2'


def main():
    core, output = map(lambda p: Path(p).resolve(), sys.argv[1:])
    if output == core or core in output.parents:
        raise SystemExit('output must be outside Core')
    source = output / 'source'
    source.mkdir(parents=True, exist_ok=True)
    prefix = 'src/private/orchard_ffi/'
    names = subprocess.check_output(
        ['git', '-C', str(core), 'ls-tree', '-r', '--name-only', CORE_REVISION, prefix],
        text=True).splitlines()
    hashes = {}
    for name in names:
        data = subprocess.check_output(['git', '-C', str(core), 'show', f'{CORE_REVISION}:{name}'])
        hashes[name] = hashlib.sha256(data).hexdigest()
        path = source / name.removeprefix(prefix)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    manifest = source / 'Cargo.toml'
    manifest.write_text(manifest.read_text().replace(
        'crate-type = ["staticlib", "rlib"]', 'crate-type = ["cdylib", "rlib"]'))
    env = dict(os.environ, CARGO_BUILD_JOBS='2')
    subprocess.run(['cargo', 'build', '--locked', '--release', '--manifest-path', str(manifest),
                    '--target-dir', str(output / 'target')], env=env, check=True)
    (output / 'provenance.json').write_text(json.dumps(
        {'core_revision': CORE_REVISION, 'source_sha256': hashes,
         'only_change': 'crate-type: cdylib, rlib'}, indent=2) + '\n')


if __name__ == '__main__':
    main()
