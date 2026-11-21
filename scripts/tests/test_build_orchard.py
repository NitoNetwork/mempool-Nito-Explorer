"""Public-source provenance checks; the actual Cargo build is integration-tested."""
import hashlib
import json
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

BUILDER = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'build-orchard.py'))
EXPORT = BUILDER['export_sources']
GLOBALS = EXPORT.__globals__
PUBLIC = BUILDER['AUDITED_PUBLIC_CORE_REFERENCE']
LOCK = {'revision': 'a' * 40, 'core_revision': 'b' * 40, 'native_core_revision': 'c' * 40}
FILES = {'src/private/orchard_ffi/Cargo.toml': b'crate-type = ["staticlib", "rlib"]\n',
         'src/private/orchard_ffi/Cargo.lock': b'version = 3\n',
         'src/private/orchard_ffi/src/lib.rs': b'// public source\n'}


def public_git(args, **kwargs):
    """The helper only resolves the qualified public Core object."""
    if args[3] == 'rev-parse':
        assert args[4] == PUBLIC + ':src/private/orchard_ffi'
        return BUILDER['AUDITED_NATIVE_CRATE_TREE'] + '\n'
    if args[3] == 'ls-tree':
        assert args[6] == PUBLIC
        return '\n'.join(FILES) + '\n'
    if args[3] == 'show':
        revision, name = args[4].split(':', 1)
        assert revision == PUBLIC
        return FILES[name]
    raise AssertionError(args)


class PublicNativeBuild(unittest.TestCase):
    def test_exports_only_public_commit_and_preserves_original_hashes(self):
        with tempfile.TemporaryDirectory() as temp, patch('subprocess.check_output', side_effect=public_git):
            source, hashes = EXPORT(Path(temp) / 'core', Path(temp) / 'out')
            self.assertEqual(hashes, {name: hashlib.sha256(data).hexdigest() for name, data in FILES.items()})
            self.assertEqual((source / 'Cargo.toml').read_bytes(), b'crate-type = ["cdylib", "rlib"]\n')
            self.assertEqual((source / 'Cargo.lock').read_bytes(), FILES['src/private/orchard_ffi/Cargo.lock'])

    def test_rejects_a_different_public_crate_before_exporting(self):
        with tempfile.TemporaryDirectory() as temp, patch('subprocess.check_output', return_value='0' * 40):
            output = Path(temp) / 'out'
            with self.assertRaisesRegex(SystemExit, 'differs'):
                EXPORT(Path(temp) / 'core', output)
            self.assertFalse(output.exists())

    def test_does_not_build_over_untracked_source_files(self):
        with tempfile.TemporaryDirectory() as temp, patch('subprocess.check_output', side_effect=public_git):
            output = Path(temp) / 'out'
            (output / 'source').mkdir(parents=True)
            with self.assertRaises(FileExistsError):
                EXPORT(Path(temp) / 'core', output)

    def test_records_actual_public_source_and_preserves_upstream_build_recipe(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'repo'
            root.mkdir()
            (root / 'electrumx-provenance.json').write_text(json.dumps(LOCK))
            output = Path(temp) / 'out'
            library = output / 'target/release/libnito_orchard_ffi.so'
            library.parent.mkdir(parents=True)
            library.write_bytes(b'integration build supplies the actual library')
            with patch.dict(GLOBALS, {'ROOT': root}), patch('sys.argv', ['build-orchard.py', str(Path(temp) / 'core'), str(output)]), \
                    patch('subprocess.check_output', side_effect=public_git), patch('subprocess.run') as run:
                BUILDER['main']()
            cargo = run.call_args_list[1]
            self.assertEqual(cargo.args[0][:5], ['cargo', '+1.97.0', 'build', '--locked', '--release'])
            self.assertEqual(cargo.kwargs['env']['CARGO_BUILD_JOBS'], '2')
            provenance = json.loads((output / 'provenance.json').read_text())
            self.assertEqual(provenance['core_revision'], PUBLIC)
            self.assertEqual(provenance['compatible_core_revision'], PUBLIC)
            self.assertEqual(provenance['electrumx_revision'], LOCK['revision'])
            self.assertNotIn('upstream_native_reference', provenance)
            self.assertEqual(provenance['core_crate_tree'], BUILDER['AUDITED_NATIVE_CRATE_TREE'])
            self.assertEqual(provenance['rust_toolchain'], BUILDER['AUDITED_RUST_TOOLCHAIN'])
            self.assertEqual(provenance['library_sha256'], hashlib.sha256(library.read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
