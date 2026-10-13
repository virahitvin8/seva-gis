# -*- coding: utf-8 -*-
"""Shared helpers for the SEVA.GIS desktop plugins (QGIS, ArcGIS Pro, ArcMap).

Standard library only and compatible with Python 2.7 (ArcMap 10.x) and Python 3
(QGIS 3.x, ArcGIS Pro), so the very same file drives all three hosts. There is no
Google Earth Engine credential anywhere in this layer: every request goes to the
SEVA.GIS service, which already holds the Earth Engine identity.

Nothing here touches a GIS API. Host-specific code lives in the host folders, and
receives plain dictionaries from this module.
"""
from __future__ import print_function

import json
import os
import re
import time

try:  # Python 3
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError
except ImportError:  # Python 2.7 (ArcMap)
    from urllib2 import Request, urlopen, HTTPError, URLError

VERSION = "2"

# Public, credential-free service. Users never need a Google account.
DEFAULT_BACKEND = "https://seva-gis-backend-419602015618.us-central1.run.app"
APP_URL = "https://sevagis.dpdns.org/"
BRIDGE_URL = "http://127.0.0.1:8765"

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".seva")
CONFIG_FILE = os.path.join(CONFIG_DIR, "desktop.json")
PLAN_FILE = os.path.join(CONFIG_DIR, "query_plan.json")
TOKEN_FILE = os.path.join(CONFIG_DIR, "bridge_token")

DEFAULT_CONFIG = {
    "backend_url": DEFAULT_BACKEND,
    "seva_url": APP_URL,
    "bridge_url": BRIDGE_URL,
    "token": "",
    "folder": "",
    "default_crop": "",
    "zoom": 13,
    "auto": False,
    "auto_minutes": 2,
}

# Field names stay <= 10 characters so Shapefiles (ArcMap) can hold them.
ID_FIELD = ("seva_id", "text", 36)
RESULT_FIELDS = [
    ("sv_scene", "text", 12), ("sv_synced", "text", 20), ("sv_ndvi", "float", 0),
    ("sv_ndmi", "float", 0), ("sv_ndre", "float", 0), ("sv_health", "text", 16),
    ("sv_stress", "float", 0), ("sv_dndvi", "float", 0), ("sv_irrig", "text", 120),
    ("sv_vran", "float", 0), ("sv_alert", "int", 0),
]
FIELD_NAMES = [f[0] for f in RESULT_FIELDS]


class SevaError(Exception):
    """Raised for any service failure, carrying a message fit for a status bar."""

    def __init__(self, message, status=None, detail=""):
        Exception.__init__(self, message)
        self.message = message
        self.status = status
        self.detail = detail

    def __str__(self):
        return self.message


def _mkdir(path):
    if path and not os.path.isdir(path):
        os.makedirs(path)
    return path


def _read_json(path, default):
    try:
        with open(path) as handle:
            return json.load(handle)
    except (IOError, OSError, ValueError):
        return default


def _write_json(path, payload):
    _mkdir(os.path.dirname(path))
    tmp = path + ".part"
    with open(tmp, "w") as handle:
        json.dump(payload, handle, indent=2)
    if os.path.exists(path):
        os.remove(path)
    os.rename(tmp, path)  # atomic: a reader never sees a half-written plan


def load_config():
    config = dict(DEFAULT_CONFIG)
    stored = _read_json(CONFIG_FILE, {})
    if isinstance(stored, dict):
        config.update(stored)
    if not config.get("backend_url"):
        config["backend_url"] = DEFAULT_BACKEND
    return config


def save_config(config):
    merged = dict(DEFAULT_CONFIG)
    merged.update(config or {})
    _write_json(CONFIG_FILE, merged)
    return merged


def get_token(config):
    """Bridge token typed in settings, else the one the bridge saved on this machine."""
    if (config or {}).get("token"):
        return config["token"].strip()
    try:
        with open(TOKEN_FILE) as handle:
            return handle.read().strip()
    except (IOError, OSError):
        return ""


