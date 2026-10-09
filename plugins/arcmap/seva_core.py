# -*- coding: utf-8 -*-
"""Shared helpers for the SEVA.GIS desktop link (QGIS + ArcGIS). Python 2.7 and 3 compatible."""
from __future__ import print_function
import base64, gzip, io, json, os, time, uuid, webbrowser
try:
    from urllib.request import Request, urlopen
except ImportError:  # Python 2 (ArcMap)
    from urllib2 import Request, urlopen

VERSION = "1"
APP_URL = "https://sevagis.dpdns.org/"
BRIDGE_URL = "http://127.0.0.1:8765"
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".seva")
CONFIG_FILE = os.path.join(CONFIG_DIR, "desktop.json")
STATE_FILE = os.path.join(CONFIG_DIR, "state.json")
TOKEN_FILE = os.path.join(CONFIG_DIR, "bridge_token")

# Field names stay <= 10 characters so Shapefiles (ArcMap) can hold them.
ID_FIELD = ("seva_id", "text", 36)
RESULT_FIELDS = [
    ("sv_scene", "text", 12), ("sv_synced", "text", 20), ("sv_ndvi", "float", 0),
    ("sv_ndmi", "float", 0), ("sv_ndre", "float", 0), ("sv_health", "text", 16),
    ("sv_stress", "float", 0), ("sv_dndvi", "float", 0), ("sv_irrig", "text", 120),
    ("sv_vran", "float", 0), ("sv_alert", "int", 0),
]
FIELD_NAMES = [f[0] for f in RESULT_FIELDS]


def _mkdir(path):
    if not os.path.isdir(path):
        os.makedirs(path)
    return path


def _read_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (IOError, OSError, ValueError):
        return default


def load_config():
    cfg = {"seva_url": APP_URL, "bridge_url": BRIDGE_URL, "token": "", "folder": "",
           "name_field": "", "crop_field": "", "default_crop": "", "auto": False, "auto_minutes": 2}
    cfg.update(_read_json(CONFIG_FILE, {}))
    return cfg


def save_config(cfg):
    _mkdir(CONFIG_DIR)
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)


def get_token(cfg):
    """Token typed in settings, else the one the local bridge saved on this machine."""
    if cfg.get("token"):
        return cfg["token"].strip()
    try:
        with open(TOKEN_FILE) as f:
            return f.read().strip()
    except (IOError, OSError):
        return ""


def new_id():
    return str(uuid.uuid4())


