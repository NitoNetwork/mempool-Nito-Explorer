#!/usr/bin/env python3
"""ElectrumX Monitor for Nito Network"""

import asyncio
import json
import ssl
import socket
import time
import websockets
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path

SERVERS = [
    {"name": "electrum1.nito.network - TCP", "host": "electrum1.nito.network", "port": 50001, "protocol": "TCP"},
    {"name": "electrum1.nito.network - SSL", "host": "electrum1.nito.network", "port": 50003, "protocol": "SSL"},
    {"name": "electrum1.nito.network - WSS", "host": "electrum1.nito.network", "port": 50005, "protocol": "WSS"},
    {"name": "electrum1.nitopool.online - TCP", "host": "electrum1.nitopool.online", "port": 50001, "protocol": "TCP"},
    {"name": "electrum1.nitopool.online - SSL", "host": "electrum1.nitopool.online", "port": 50003, "protocol": "SSL"},
    {"name": "electrum1.nitopool.online - WSS", "host": "electrum1.nitopool.online", "port": 50005, "protocol": "WSS"},
]

status_cache = {"servers": [], "last_check": None, "block_height": None}


def check_tcp(host, port, timeout=10):
    start = time.time()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((host, port))
        req = json.dumps({"id": 1, "method": "server.version", "params": ["NitoMonitor", "1.4"]}) + "\n"
        s.sendall(req.encode())
        data = s.recv(4096).decode()
        resp = json.loads(data)
        elapsed = round((time.time() - start) * 1000)

        version = resp.get("result", [None, None])[0] if resp.get("result") else None

        # Get block height
        req2 = json.dumps({"id": 2, "method": "blockchain.headers.subscribe", "params": []}) + "\n"
        s.sendall(req2.encode())
        data2 = s.recv(4096).decode()
        resp2 = json.loads(data2)
        height = resp2.get("result", {}).get("height") if resp2.get("result") else None

        s.close()
        return {"status": "online", "version": version, "response_time_ms": elapsed, "height": height}
    except Exception as e:
        return {"status": "offline", "error": str(e), "response_time_ms": None, "height": None}


def check_ssl(host, port, timeout=10):
    start = time.time()
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=host) as s:
            s.settimeout(timeout)
            s.connect((host, port))
            req = json.dumps({"id": 1, "method": "server.version", "params": ["NitoMonitor", "1.4"]}) + "\n"
            s.sendall(req.encode())
            data = s.recv(4096).decode()
            resp = json.loads(data)
            elapsed = round((time.time() - start) * 1000)

            version = resp.get("result", [None, None])[0] if resp.get("result") else None

            # Get block height
            req2 = json.dumps({"id": 2, "method": "blockchain.headers.subscribe", "params": []}) + "\n"
            s.sendall(req2.encode())
            data2 = s.recv(4096).decode()
            resp2 = json.loads(data2)
            height = resp2.get("result", {}).get("height") if resp2.get("result") else None

            # Get cert info
            cert = s.getpeercert()
            cert_expires = cert.get("notAfter", "") if cert else ""

            return {"status": "online", "version": version, "response_time_ms": elapsed, "height": height, "cert_expires": cert_expires}
    except Exception as e:
        return {"status": "offline", "error": str(e), "response_time_ms": None, "height": None}


async def check_wss(host, port, timeout=10):
    start = time.time()
    try:
        uri = f"wss://{host}:{port}"
        ssl_ctx = ssl.create_default_context()
        async with websockets.connect(uri, ssl=ssl_ctx, open_timeout=timeout, close_timeout=5) as ws:
            req = json.dumps({"id": 1, "method": "server.version", "params": ["NitoMonitor", "1.4"]})
            await ws.send(req)
            data = await asyncio.wait_for(ws.recv(), timeout=timeout)
            resp = json.loads(data)
            elapsed = round((time.time() - start) * 1000)

            version = resp.get("result", [None, None])[0] if resp.get("result") else None

            req2 = json.dumps({"id": 2, "method": "blockchain.headers.subscribe", "params": []})
            await ws.send(req2)
            data2 = await asyncio.wait_for(ws.recv(), timeout=timeout)
            resp2 = json.loads(data2)
            height = resp2.get("result", {}).get("height") if resp2.get("result") else None

            return {"status": "online", "version": version, "response_time_ms": elapsed, "height": height}
    except Exception as e:
        return {"status": "offline", "error": str(e), "response_time_ms": None, "height": None}


def check_all_servers():
    results = []
    loop = asyncio.new_event_loop()

    for server in SERVERS:
        info = {
            "name": server["name"],
            "host": server["host"],
            "port": server["port"],
            "protocol": server["protocol"],
        }

        if server["protocol"] == "TCP":
            result = check_tcp(server["host"], server["port"])
        elif server["protocol"] == "SSL":
            result = check_ssl(server["host"], server["port"])
        elif server["protocol"] == "WSS":
            result = loop.run_until_complete(check_wss(server["host"], server["port"]))

        info.update(result)
        results.append(info)

    loop.close()

    # Get max block height
    heights = [r["height"] for r in results if r.get("height")]
    max_height = max(heights) if heights else None

    status_cache["servers"] = results
    status_cache["last_check"] = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    status_cache["block_height"] = max_height

    return status_cache


def background_checker():
    while True:
        try:
            check_all_servers()
            print(f"[{time.strftime('%H:%M:%S')}] Check complete - {sum(1 for s in status_cache['servers'] if s['status']=='online')}/{len(status_cache['servers'])} online")
        except Exception as e:
            print(f"Error checking servers: {e}")
        time.sleep(60)


class MonitorHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(status_cache).encode())
        elif self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            html_path = Path(__file__).parent / "index.html"
            self.wfile.write(html_path.read_bytes())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Quiet logs


if __name__ == "__main__":
    # Initial check
    print("Nito ElectrumX Monitor starting...")
    check_all_servers()

    # Background checker thread
    t = Thread(target=background_checker, daemon=True)
    t.start()

    # HTTP server
    server = HTTPServer(("127.0.0.1", 8080), MonitorHandler)
    print("Monitor running on http://127.0.0.1:8080")
    server.serve_forever()