def normalize_tile_url(url):
    """Rewrite a retired Earth Engine tile URL to the endpoint that still serves tiles.

    Earth Engine retired ``earthengine.googleapis.com/map/<mapid>/{z}/{x}/{y}``, which
    now answers 404. Doing this here as well as on the server means the plugin keeps
    working against a service that has not been redeployed yet.
    """
    if not url:
        return url
    marker = "/map/"
    if "earthengine.googleapis.com" in url and marker in url:
        head, _, rest = url.partition(marker)
        mapid = rest.split("/{z}")[0].split("?")[0]
        if mapid and not mapid.startswith("projects/"):
            mapid = "projects/earthengine-legacy/maps/" + mapid
        return head + "/v1/" + mapid + "/tiles/{z}/{x}/{y}"
    return url


# ------------------------------------------------------------------ plan storage
def empty_plan():
    return {"seva_plan": int(VERSION), "defaults": {"start_date": "", "end_date": "", "max_cloud": 20}, "boxes": []}


def load_plan():
    stored = _read_json(PLAN_FILE, None)
    if isinstance(stored, dict) and isinstance(stored.get("boxes"), list):
        stored.setdefault("defaults", {})
        stored["seva_plan"] = int(VERSION)
        return stored
    return empty_plan()


def save_plan(plan):
    plan = plan or empty_plan()
    plan["seva_plan"] = int(VERSION)
    _write_json(PLAN_FILE, plan)
    return plan


# ------------------------------------------------------------------ http
def plan_request(config, path, body=None, timeout=240):
    """POST (or GET) JSON to the SEVA.GIS service and return the decoded reply.

    Every failure becomes a SevaError whose message can be shown as-is; a bare
    traceback in a desktop dialog is useless to the person using it.
    """
    base = (config or {}).get("backend_url") or DEFAULT_BACKEND
    url = base.rstrip("/") + path
    payload = None
    headers = {"Accept": "application/json"}
    method = "GET"
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"

    request = Request(url, data=payload, headers=headers)
    if hasattr(request, "get_method"):
        request.get_method = lambda: method

    started = time.time()
    try:
        response = urlopen(request, timeout=timeout)
        raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        message = _detail_message(detail, exc.code)
        raise SevaError(message, status=exc.code, detail=detail)
    except URLError as exc:
        raise SevaError(
            "Cannot reach the SEVA.GIS service at %s (%s). Check the Service URL in "
            "Settings, or your internet connection." % (base, getattr(exc, "reason", exc))
        )
    except Exception as exc:  # socket timeouts and friends
        raise SevaError("Request to %s failed: %s" % (url, exc))

    try:
        decoded = json.loads(raw)
    except ValueError:
        raise SevaError("The service replied with something that is not JSON.", detail=raw[:400])
    if isinstance(decoded, dict):
        decoded["_elapsedMs"] = int((time.time() - started) * 1000)
    return decoded


def _detail_message(detail, status):
    text = ""
    try:
        parsed = json.loads(detail)
        if isinstance(parsed, dict):
            value = parsed.get("detail")
            if isinstance(value, list) and value:
                value = value[0].get("msg") if isinstance(value[0], dict) else str(value[0])
            text = str(value or "")
    except (ValueError, TypeError):
        text = (detail or "").strip()

    if status == 404 and ("No Sentinel-2" in text or "No scenes" in text):
        return text + " Try widening the date range or allowing more cloud."
    if status == 422:
        return "The service rejected the request: %s" % (text or "invalid parameters")
    if status == 429:
        return "Too many requests just now. Wait a moment and run the queries again."
    if status == 503:
        return text or "The satellite service is temporarily unavailable."
    if text:
        return text
    return "The service returned HTTP %s." % status


def health(config):
    try:
        return plan_request(config, "/health", timeout=15)
    except SevaError:
        return None


def reachable(config):
    return health(config) is not None