# ---------------------------------------------------------------- payloads
def make_payload(features, app, app_version="", project=""):
    return {"type": "FeatureCollection", "seva_exchange": VERSION,
            "source": {"app": app, "version": app_version, "project": project},
            "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "features": features}


def validate_payload(p, parcels=True):
    """Return None when valid, otherwise a short error message."""
    if not isinstance(p, dict) or p.get("seva_exchange") != VERSION:
        return "not a seva-exchange v1 payload"
    if not isinstance(p.get("features"), list):
        return "features missing"
    if parcels:
        for f in p["features"]:
            f = f or {}
            if (f.get("geometry") or {}).get("type") not in ("Polygon", "MultiPolygon"):
                return "only Polygon/MultiPolygon parcels are supported"
            if not (f.get("properties") or {}).get("seva_id"):
                return "feature without seva_id"
    return None


def results_index(payload):
    """seva_id -> {field: value} for the attribute columns we write back."""
    out = {}
    for f in payload.get("features", []):
        props = f.get("properties") or {}
        if props.get("seva_id"):
            out[props["seva_id"]] = dict((k, v) for k, v in props.items() if k in FIELD_NAMES)
    return out


def encode_fragment(payload):
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as g:
        g.write(raw)
    return base64.urlsafe_b64encode(buf.getvalue()).decode("ascii").rstrip("=")


def decode_fragment(text):
    text += "=" * (-len(text) % 4)
    raw = gzip.GzipFile(fileobj=io.BytesIO(base64.urlsafe_b64decode(text.encode("ascii")))).read()
    return json.loads(raw.decode("utf-8"))


def make_link(cfg, payload, max_len=7000):
    """Deep link carrying the parcels in the URL fragment (never sent to any server)."""
    url = cfg["seva_url"].rstrip("/") + "/#seva=" + encode_fragment(payload)
    return url if len(url) <= max_len else None


# ---------------------------------------------------------------- bridge
def _request(cfg, method, path, body=None, timeout=4):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = Request(cfg["bridge_url"].rstrip("/") + path, data=data)
    req.get_method = lambda: method
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Seva-Token", get_token(cfg))
    return json.loads(urlopen(req, timeout=timeout).read().decode("utf-8"))


def bridge_health(cfg):
    try:
        return _request(cfg, "GET", "/health", timeout=1.5)
    except Exception:
        return None


def bridge_send(cfg, payload):
    return _request(cfg, "POST", "/api/import", payload, timeout=10)


def bridge_pull(cfg):
    return _request(cfg, "GET", "/api/pull", timeout=10).get("items", [])


# ---------------------------------------------------------------- folder
def exchange_root(folder):
    return os.path.join(folder, "seva-exchange")


def exchange_dirs(folder):
    root = exchange_root(folder)
    return dict((k, _mkdir(os.path.join(root, k))) for k in ("inbox", "outbox", "rasters", "layers"))


def write_parcels(folder, payload):
    path = os.path.join(exchange_dirs(folder)["inbox"], "parcels-%d.geojson" % int(time.time() * 1000))
    tmp = path + ".part"
    with open(tmp, "w") as f:
        json.dump(payload, f)
    os.rename(tmp, path)  # atomic: SEVA never sees half-written files
    return path


def layers_dir(cfg):
    if cfg.get("folder"):
        return exchange_dirs(cfg["folder"])["layers"]
    return _mkdir(os.path.join(CONFIG_DIR, "layers"))


# ---------------------------------------------------------------- send / receive
def send_parcels(cfg, payload):
    """Deliver parcels over every available route and open SEVA.GIS if no tab is listening."""
    res = {"folder": None, "bridge": False, "link": None, "fallback": None}
    tab_open = False
    if cfg.get("folder"):
        res["folder"] = write_parcels(cfg["folder"], payload)
    health = bridge_health(cfg)
    if health:
        try:
            bridge_send(cfg, payload)
            res["bridge"] = True
            age = health.get("last_poll_age")
            tab_open = age is not None and age < 15
        except Exception as e:
            res["error"] = str(e)
    if not tab_open:
        res["link"] = make_link(cfg, payload)
        webbrowser.open(res["link"] or cfg["seva_url"])
    if not (res["bridge"] or res["folder"] or res["link"]):
        path = os.path.join(_mkdir(CONFIG_DIR), "parcels-latest.geojson")
        with open(path, "w") as f:
            json.dump(payload, f)
        res["fallback"] = path
    return res


def describe(res):
    parts = []
    if res.get("bridge"):
        parts.append("live bridge")
    if res.get("folder"):
        parts.append("exchange folder")
    if res.get("link"):
        parts.append("browser link")
    if res.get("fallback"):
        parts.append("file %s (drag it into SEVA.GIS)" % res["fallback"])
    return ", ".join(parts) or "nothing - check settings"


def collect_results(cfg, app):
    """New results payloads from the bridge queue and the exchange folder (de-duplicated by run_id)."""
    out, seen = [], set()

    def add(d):
        rid = d.get("run_id")
        if validate_payload(d, parcels=False) is None and not (rid and rid in seen):
            seen.add(rid)
            out.append(d)

    if get_token(cfg) and bridge_health(cfg):
        try:
            for item in bridge_pull(cfg):
                add(item)
        except Exception:
            pass
    if cfg.get("folder"):
        state = _read_json(STATE_FILE, {})
        since, newest = float(state.get(app, 0)), float(state.get(app, 0))
        outbox = exchange_dirs(cfg["folder"])["outbox"]
        files = []
        for n in os.listdir(outbox):
            p = os.path.join(outbox, n)
            if n.startswith("results-") and n.endswith(".geojson") and os.path.getmtime(p) > since:
                files.append((os.path.getmtime(p), p))
        for m, p in sorted(files):
            d = _read_json(p, None)
            if d is None:
                continue  # still being written; picked up next time
            add(d)
            newest = max(newest, m)
        state[app] = newest
        _mkdir(CONFIG_DIR)
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    return out
