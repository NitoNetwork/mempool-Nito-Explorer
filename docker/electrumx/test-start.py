import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("start.py")
SPEC = importlib.util.spec_from_file_location("nito_electrumx_start", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DaemonUrlTests(unittest.TestCase):
    def test_credentials_are_url_encoded(self):
        url = MODULE.build_daemon_url({
            "CORE_RPC_HOST": "core",
            "CORE_RPC_PORT": "18886",
            "CORE_RPC_USERNAME": "user@example",
            "CORE_RPC_PASSWORD": "p!&\\\"line\nnext:/",
        })
        self.assertEqual(
            url,
            "http://user%40example:p%21%26%5C%22line%0Anext%3A%2F@core:18886/",
        )

    def test_ipv6_host_is_bracketed(self):
        url = MODULE.build_daemon_url({
            "CORE_RPC_HOST": "::1",
            "CORE_RPC_PORT": "18886",
            "CORE_RPC_USERNAME": "user",
            "CORE_RPC_PASSWORD": "password",
        })
        self.assertEqual(url, "http://user:password@[::1]:18886/")

    def test_missing_password_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "USERNAME and CORE_RPC_PASSWORD"):
            MODULE.build_daemon_url({
                "CORE_RPC_HOST": "core",
                "CORE_RPC_PORT": "18886",
                "CORE_RPC_USERNAME": "user",
                "CORE_RPC_PASSWORD": "",
            })

    def test_invalid_port_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "between 1 and 65535"):
            MODULE.build_daemon_url({
                "CORE_RPC_HOST": "core",
                "CORE_RPC_PORT": "70000",
                "CORE_RPC_USERNAME": "user",
                "CORE_RPC_PASSWORD": "password",
            })


if __name__ == "__main__":
    unittest.main()
