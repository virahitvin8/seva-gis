#!/usr/bin/env python3
"""SEVA.GIS local bridge - hardened. Python 3.7+, standard library only.

Moves seva-exchange v1 JSON between desktop GIS (QGIS/ArcGIS) and the SEVA.GIS browser tab.
Security: binds to 127.0.0.1 only, checks Host (anti DNS-rebinding), allows only listed web origins
(no wildcard CORS), requires a pairing token on every /api call, caps request size, never logs payloads.
"""
import argparse, collections, hmac, json, os, secrets, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ORIGINS = ("https://sevagis.dpdns.org", "https://virahitvin8.github.io",
           "http://localhost:5173", "http://127.0.0.1:5173")
MAX_BODY = 25 * 1024 * 1024
TOKEN_FILE = os.path.join(os.path.expanduser("~"), ".seva", "bridge_token")


class State:
    def __init__(self):
        self.lock = threading.Lock()
        self.to_seva = collections.deque(maxlen=50)
        self.to_desktop = collections.deque(maxlen=50)
        self.last_poll = None


def load_token(explicit=None):
    if explicit:
        return explicit
    try:
        with open(TOKEN_FILE) as f:
            t = f.read().strip()
            if t:
                return t
    except OSError:
        pass
    token = secrets.token_urlsafe(12)
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, "w") as f:
        f.write(token)
    try:
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass
    return token


def make_server(port, token, origins=ORIGINS, max_body=MAX_BODY, host="127.0.0.1"):
    state = State()

    class Handler(BaseHTTPRequestHandler):
        server_version = "SevaBridge/1"

        def log_message(self, *args):  # never log request bodies or tokens
            pass

        # -- helpers
        def _origin(self):
            return self.headers.get("Origin")

        def _guard(self):
            """Host + Origin checks. Returns False (and replies) when the request must be refused."""
            port_ = self.server.server_address[1]
            if self.headers.get("Host") not in ("127.0.0.1:%d" % port_, "localhost:%d" % port_):
                self._send(403, {"error": "bad host"})
                return False
            if self._origin() and self._origin() not in origins:
                self._send(403, {"error": "origin not allowed"})
                return False
            return True

        def _auth(self):
            given = self.headers.get("X-Seva-Token", "")
            try:
                ok = hmac.compare_digest(given, token)
            except TypeError:
                ok = False
            if not ok:
                time.sleep(0.4)  # slow down guessing
                self._send(401, {"error": "bad token"})
            return ok

        def _cors(self):
            o = self._origin()
            if o in origins:
                self.send_header("Access-Control-Allow-Origin", o)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Seva-Token")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                if self.headers.get("Access-Control-Request-Private-Network") == "true":
                    self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "600")

        def _send(self, code, obj=None):
            body = b"" if obj is None else json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _drain(self, q):
            with state.lock:
                items = list(q)
                q.clear()
            return items

        # -- verbs
        def do_OPTIONS(self):
            if self._guard():
                self._send(204)

        def do_GET(self):
            if not self._guard():
                return
            if self.path == "/health":
                age = None if state.last_poll is None else round(time.time() - state.last_poll, 1)
                return self._send(200, {"ok": True, "app": "seva-bridge", "v": 1, "last_poll_age": age})
            if self.path not in ("/api/poll", "/api/pull") or not self._auth():
                return self._send(404, {"error": "not found"}) if self.path not in ("/api/poll", "/api/pull") else None
            if self.path == "/api/poll":  # the SEVA browser tab asks for parcels
                state.last_poll = time.time()
                return self._send(200, {"items": self._drain(state.to_seva)})
            return self._send(200, {"items": self._drain(state.to_desktop)})  # desktop asks for results

        def do_POST(self):
            if not self._guard():
                return
            if self.path not in ("/api/import", "/api/export"):
                return self._send(404, {"error": "not found"})
            if not self._auth():
                return
            try:
                length = int(self.headers.get("Content-Length", "-1"))
            except ValueError:
                length = -1
            if length < 0:
                return self._send(411, {"error": "length required"})
            if length > max_body:
                return self._send(413, {"error": "payload too large"})
            try:
                data = json.loads(self.rfile.read(length).decode("utf-8"))
            except ValueError:
                return self._send(400, {"error": "invalid json"})
            if not isinstance(data, dict) or data.get("seva_exchange") != "1":
                return self._send(422, {"error": "not seva-exchange v1"})
            q = state.to_seva if self.path == "/api/import" else state.to_desktop
            with state.lock:
                q.append(data)
                n = len(q)
            self._send(200, {"queued": n})

    srv = ThreadingHTTPServer((host, port), Handler)
    srv.state = state
    return srv


def main():
    ap = argparse.ArgumentParser(description="SEVA.GIS local bridge")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--token", help="use this token instead of the saved one")
    ap.add_argument("--origin", action="append", default=[], help="extra allowed web origin")
    a = ap.parse_args()
    token = load_token(a.token)
    srv = make_server(a.port, token, tuple(ORIGINS) + tuple(a.origin))
    print("SEVA.GIS bridge listening on http://127.0.0.1:%d" % a.port)
    print("Pairing token (paste into SEVA.GIS > QGIS/ArcGIS button): %s" % token)
    print("Stop with Ctrl+C.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("bye")
        sys.exit(0)


if __name__ == "__main__":
    main()
