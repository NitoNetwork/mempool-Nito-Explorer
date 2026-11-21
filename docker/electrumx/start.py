#!/usr/bin/env python3

import os
import sys
from urllib.parse import quote


def build_daemon_url(environment: dict[str, str]) -> str:
    host = environment.get("CORE_RPC_HOST", "").strip()
    username = environment.get("CORE_RPC_USERNAME", "")
    password = environment.get("CORE_RPC_PASSWORD", "")
    raw_port = environment.get("CORE_RPC_PORT", "")

    if not host or any(character in host for character in "/@"):
        raise ValueError("CORE_RPC_HOST is required and must be a host name or IP address")
    if not username or not password:
        raise ValueError("CORE_RPC_USERNAME and CORE_RPC_PASSWORD are required")
    try:
        port = int(raw_port)
    except ValueError as error:
        raise ValueError("CORE_RPC_PORT must be an integer") from error
    if not 1 <= port <= 65535:
        raise ValueError("CORE_RPC_PORT must be between 1 and 65535")

    normalized_host = host
    if ":" in host and not (host.startswith("[") and host.endswith("]")):
        normalized_host = f"[{host}]"

    encoded_username = quote(username, safe="")
    encoded_password = quote(password, safe="")
    return f"http://{encoded_username}:{encoded_password}@{normalized_host}:{port}/"


def main() -> None:
    try:
        os.environ["DAEMON_URL"] = build_daemon_url(os.environ)
    except ValueError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    os.execvp("electrumx_server", ["electrumx_server"])


if __name__ == "__main__":
    main()
