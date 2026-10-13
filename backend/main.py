# SEVA GIS - Google Earth Engine tile service
from __future__ import annotations
import asyncio, hashlib, io, json, logging, os, time, urllib.request
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone
import math
from typing import Any, Literal, Optional
import ee
import numpy as np
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# Works both when run as `main:app` from this directory (the container layout) and
# when imported as `backend.main` from the repository root.
try:
    from . import llm
    from .hydro import analyse_streams
except ImportError:  # pragma: no cover - depends on how the process was started
    import llm
    from hydro import analyse_streams

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
log = logging.getLogger("seva-gee")

PROJECT_ID: str = os.environ.get("EE_PROJECT_ID", "seva-gis-backend").strip()
SA_EMAIL: str = os.environ.get("EE_SERVICE_ACCOUNT_EMAIL", "").strip()
SA_KEY_FILE: str = os.environ.get("EE_SERVICE_ACCOUNT_KEY_FILE", "service-account.json").strip()
ALLOWED_ORIGINS: list[str] = [o.strip() for o in os.environ.get("EE_ALLOWED_ORIGINS", "http://localhost:8443,http://localhost:5173,https://sevagis.stusite.me,https://sevagis.is-a.bot,https://sevagis.is-a.dev,https://sevagis.dpdns.org,https://seva-gis-backend-e724a.web.app,https://seva-gis-backend-e724a.firebaseapp.com").split(",") if o.strip()]
RATE_LIMIT_RPM: int = int(os.environ.get("EE_RATE_LIMIT_RPM", "60"))
CACHE_TTL: int = int(os.environ.get("EE_CACHE_TTL", "600"))
MAX_BODY: int = 128 * 1024

app = FastAPI(title="SEVA GIS Earth Engine Proxy v2", version="2.0.0", docs_url="/api/docs", redoc_url="/api/redoc")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Cache", "X-Render-Ms"]
)

_ee_ready = False
_ee_lock = asyncio.Lock()

def _initialize_ee() -> None:
    """Initialize GEE using service account key (preferred) or Application Default Credentials."""
    global _ee_ready
    if _ee_ready: return
    if not PROJECT_ID: raise RuntimeError("EE_PROJECT_ID required.")
    # Prefer explicit service account key file for local + Cloud Run use
    key_path = SA_KEY_FILE if os.path.isabs(SA_KEY_FILE) else os.path.join(os.path.dirname(__file__), SA_KEY_FILE)
    if SA_EMAIL and os.path.isfile(key_path):
        try:
            creds = ee.ServiceAccountCredentials(SA_EMAIL, key_path)
            ee.Initialize(credentials=creds, project=PROJECT_ID)
            log.info("EE: Initialized with service account %s", SA_EMAIL)
            _ee_ready = True
            return
        except Exception as sa_err:
            log.warning("EE SA init failed (%s), falling back to ADC", sa_err)
    # Fallback: Application Default Credentials (Cloud Run workload identity)
    ee.Initialize(project=PROJECT_ID)
    log.info("EE: Initialized with Application Default Credentials")
    _ee_ready = True

async def _ensure_ee() -> None:
    async with _ee_lock:
        if not _ee_ready:
            try: await asyncio.to_thread(_initialize_ee)
            except Exception as exc:
                raise HTTPException(503, f"Earth Engine unavailable: {exc}") from exc

_tile_cache: dict[str, dict] = {}
_rate_windows: dict[str, deque] = defaultdict(deque)

def _cache_get(k: str) -> dict | None:
    e = _tile_cache.get(k)
    if e and (time.monotonic() - e["ts"]) < CACHE_TTL: return e["d"]
    if e: del _tile_cache[k]
    return None

def _cache_set(k: str, d: dict) -> None:
    if len(_tile_cache) > 512:
        for old_k, _ in sorted(_tile_cache.items(), key=lambda kv: kv[1]["ts"])[:128]: del _tile_cache[old_k]
    _tile_cache[k] = {"ts": time.monotonic(), "d": d}

def _check_rate(ip: str) -> None:
    now = time.monotonic(); w = _rate_windows[ip]
    while w and now - w[0] > 60: w.popleft()
    if len(w) >= RATE_LIMIT_RPM: raise HTTPException(429, f"Rate limit: {RATE_LIMIT_RPM} req/min")
    w.append(now)

def _ck(*p: Any) -> str:
    return hashlib.sha256("|".join(str(x) for x in p).encode()).hexdigest()[:32]

# === Definitions ===
BAND_COMBOS = {
    "natural": ["B4","B3","B2"], "cir": ["B8","B4","B3"], "agri": ["B11","B8","B2"],
    "moisture": ["B12","B8","B4"], "swir": ["B12","B11","B8"], "chlorophyll": ["B8","B5","B4"],
    "geology": ["B12","B8","B3"], "redge": ["B8A","B7","B5"], "bathymetric": ["B4","B3","B1"],
    "urban": ["B12","B11","B4"],
}
COMBO_VIZ = {
    "natural":     {"min":[0.02,0.02,0.02],"max":[0.30,0.30,0.30],"gamma":[1.25,1.25,1.25]},
    "cir":         {"min":[0.04,0.02,0.02],"max":[0.50,0.30,0.30],"gamma":[1.2,1.2,1.2]},
    "agri":        {"min":[0.02,0.04,0.02],"max":[0.42,0.50,0.25],"gamma":[1.2,1.2,1.2]},
    "moisture":    {"min":[0.02,0.04,0.02],"max":[0.38,0.50,0.30],"gamma":[1.2,1.2,1.2]},
    "swir":        {"min":[0.02,0.02,0.04],"max":[0.38,0.38,0.50],"gamma":[1.2,1.2,1.2]},
    "chlorophyll": {"min":[0.04,0.02,0.02],"max":[0.50,0.30,0.28],"gamma":[1.2,1.2,1.2]},
    "geology":     {"min":[0.02,0.04,0.02],"max":[0.38,0.50,0.24],"gamma":[1.2,1.2,1.2]},
    "redge":       {"min":[0.04,0.04,0.02],"max":[0.55,0.52,0.30],"gamma":[1.2,1.2,1.2]},
    "bathymetric": {"min":[0.01,0.01,0.02],"max":[0.20,0.18,0.28],"gamma":[1.1,1.1,1.1]},
    "urban":       {"min":[0.02,0.02,0.02],"max":[0.40,0.38,0.30],"gamma":[1.2,1.2,1.2]},
}
INDICATORS = {
    "ndvi":   {"e":"(B8-B4)/(B8+B4)",                             "p":["a50026","f46d43","fee08b","d9ef8b","66bd63","006837"],"lo":-0.2,"hi":0.9},
    "evi":    {"e":"2.5*(B8-B4)/(B8+6*B4-7.5*B2+1)",              "p":["a50026","f46d43","fee08b","a6d96a","1a9850"],          "lo":-0.2,"hi":0.8},
    "savi":   {"e":"1.5*(B8-B4)/(B8+B4+0.5)",                     "p":["c7e9c0","74c476","238b45","00441b"],                   "lo":-0.2,"hi":0.8},
    "msavi":  {"e":"(2*B8+1-sqrt((2*B8+1)**2-8*(B8-B4)))/2",      "p":["ffffb2","fecc5c","fd8d3c","f03b20","bd0026"],          "lo":-0.2,"hi":0.8},
    "gndvi":  {"e":"(B8-B3)/(B8+B3)",                             "p":["ffffcc","c2e699","78c679","31a354","006837"],          "lo":-0.1,"hi":0.85},
    "ndre":   {"e":"(B8-B5)/(B8+B5)",                             "p":["fee5d9","fcae91","fb6a4a","de2d26","a50f15"],          "lo":-0.1,"hi":0.70},
    "cire":   {"e":"B7/B5-1",                                     "p":["ffffe5","d9f0a3","78c679","238443","004529"],          "lo":0.0, "hi":4.0},
    "chla":   {"e":"B7/B3-1",                                     "p":["ffffcc","c2e699","78c679","31a354","006837"],          "lo":0.0, "hi":5.0},
    "reip":   {"e":"700+40*((((B4+B7)/2)-B5)/(B6-B5))",          "p":["a50026","fdae61","ffffbf","a6d96a","006837"],          "lo":700.0,"hi":735.0},
    "stress": {"e":"min(1,max(0,(max(0,(0.35-((B8-B5)/(B8+B5)))/0.35)*0.6+max(0,(0.25-((B8-B11)/(B8+B11)))/0.35)*0.4)))", "p":["1a9850","a6d96a","fee08b","fdae61","d73027"], "lo":0.0,"hi":1.0},
    "lai":    {"e":"3.618*((B8-B4)/(B8+B4))-0.118",               "p":["ffffe5","d9f0a3","78c679","238443","004529"],          "lo":0.0, "hi":5.0},
    "nbr":    {"e":"(B8-B12)/(B8+B12)",                           "p":["d73027","fc8d59","fee08b","d9ef8b","66bd63","1a9850"],"lo":-0.8,"hi":0.9},
    "ndmi":   {"e":"(B8-B11)/(B8+B11)",                           "p":["d73027","fc8d59","fee08b","abd9e9","74add1","4575b4"],"lo":-0.5,"hi":0.5},
    "ndwi":   {"e":"(B3-B8)/(B3+B8)",                             "p":["d7191c","fdae61","ffffbf","abd9e9","2c7bb6"],          "lo":-0.5,"hi":0.5},
    "mndwi":  {"e":"(B3-B11)/(B3+B11)",                           "p":["d73027","f46d43","ffffbf","abd9e9","4575b4"],          "lo":-0.5,"hi":0.5},
    "msi":    {"e":"B11/B8",                                      "p":["eef8fb","b4d9e7","68b6d1","2687bb","0d4e8f"],          "lo":0.2, "hi":3.0},
    "bsi":    {"e":"((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2))",       "p":["006837","66bd63","fee08b","f46d43","a50026"],          "lo":-0.5,"hi":0.5},
    "ndbi":   {"e":"(B11-B8)/(B11+B8)",                           "p":["d9ef8b","fee08b","f46d43","a50026"],                  "lo":-0.3,"hi":0.5},
    "swir_r": {"e":"B12/B11",                                     "p":["ffffcc","fed976","feb24c","fd8d3c","fc4e2a","e31a1c"],"lo":0.3, "hi":2.5},
}

S2B = ["B2","B3","B4","B5","B6","B7","B8","B8A","B11","B12"]

def _ind_img(image: ee.Image, ind: str) -> ee.Image:
    spec = INDICATORS.get(ind)
    if not spec: raise HTTPException(422, f"Unknown indicator: {ind}")
    b = {k: image.select(k).divide(10000) for k in S2B}
    return image.expression(spec["e"], b).rename(ind)

def _scl_mask(img: ee.Image) -> ee.Image:
    scl = img.select("SCL")
    return img.updateMask(scl.gte(4).And(scl.lte(7)))

def _s2col(field: ee.Geometry, start: date, end: date, cloud: int) -> ee.ImageCollection:
    return (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(field).filterDate(start.isoformat(), (end+timedelta(days=1)).isoformat())
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", cloud)).map(_scl_mask))

def _dem_layers(field: ee.Geometry) -> dict:
    dem = ee.ImageCollection("COPERNICUS/DEM/GLO30").filterBounds(field).select("DEM").mosaic().clip(field).rename("elevation")
    t = ee.Terrain.products(dem)
    hs = ee.Terrain.hillshade(dem, 315, 45).clip(field)
    return {
        "elevation": (t.select("elevation"), {"min":0,"max":1000,"palette":["006633","e5ffcc","662a00","d8d8d8","f5f5f5"],"format":"png"}),
        "slope":     (t.select("slope"),     {"min":0,"max":45,  "palette":["f7f7f7","d9f0d3","a6dba0","5aae61","1b7837"],"format":"png"}),
        "aspect":    (t.select("aspect"),    {"min":0,"max":360, "palette":["e66101","fdb863","f7f7f7","b2abd2","5e3c99"],"format":"png"}),
        "hillshade": (hs,                    {"min":0,"max":255, "palette":["000000","ffffff"],                          "format":"png"}),
    }

def _comp(col: ee.ImageCollection, method: str) -> ee.Image:
    if method == "mosaic": return col.sort("CLOUDY_PIXEL_PERCENTAGE").mosaic()
    if method == "mean":   return col.mean()
    if method == "max_ndvi": return col.qualityMosaic("B8")
    return col.median()

def modernize_tile_url(url: str) -> str:
    """Rewrite a legacy Earth Engine tile URL to the current `/v1` tile endpoint.

    Earth Engine retired `earthengine.googleapis.com/map/<mapid>/{z}/{x}/{y}?token=`,
    which now answers 404. Only `.../v1/<mapid>/tiles/{z}/{x}/{y}` serves imagery, so
    every URL this service hands out (and every cached one) is normalised first.
    """
    if not url:
        return url
    marker = "/map/"
    if "earthengine.googleapis.com" in url and marker in url:
        head, _, rest = url.partition(marker)
        mapid = rest.split("/{z}")[0].split("?")[0]
        if mapid and not mapid.startswith("projects/"):
            mapid = f"projects/earthengine-legacy/maps/{mapid}"
        return f"{head}/v1/{mapid}/tiles/{{z}}/{{x}}/{{y}}"
    return url


def _tileurl(mid: dict) -> str:
    """Return a modern, working XYZ tile template for an Earth Engine map id."""
    url_format = mid.get("urlFormat")
    if not url_format and "tile_fetcher" in mid and hasattr(mid["tile_fetcher"], "url_format"):
        url_format = mid["tile_fetcher"].url_format
    if url_format:
        return modernize_tile_url(url_format)
    mapid = mid.get("mapid", "")
    if mapid and not mapid.startswith("projects/"):
        mapid = f"projects/earthengine-legacy/maps/{mapid}"
    return f"https://earthengine.googleapis.com/v1/{mapid}/tiles/{{z}}/{{x}}/{{y}}"

def _dr(req: Any) -> tuple[date, date]:
    today = date.today()
    if req.mode == "date":
        if not req.date: raise HTTPException(422, "Provide date for mode=date.")
        return req.date, req.date
    if req.mode == "range":
        if not req.start_date or not req.end_date or req.start_date > req.end_date:
            raise HTTPException(422, "Provide valid start_date and end_date.")
        if (req.end_date - req.start_date).days > 365: raise HTTPException(422, "Max 365 days.")
        return req.start_date, req.end_date
    return today - timedelta(days=45), today

def _geom(coords: list[list[float]]) -> ee.Geometry:
    ring = list(coords)
    if ring[0] != ring[-1]: ring.append(ring[0])
    return ee.Geometry.Polygon([ring], geodesic=False)

# === Models ===
BandComboLit = Literal["natural","cir","agri","moisture","swir","chlorophyll","geology","redge","bathymetric","urban"]
DemLit       = Literal["elevation","slope","aspect","hillshade"]
ModeLit      = Literal["latest","date","range"]

class Viz(BaseModel):
    minimum: float = Field(default=-0.2, ge=-10000, le=10000)
    maximum: float = Field(default=0.9,  ge=-10000, le=10000)
    palette: list[str] = Field(default_factory=lambda: ["a50026","fee08b","006837"], max_length=20)
    @field_validator("palette")
    @classmethod
    def valid_hex(cls, colors: list[str]) -> list[str]:
        out = []
        for c in colors:
            h = c.removeprefix("#")
            if len(h) != 6 or not all(x in "0123456789abcdefABCDEF" for x in h): raise ValueError(f"Bad hex: {c}")
            out.append(h)
        return out

class PolyBase(BaseModel):
    coordinates: list[list[float]] = Field(min_length=3, max_length=4001)
    @field_validator("coordinates")
    @classmethod
    def valid_ring(cls, ring: list[list[float]]) -> list[list[float]]:
        for pt in ring:
            if len(pt) != 2: raise ValueError("Each coord must be [lon,lat].")
            lon, lat = pt
            if abs(lon) > 180 or abs(lat) > 90: raise ValueError("WGS-84 lon/lat required.")
        if len({(round(p[0],5),round(p[1],5)) for p in ring}) < 3: raise ValueError("Need 3+ distinct points.")
        return ring

class MapReq(PolyBase):
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: int = Field(default=30, ge=0, le=100)
    indicator_id: Optional[str] = Field(default=None, max_length=24)
    band_combination: Optional[BandComboLit] = None
    visualization: Viz = Field(default_factory=Viz)
    percentile_stretch: bool = False
    compositing: Literal["median","mosaic","mean","max_ndvi"] = "median"

class StatsReq(PolyBase):
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: int = Field(default=30, ge=0, le=100)
    indicators: list[str] = Field(default=["ndvi","evi","ndmi","ndwi","bsi"], max_length=12)
    scale: int = Field(default=10, ge=10, le=100)

class ChangeReq(PolyBase):
    before_start: date; before_end: date
    after_start: date;  after_end: date
    max_cloud: int = Field(default=40, ge=0, le=100)
    indicator_id: str = Field(default="ndvi", max_length=24)
    threshold: float = Field(default=0.1, ge=0.0, le=2.0)

class TSReq(PolyBase):
    start_date: date; end_date: date
    max_cloud: int = Field(default=40, ge=0, le=100)
    indicator_id: str = Field(default="ndvi", max_length=24)
    interval_days: int = Field(default=16, ge=5, le=120)
    scale: int = Field(default=30, ge=10, le=500)

class DemReq(PolyBase):
    layer: DemLit = "elevation"

class AlertReq(PolyBase):
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: int = Field(default=40, ge=0, le=100)
    ndvi_threshold: float = Field(default=0.3, ge=-1.0, le=1.0)
    alert_pct: float = Field(default=30.0, ge=1.0, le=100.0)
    scale: int = Field(default=30, ge=10, le=500)

class GeeRenderReq(BaseModel):
    geojson: Optional[dict] = None
    coordinates: Optional[list[list[float]]] = None
    mode: Literal["latest", "single", "range"] = "latest"
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    maxCloud: Optional[int] = Field(default=30, ge=0, le=100)
    max_cloud: Optional[int] = None
    preset: str = "trueColor"
    padM: Optional[int] = Field(default=20, ge=0, le=500)
    pad_m: Optional[int] = None

# --- Desktop plugin planning (no Earth Engine required) ---
class InterpretReq(BaseModel):
    """One sentence per box, exactly as the user typed it."""
    sentences: list[str] = Field(min_length=1, max_length=40)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: Optional[int] = Field(default=None, ge=0, le=100)

# --- Vector-producing operations ---
class ZonesReq(PolyBase):
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: int = Field(default=30, ge=0, le=100)
    indicator_id: str = Field(default="ndvi", max_length=24)
    level: Literal["low", "high"] = "low"
    classes: int = Field(default=1, ge=1, le=5)
    class_mode: Literal["quantile", "absolute"] = "quantile"
    threshold: Optional[float] = Field(default=None, ge=-10000, le=10000)
    scale: int = Field(default=20, ge=10, le=120)
    min_hectares: float = Field(default=0.5, ge=0.0, le=10000.0)
    max_features: int = Field(default=300, ge=1, le=2000)
    color: Optional[str] = Field(default=None, max_length=9)

class StreamsReq(PolyBase):
    percentile: float = Field(default=96.0, ge=80.0, le=99.5)
    target_meters: int = Field(default=30, ge=10, le=120)
    max_dimension: int = Field(default=512, ge=64, le=1024)
    min_points: int = Field(default=3, ge=2, le=20)

class CandidatesReq(PolyBase):
    kind: Literal["hotspot", "water", "fallow", "built", "linear"] = "hotspot"
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: int = Field(default=30, ge=0, le=100)
    threshold: Optional[float] = Field(default=None, ge=-10000, le=10000)
    scale: int = Field(default=20, ge=10, le=120)
    min_hectares: float = Field(default=0.5, ge=0.0, le=10000.0)
    max_features: int = Field(default=300, ge=1, le=2000)
    color: Optional[str] = Field(default=None, max_length=9)

# === Middleware ===
@app.middleware("http")
async def limit_body(request: Request, call_next: Any) -> Response:
    try: size = int(request.headers.get("content-length","0"))
    except ValueError: size = 0
    if size > MAX_BODY: return JSONResponse({"detail":"Request body too large."},status_code=413)
    return await call_next(request)

@app.middleware("http")
async def timing(request: Request, call_next: Any) -> Response:
    t0 = time.monotonic(); r = await call_next(request)
    r.headers["X-Render-Ms"] = str(int((time.monotonic()-t0)*1000)); return r

# === Routes ===
@app.get("/health")
async def health() -> dict:
    return {"service":"seva-gis-earth-engine","version":"2.0.0","project":PROJECT_ID,"engineReady":_ee_ready,"cachedTiles":len(_tile_cache),"rateLimitRpm":RATE_LIMIT_RPM}

@app.post("/api/gee/render")
@app.post("/api/earth-engine/render")
async def render_farm_endpoint(request: Request, body: GeeRenderReq) -> dict:
    """Render Sentinel-2 PNG with on-farm percentile [2, 98] stretch matching QGIS and geeRender.js."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    preset_map = {
        "trueColor":      ["B4", "B3", "B2"],
        "colourInfrared": ["B8", "B4", "B3"],
        "agriculture":    ["B11", "B8", "B2"],
        "swir":           ["B12", "B8A", "B4"],
        "natural":        ["B4", "B3", "B2"],
        "cir":            ["B8", "B4", "B3"],
        "agri":           ["B11", "B8", "B2"],
    }
    bands = preset_map.get(body.preset)
    if not bands:
        raise HTTPException(422, f"BAD_PRESET: {body.preset}")
    start_d = body.startDate or body.start_date
    end_d = body.endDate or body.end_date
    cloud = body.maxCloud if body.max_cloud is None else body.max_cloud
    pad_meters = body.padM if body.pad_m is None else body.pad_m

    def _execute() -> dict:
        if body.geojson:
            region = ee.Geometry(body.geojson)
        elif body.coordinates:
            region = _geom(body.coordinates)
        else:
            raise HTTPException(422, "geojson or coordinates required.")
        col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(region)
            .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", cloud)))
        now = datetime.now(timezone.utc)
        if body.mode == "latest":
            s_str = (now - timedelta(days=120)).strftime("%Y-%m-%d")
            e_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")
            col = col.filterDate(s_str, e_str)
        elif body.mode == "single":
            if not start_d: raise HTTPException(422, "startDate required for single mode.")
            s_dt = datetime.strptime(start_d, "%Y-%m-%d")
            col = col.filterDate(start_d, (s_dt + timedelta(days=1)).strftime("%Y-%m-%d"))
        else:
            if not start_d or not end_d: raise HTTPException(422, "startDate and endDate required for range mode.")
            col = col.filterDate(start_d, end_d)
        total = col.size().getInfo()
        if total == 0:
            raise HTTPException(404, "NO_SCENES")

        def _mask_s2(img: ee.Image) -> ee.Image:
            scl = img.select("SCL")
            bad = scl.eq(1).Or(scl.eq(3)).Or(scl.eq(8)).Or(scl.eq(9)).Or(scl.eq(10)).Or(scl.eq(11))
            return img.updateMask(bad.Not())

        if body.mode == "range":
            composite = col.map(_mask_s2).median()
            label = f"{start_d} -> {end_d} (median)"
            scene_count = total
        else:
            newest = col.sort("system:time_start", False).first()
            day = ee.Date(newest.get("system:time_start")).format("YYYY-MM-dd").getInfo()
            d_dt = datetime.strptime(day, "%Y-%m-%d")
            day_col = col.filterDate(day, (d_dt + timedelta(days=1)).strftime("%Y-%m-%d"))
            composite = day_col.map(_mask_s2).mosaic()
            label = day
            scene_count = day_col.size().getInfo()

        img = composite.select(bands)
        raw = img.reduceRegion(
            reducer=ee.Reducer.percentile([2, 98]),
            geometry=region,
            scale=10,
            maxPixels=1_000_000_000,
            bestEffort=True
        ).getInfo()

        mins = [raw.get(f"{b}_p2") for b in bands]
        maxs = [raw.get(f"{b}_p98") for b in bands]
        if any(v is None for v in mins) or any(v is None for v in maxs):
            raise HTTPException(422, "ALL_MASKED")

        if body.preset in ("trueColor", "natural"):
            lo = min(mins); hi = max(maxs)
            mins = [lo for _ in mins]
            maxs = [hi for _ in maxs]
        maxs = [m if m > mins[i] else mins[i] + 1 for i, m in enumerate(maxs)]

        box = region.buffer(pad_meters).bounds(1)
        ring = box.coordinates().getInfo()[0]
        lons = [c[0] for c in ring]; lats = [c[1] for c in ring]
        lon_min, lon_max = min(lons), max(lons)
        lat_min, lat_max = min(lats), max(lats)
        lat_mid = (lat_min + lat_max) / 2.0
        width_m = (lon_max - lon_min) * 111320.0 * math.cos(math.radians(lat_mid))
        height_m = (lat_max - lat_min) * 110574.0
        w = max(8, math.ceil(width_m / 10.0))
        h = max(8, math.ceil(height_m / 10.0))
        k = min(1.0, 2048.0 / max(w, h))
        w = round(w * k); h = round(h * k)

        vis_img = img.visualize(bands=bands, min=mins, max=maxs, gamma=1)
        thumb_url = vis_img.getThumbURL({
            "region": box,
            "dimensions": f"{w}x{h}",
            "format": "png",
            "crs": "EPSG:4326"
        })
        return {
            "url": thumb_url,
            "bounds": [[lat_min, lon_min], [lat_max, lon_max]],
            "date": label,
            "scenes": scene_count,
            "preset": body.preset,
            "stretch": {"bands": bands, "mins": mins, "maxs": maxs}
        }

    try:
        return await asyncio.to_thread(_execute)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"EE render error: {exc}") from exc

@app.post("/api/earth-engine/map")
async def create_map(request: Request, body: MapReq) -> dict:
    """Live GEE tile: band combos + 16 indices, SCL masking, 2-98% percentile stretch."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    start, end = _dr(body)
    ck = _ck(body.coordinates, body.mode, start, end, body.max_cloud, body.indicator_id, body.band_combination, body.compositing, body.percentile_stretch)
    cached = _cache_get(ck)
    if cached: return {**cached,"cached":True}

    def _render() -> dict:
        field = _geom(body.coordinates)
        col = _s2col(field, start, end, body.max_cloud)
        n: int = col.size().getInfo()
        if n == 0: raise HTTPException(404,"No Sentinel-2 scenes.")
        img = _comp(col, body.compositing).clip(field)
        combo = body.band_combination
        if not combo and body.indicator_id in BAND_COMBOS:
            combo = body.indicator_id

        if combo:
            bands = BAND_COMBOS[combo]; vz = COMBO_VIZ.get(combo, COMBO_VIZ["natural"])
            sc = img.divide(10000).select(bands)
            if body.percentile_stretch:
                pct = sc.reduceRegion(ee.Reducer.percentile([2,98]),geometry=field,scale=30,maxPixels=1_000_000).getInfo()
                vis = {"bands":bands,"min":[pct.get(f"{b}_p2",vz["min"][i]) for i,b in enumerate(bands)],"max":[pct.get(f"{b}_p98",vz["max"][i]) for i,b in enumerate(bands)],"gamma":vz["gamma"],"format":"png"}
            else: vis = {"bands":bands,**vz,"format":"png"}
            mid = sc.getMapId(vis)
        else:
            ind = body.indicator_id or "ndvi"; spec = INDICATORS.get(ind)
            if not spec: raise HTTPException(422, f"Unknown indicator: {ind}")
            ii = _ind_img(img, ind)
            if body.percentile_stretch:
                pct = ii.reduceRegion(ee.Reducer.percentile([2,98]),geometry=field,scale=30,maxPixels=1_000_000).getInfo()
                vis = {"min":pct.get(f"{ind}_p2",spec["lo"]),"max":pct.get(f"{ind}_p98",spec["hi"]),"palette":spec["p"],"format":"png"}
            else: vis = {"min":body.visualization.minimum,"max":body.visualization.maximum,"palette":body.visualization.palette,"format":"png"}
            mid = ii.getMapId(vis)
        ldate: str = col.sort("system:time_start",False).first().date().format("YYYY-MM-dd").getInfo()
        result = {"tileUrl":_tileurl(mid),"source":"GEE/COPERNICUS/S2_SR_HARMONIZED","sceneCount":n,"latestSceneDate":ldate,"compositing":body.compositing,"stretchMode":"pct_2_98" if body.percentile_stretch else "manual","cached":False}
        _cache_set(ck, result); return result

    try: return await asyncio.to_thread(_render)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, f"EE error: {exc}") from exc

@app.post("/api/earth-engine/stats")
async def stats(request: Request, body: StatsReq) -> dict:
    """Zonal stats: mean/min/max/stdDev/p25/p75 for multiple indicators."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    start, end = _dr(body)
    def _compute() -> dict:
        field = _geom(body.coordinates); col = _s2col(field,start,end,body.max_cloud)
        n: int = col.size().getInfo()
        if n == 0: raise HTTPException(404,"No scenes.")
        img = col.median().clip(field); out: dict[str,Any] = {"sceneCount":n,"indicators":{}}
        for ind in body.indicators:
            if ind not in INDICATORS: continue
            ii = _ind_img(img, ind)
            s = ii.reduceRegion(ee.Reducer.mean().combine(ee.Reducer.minMax(),sharedInputs=True).combine(ee.Reducer.stdDev(),sharedInputs=True).combine(ee.Reducer.percentile([25,75]),sharedInputs=True),geometry=field,scale=body.scale,maxPixels=5_000_000,bestEffort=True).getInfo()
            out["indicators"][ind] = {k2: round(s.get(f"{ind}_{k2}",0) or 0,4) for k2 in ["mean","min","max","stdDev","p25","p75"]}
        return out
    try: return await asyncio.to_thread(_compute)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, str(exc)) from exc

@app.post("/api/earth-engine/timeseries")
async def timeseries(request: Request, body: TSReq) -> dict:
    """Temporal indicator series at configurable 5-120 day intervals."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    if (body.end_date - body.start_date).days > 730: raise HTTPException(422,"Max 2 years.")
    def _compute() -> dict:
        field = _geom(body.coordinates)
        if body.indicator_id not in INDICATORS: raise HTTPException(422,f"Unknown indicator: {body.indicator_id}")
        pts: list[dict] = []; cur = body.start_date
        while cur <= body.end_date:
            we = min(cur + timedelta(days=body.interval_days-1), body.end_date)
            col = _s2col(field, cur, we, body.max_cloud); n: int = col.size().getInfo()
            if n > 0:
                ii = _ind_img(col.median().clip(field), body.indicator_id)
                s = ii.reduceRegion(ee.Reducer.mean().combine(ee.Reducer.stdDev(),sharedInputs=True),geometry=field,scale=body.scale,maxPixels=2_000_000,bestEffort=True).getInfo()
                mv = s.get(f"{body.indicator_id}_mean"); sv = s.get(f"{body.indicator_id}_stdDev")
                pts.append({"date":cur.isoformat(),"windowEnd":we.isoformat(),"value":round(mv,4) if mv is not None else None,"stdDev":round(sv,4) if sv is not None else None,"sceneCount":n})
            else: pts.append({"date":cur.isoformat(),"windowEnd":we.isoformat(),"value":None,"sceneCount":0})
            cur += timedelta(days=body.interval_days)
        return {"indicator":body.indicator_id,"intervalDays":body.interval_days,"points":pts}
    try: return await asyncio.to_thread(_compute)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, str(exc)) from exc

@app.post("/api/earth-engine/change")
async def change(request: Request, body: ChangeReq) -> dict:
    """Bi-temporal change: delta tile URL + gain/loss area %."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    def _compute() -> dict:
        field = _geom(body.coordinates)
        if body.indicator_id not in INDICATORS: raise HTTPException(422,f"Unknown: {body.indicator_id}")
        cb = _s2col(field,body.before_start,body.before_end,body.max_cloud)
        ca = _s2col(field,body.after_start, body.after_end, body.max_cloud)
        nb: int = cb.size().getInfo(); na: int = ca.size().getInfo()
        if nb==0 or na==0: raise HTTPException(404,f"No scenes: before={nb}, after={na}")
        ib = _ind_img(cb.median().clip(field),body.indicator_id)
        ia = _ind_img(ca.median().clip(field),body.indicator_id)
        delta = ia.subtract(ib).rename("delta")
        mid = delta.getMapId({"min":-body.threshold,"max":body.threshold,"palette":["d73027","fc8d59","ffffbf","91cf60","1a9850"],"format":"png"})
        s = delta.reduceRegion(ee.Reducer.mean().combine(ee.Reducer.stdDev(),sharedInputs=True).combine(ee.Reducer.minMax(),sharedInputs=True),geometry=field,scale=30,maxPixels=5_000_000,bestEffort=True).getInfo()
        tp = delta.unmask(0).reduceRegion(ee.Reducer.count(),field,30,maxPixels=5_000_000,bestEffort=True).getInfo().get("delta",1) or 1
        gp = delta.gt(body.threshold).reduceRegion(ee.Reducer.sum(),field,30,maxPixels=5_000_000,bestEffort=True).getInfo().get("delta",0) or 0
        lp = delta.lt(-body.threshold).reduceRegion(ee.Reducer.sum(),field,30,maxPixels=5_000_000,bestEffort=True).getInfo().get("delta",0) or 0
        return {"tileUrl":_tileurl(mid),"indicator":body.indicator_id,"beforeScenes":nb,"afterScenes":na,"delta":{k2:round(s.get(f"delta_{k2}",0) or 0,4) for k2 in ["mean","stdDev","min","max"]},"gainedPct":round(100*gp/tp,1),"lostPct":round(100*lp/tp,1),"threshold":body.threshold}
    try: return await asyncio.to_thread(_compute)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, str(exc)) from exc

@app.post("/api/earth-engine/dem")
async def dem(request: Request, body: DemReq) -> dict:
    """Copernicus GLO-30 DEM: elevation/slope/aspect/hillshade tile."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    ck = _ck(body.coordinates, body.layer); cached = _cache_get(ck)
    if cached: return {**cached,"cached":True}
    def _render() -> dict:
        field = _geom(body.coordinates); img, vis = _dem_layers(field)[body.layer]
        mid = img.getMapId(vis)
        r = {"tileUrl":_tileurl(mid),"layer":body.layer,"source":"COPERNICUS/DEM/GLO30","cached":False}
        _cache_set(ck,r); return r
    try: return await asyncio.to_thread(_render)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, str(exc)) from exc

@app.post("/api/earth-engine/alert")
async def alert(request: Request, body: AlertReq) -> dict:
    """Crop stress: NDVI threshold alert tile + stressed area %."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    start, end = _dr(body)
    def _compute() -> dict:
        field = _geom(body.coordinates); col = _s2col(field,start,end,body.max_cloud)
        n: int = col.size().getInfo()
        if n == 0: raise HTTPException(404,"No scenes.")
        ndvi = col.median().clip(field).normalizedDifference(["B8","B4"]).rename("ndvi")
        stressed = ndvi.lt(body.ndvi_threshold)
        tp = ndvi.unmask(0).reduceRegion(ee.Reducer.count(),field,body.scale,maxPixels=2_000_000,bestEffort=True).getInfo().get("ndvi",1) or 1
        sp = stressed.reduceRegion(ee.Reducer.sum(),field,body.scale,maxPixels=2_000_000,bestEffort=True).getInfo().get("ndvi",0) or 0
        mn = ndvi.reduceRegion(ee.Reducer.mean(),field,body.scale,maxPixels=2_000_000,bestEffort=True).getInfo().get("ndvi")
        pct = round(100*sp/tp,1); fired = pct >= body.alert_pct
        mid = stressed.updateMask(stressed).getMapId({"min":0,"max":1,"palette":["00000000","d73027"],"format":"png"})
        return {"tileUrl":_tileurl(mid),"ndviThreshold":body.ndvi_threshold,"meanNdvi":round(mn or 0,4),"stressedPct":pct,"alertTriggered":fired,"alertMessage":(f"ALERT: {pct}% below NDVI {body.ndvi_threshold}." if fired else f"OK: {pct}% stressed."),"sceneCount":n}
    try: return await asyncio.to_thread(_compute)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, str(exc)) from exc

@app.get("/api/earth-engine/indicators")
async def list_indicators() -> dict:
    return {"indicators":[{"id":k,"min":v["lo"],"max":v["hi"],"palette":v["p"]} for k,v in INDICATORS.items()],"bandCombinations":[{"id":k,"bands":v} for k,v in BAND_COMBOS.items()]}

class LulcReq(PolyBase):
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

# Dynamic World class definitions
DW_CLASSES = [
    {"id": 0, "name": "Water",            "color": "419BDF"},
    {"id": 1, "name": "Trees",            "color": "397D49"},
    {"id": 2, "name": "Grass",            "color": "88B053"},
    {"id": 3, "name": "Flooded Vegetation","color": "7A87C6"},
    {"id": 4, "name": "Crops",            "color": "E49635"},
    {"id": 5, "name": "Shrub & Scrub",    "color": "DFC35A"},
    {"id": 6, "name": "Built Area",       "color": "C4281B"},
    {"id": 7, "name": "Bare Ground",      "color": "A59B8F"},
    {"id": 8, "name": "Snow & Ice",       "color": "B39FE1"},
]
DW_PALETTE = [c["color"] for c in DW_CLASSES]

@app.post("/api/earth-engine/lulc")
async def lulc(request: Request, body: LulcReq) -> dict:
    """Dynamic World v1 land-cover classification: tile URL + class-area statistics for AOI."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    start, end = _dr(body)
    ck = _ck(body.coordinates, "lulc", start, end)
    cached = _cache_get(ck)
    if cached: return {**cached, "cached": True}

    def _compute() -> dict:
        field = _geom(body.coordinates)
        dw = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
              .filterBounds(field)
              .filterDate(start.isoformat(), (end + timedelta(days=1)).isoformat()))
        n: int = dw.size().getInfo()
        if n == 0:
            # Widen to 6 months if no scenes in window
            wide_start = (datetime.combine(end, datetime.min.time()) - timedelta(days=180)).date()
            dw = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                  .filterBounds(field)
                  .filterDate(wide_start.isoformat(), (end + timedelta(days=1)).isoformat()))
            n = dw.size().getInfo()
        if n == 0:
            raise HTTPException(404, "No Dynamic World scenes found for this AOI.")

        # Mode composite: most frequent class per pixel
        label_mode = dw.select("label").mode().clip(field)

        # Tile URL
        mid = label_mode.getMapId({
            "min": 0, "max": 8,
            "palette": DW_PALETTE,
            "format": "png"
        })

        # Class-area statistics (ha) at 10m native resolution
        total_pixels = label_mode.unmask(99).reduceRegion(
            reducer=ee.Reducer.count(),
            geometry=field, scale=10, maxPixels=1_000_000_000, bestEffort=True
        ).getInfo().get("label", 1) or 1

        area_list = []
        for cls in DW_CLASSES:
            count = label_mode.eq(cls["id"]).unmask(0).reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=field, scale=10, maxPixels=1_000_000_000, bestEffort=True
            ).getInfo().get("label", 0) or 0
            area_ha = round(count * 0.01, 2)   # 10m pixel = 100 m2 = 0.01 ha
            pct = round(100 * count / total_pixels, 2) if total_pixels else 0
            area_list.append({
                "id": cls["id"], "name": cls["name"], "color": cls["color"],
                "area_ha": area_ha, "pct": pct
            })

        result = {
            "tileUrl": _tileurl(mid),
            "source": "GOOGLE/DYNAMICWORLD/V1",
            "sceneCount": n,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "classes": DW_CLASSES,
            "palette": DW_PALETTE,
            "classAreas": area_list,
            "cached": False
        }
        _cache_set(ck, result)
        return result

    try: return await asyncio.to_thread(_compute)
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, f"LULC error: {exc}") from exc


class ExportReq(PolyBase):
    """A real, georeferenced GeoTIFF of one product over the area of interest."""
    mode: ModeLit = "latest"
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_cloud: int = Field(default=30, ge=0, le=100)
    indicator_id: Optional[str] = Field(default=None, max_length=24)
    band_combination: Optional[BandComboLit] = None
    dem_layer: Optional[DemLit] = None
    land_cover: bool = False
    scale: int = Field(default=10, ge=10, le=120)


@app.post("/api/earth-engine/export")
async def export(request: Request, body: ExportReq) -> dict:
    """Hand back a download URL for a GeoTIFF of the area of interest.

    Desktop GIS wants real files, not just tiles: this is what lets ArcGIS and QGIS
    open the same product as a raster, and what a user saves for later analysis.
    Raw band values are exported, never a colour rendering, so the numbers mean
    something when the file is opened elsewhere.
    """
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    start, end = _dr(body)
    product = body.indicator_id or body.band_combination or body.dem_layer or ("lulc" if body.land_cover else None)
    if not product:
        raise HTTPException(422, "Ask for one of indicator_id, band_combination, dem_layer or land_cover.")
    if body.indicator_id and body.indicator_id not in INDICATORS:
        raise HTTPException(422, f"Unknown indicator: {body.indicator_id}")

    def _build() -> dict:
        field = _geom(body.coordinates)
        if body.dem_layer:
            image, source, scenes = _dem_layers(field)[body.dem_layer][0], "COPERNICUS/DEM/GLO30", None
        elif body.land_cover:
            collection = (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                          .filterBounds(field)
                          .filterDate(start.isoformat(), (end + timedelta(days=1)).isoformat()))
            scenes = collection.size().getInfo()
            if scenes == 0:
                raise HTTPException(404, "No Dynamic World scenes for this area and window.")
            image, source = collection.select("label").mode().clip(field).rename("land_cover"), "GOOGLE/DYNAMICWORLD/V1"
        else:
            collection = _s2col(field, start, end, body.max_cloud)
            scenes = collection.size().getInfo()
            if scenes == 0:
                raise HTTPException(404, "No Sentinel-2 scenes in this window. Widen the dates or raise the cloud limit.")
            composite = _comp(collection, "median").clip(field)
            if body.band_combination:
                bands = BAND_COMBOS[body.band_combination]
                image, source = composite.divide(10000).select(bands), "GEE/COPERNICUS/S2_SR_HARMONIZED"
            else:
                image, source = _ind_img(composite, body.indicator_id), "GEE/COPERNICUS/S2_SR_HARMONIZED"

        ring = field.bounds(1).coordinates().getInfo()[0]
        lons = [point[0] for point in ring]
        lats = [point[1] for point in ring]
        bounds = [min(lons), min(lats), max(lons), max(lats)]
        url = image.getDownloadURL(
            {
                "region": [[point[0], point[1]] for point in body.coordinates],
                "scale": body.scale,
                "crs": "EPSG:4326",
                "format": "GEO_TIFF",
                "filePerBand": False,
            }
        )
        if isinstance(url, dict):
            url = url.get("url", "")
        return {
            "downloadUrl": url,
            "format": "GEO_TIFF",
            "crs": "EPSG:4326",
            "scaleMeters": body.scale,
            "bounds": bounds,
            "product": product,
            "source": source,
            "sceneCount": scenes,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "maxCloud": body.max_cloud,
            "note": (
                "Raw values, not a colour rendering. The link is short-lived: download it immediately. "
                "Earth Engine caps how many pixels one request may return, so lower the scale for a very large area."
            ),
        }

    try:
        return await asyncio.to_thread(_build)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Export error: {exc}") from exc


# === Desktop plugin planning ===
llm.configure(indicators=list(INDICATORS.keys()), band_combinations=list(BAND_COMBOS.keys()))

@app.post("/api/earth-engine/interpret")
async def interpret(request: Request, body: InterpretReq) -> dict:
    """Turn one sentence per box into a validated operation plan.

    Deliberately independent of Earth Engine: a model outage or an unconfigured
    provider degrades to the deterministic planner instead of failing the request.
    """
    _check_rate(request.client.host if request.client else "x")
    defaults = {
        "start_date": body.start_date.isoformat() if body.start_date else None,
        "end_date": body.end_date.isoformat() if body.end_date else None,
        "max_cloud": body.max_cloud,
    }
    result = await asyncio.to_thread(llm.interpret, body.sentences, defaults)
    result["planVersion"] = llm.PLAN_VERSION
    result["providerConfigured"] = bool(llm.provider_config())
    return result

# === Vector-producing operations ===
ZONE_LIMITATION = (
    "Zones are classes of the chosen indicator over the selected dates on the stated sensor "
    "resolution, not a site survey. Change the dates or the class count and the boundaries move. "
    "Treat every polygon as a lead for field verification."
)
CANDIDATE_NOTES = {
    "hotspot": "Lowest-ranked pixels of the vegetation signal: the first places to walk, not a confirmed diagnosis.",
    "water": "Surface water detected from the water-sensitive bands. Depth is not measured and water under vegetation or below ground is invisible.",
    "fallow": "Bare and sparsely vegetated cover suggested by the soil and vegetation ratios; freshly worked soil and dry stubble look the same.",
    "built": "Built-up surface suggested by the short-wave infrared ratio; bare rock and dry salt pans share the signature.",
    "linear": (
        "Candidate alignment corridors (roads, canals, bunds, tracks) from edge strength. "
        "Individual poles, cables, pipes and any structure narrower than the pixel size cannot "
        "be resolved in this imagery and must be surveyed on the ground."
    ),
}


def _sensor_resolution_m() -> float:
    return 10.0  # Sentinel-2 L2A native ground sample distance for the visible/NIR bands.


def _hectares(pixel_count: float, scale: int) -> float:
    return round(float(pixel_count) * float(scale) * float(scale) / 10000.0, 3)


def _vectorise(mask: ee.Image, field: ee.Geometry, scale: int, min_pixels: int, max_features: int) -> dict:
    """Polygonise a binary mask inside the area of interest, dropping slivers.

    Vertex counts are bounded on purpose: a polygon per pixel over a large area would
    produce a payload no desktop client can absorb, so the response states when it
    truncated instead of silently returning part of the answer.
    """
    # reduceToVectors writes the reduced value under labelProperty, so the pixel count
    # is named here rather than assumed to appear as "count".
    vectors = mask.selfMask().reduceToVectors(
        geometry=field,
        scale=scale,
        geometryType="polygon",
        eightConnected=True,
        labelProperty="pixels",
        reducer=ee.Reducer.countEvery(),
        maxPixels=1_000_000_000,
        bestEffort=True,
        tileScale=4,
    )
    kept = vectors.filter(ee.Filter.gte("pixels", max(1, min_pixels)))
    total = kept.size().getInfo()
    selected = kept.limit(int(max_features))
    info = selected.getInfo()

    features = []
    vertex_budget = 200_000
    truncated_for_size = False
    for feature in info.get("features", []):
        geometry = feature.get("geometry") or {}
        rings = geometry.get("coordinates") or []
        vertices = sum(len(ring) for ring in rings)
        if vertex_budget - vertices < 0:
            truncated_for_size = True
            break
        vertex_budget -= vertices
        count = (feature.get("properties") or {}).get("pixels", 0)
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {"pixels": count, "hectares": _hectares(count, scale)},
            }
        )

    return {
        "features": features,
        "reportedFeatures": int(total),
        "returnedFeatures": len(features),
        "truncated": truncated_for_size or int(total) > int(max_features),
    }


def _quantile_breaks(image: ee.Image, field: ee.Geometry, scale: int, classes: int) -> list[float]:
    if classes <= 1:
        return []
    percentiles = [100.0 * index / classes for index in range(1, classes)]
    raw = image.reduceRegion(
        reducer=ee.Reducer.percentile(percentiles),
        geometry=field,
        scale=scale,
        maxPixels=1_000_000_000,
        bestEffort=True,
    ).getInfo()
    return sorted(value for value in raw.values() if value is not None)


@app.post("/api/earth-engine/zones")
async def zones(request: Request, body: ZonesReq) -> dict:
    """Healthy, stressed or hotspot areas as real polygons, plus the raster behind them."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    if body.indicator_id not in INDICATORS:
        raise HTTPException(422, f"Unknown indicator: {body.indicator_id}")
    start, end = _dr(body)

    def _compute() -> dict:
        field = _geom(body.coordinates)
        collection = _s2col(field, start, end, body.max_cloud)
        scenes: int = collection.size().getInfo()
        if scenes == 0:
            raise HTTPException(404, "No Sentinel-2 scenes in this window. Widen the dates or raise the cloud limit.")
        index_image = _ind_img(collection.median().clip(field), body.indicator_id)

        if body.class_mode == "absolute" and body.threshold is not None:
            cut = float(body.threshold)
            breaks = [cut]
        else:
            breaks = _quantile_breaks(index_image, field, body.scale, body.classes)
            if not breaks:
                cuts = index_image.reduceRegion(
                    reducer=ee.Reducer.percentile([20.0 if body.level == "low" else 80.0]),
                    geometry=field, scale=body.scale, maxPixels=1_000_000_000, bestEffort=True,
                ).getInfo()
                values = [v for v in cuts.values() if v is not None]
                if not values:
                    raise HTTPException(404, "Every pixel in this area was masked out (cloud, shadow or nodata).")
                breaks = [float(values[0])]

        cut = breaks[0] if body.level == "low" else breaks[-1]
        mask = index_image.lt(cut) if body.level == "low" else index_image.gt(cut)
        min_pixels = max(1, int(round(body.min_hectares * 10000.0 / (body.scale * body.scale))))
        result = _vectorise(mask, field, body.scale, min_pixels, body.max_features)

        mean_raw = index_image.updateMask(mask).reduceRegion(
            reducer=ee.Reducer.mean(), geometry=field, scale=body.scale,
            maxPixels=1_000_000_000, bestEffort=True,
        ).getInfo()
        mean_index = next((v for v in mean_raw.values() if v is not None), None)
        palette = (INDICATORS[body.indicator_id]["p"][:2] if body.level == "low" else INDICATORS[body.indicator_id]["p"][-2:])
        mid = mask.selfMask().getMapId({"min": 0, "max": 1, "palette": palette, "format": "png"})

        total_hectares = round(sum(f["properties"]["hectares"] for f in result["features"]), 3)
        return {
            "type": "FeatureCollection",
            "features": result["features"],
            "cut": round(float(cut), 5),
            "level": body.level,
            "indicator": body.indicator_id,
            "classes": body.classes,
            "classMode": body.class_mode,
            "meanIndex": round(float(mean_index), 4) if mean_index is not None else None,
            "sceneCount": scenes,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "maxCloud": body.max_cloud,
            "zoneHectares": total_hectares,
            "reportedFeatures": result["reportedFeatures"],
            "returnedFeatures": result["returnedFeatures"],
            "truncated": result["truncated"],
            "tileUrl": _tileurl(mid),
            "source": "GEE/COPERNICUS/S2_SR_HARMONIZED",
            "scaleMeters": body.scale,
            "sensorResolutionMeters": _sensor_resolution_m(),
            "method": "area percentile classes on a median composite, polygonised with reduceToVectors",
            "limitations": [ZONE_LIMITATION],
        }

    try:
        return await asyncio.to_thread(_compute)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Zone error: {exc}") from exc


def _dem_grid(field: ee.Geometry, target_meters: int, max_dimension: int):
    """Download the clipped elevation model as a NumPy array over an exact lon/lat grid.

    ``dimensions`` (not ``scale``) fixes the grid to the requested bounding box, so the
    row/column to coordinate mapping used later for the stream lines cannot drift by a pixel.
    """
    ring = field.bounds(1).coordinates().getInfo()[0]
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    lon_min, lon_max = min(lons), max(lons)
    lat_min, lat_max = min(lats), max(lats)
    mid_lat = (lat_min + lat_max) / 2.0
    width_m = (lon_max - lon_min) * 111320.0 * math.cos(math.radians(mid_lat))
    height_m = (lat_max - lat_min) * 110574.0
    cols = max(16, min(int(max_dimension), int(round(width_m / float(target_meters))) or 16))
    rows = max(16, min(int(max_dimension), int(round(height_m / float(target_meters))) or 16))

    elevation = (
        ee.ImageCollection("COPERNICUS/DEM/GLO30")
        .filterBounds(field)
        .select("DEM")
        .mosaic()
        .clip(field)
        .rename("elevation")
    )
    region = [[lon_min, lat_min], [lon_max, lat_min], [lon_max, lat_max], [lon_min, lat_max]]
    url = elevation.getDownloadURL(
        {"region": region, "dimensions": f"{cols}x{rows}", "crs": "EPSG:4326", "format": "NPY"}
    )
    with urllib.request.urlopen(url, timeout=180) as response:
        payload = response.read()
    array = np.load(io.BytesIO(payload), allow_pickle=False)
    array = np.asarray(array, dtype=np.float64)
    if array.ndim == 3:
        array = array[:, :, 0]
    return array, (lon_min, lat_min, lon_max, lat_max)


@app.post("/api/earth-engine/streams")
async def streams(request: Request, body: StreamsReq) -> dict:
    """Stream lines where water flows down the slope, traced on the 30 m elevation model."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()

    def _compute() -> dict:
        field = _geom(body.coordinates)
        array, bounds = _dem_grid(field, body.target_meters, body.max_dimension)
        valid = np.isfinite(array) & (array > -500.0)
        features = analyse_streams(
            array,
            bounds,
            valid=valid,
            threshold_percentile=body.percentile,
            min_points=body.min_points,
        )
        stats = features["stats"]
        stats["source"] = "COPERNICUS/DEM/GLO30"
        stats["areaHectares"] = _hectares(float(valid.sum()), body.target_meters)
        return {"type": "FeatureCollection", "features": features["features"], "stats": stats}

    try:
        return await asyncio.to_thread(_compute)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Stream error: {exc}") from exc


@app.post("/api/earth-engine/candidates")
async def candidates(request: Request, body: CandidatesReq) -> dict:
    """Candidate features for field verification, with the uncertainty stated outright."""
    _check_rate(request.client.host if request.client else "x"); await _ensure_ee()
    start, end = _dr(body)

    def _compute() -> dict:
        field = _geom(body.coordinates)
        collection = _s2col(field, start, end, body.max_cloud)
        scenes: int = collection.size().getInfo()
        if scenes == 0:
            raise HTTPException(404, "No Sentinel-2 scenes in this window. Widen the dates or raise the cloud limit.")
        composite = collection.median().clip(field)
        baseline = _ind_img(composite, "ndvi")
        cut = body.threshold

        if body.kind == "hotspot":
            cut = cut if cut is not None else (_quantile_breaks(baseline, field, body.scale, 4) or [0.25])[0]
            mask = baseline.lt(cut)
            palette = ["1a9850", "d73027"]
        elif body.kind == "water":
            water = _ind_img(composite, "mndwi")
            cut = cut if cut is not None else 0.0
            mask = water.gt(cut)
            palette = ["d7191c", "2c7bb6"]
        elif body.kind == "fallow":
            bare = _ind_img(composite, "bsi")
            cut = cut if cut is not None else 0.0
            mask = bare.gt(cut)
            palette = ["006837", "fee08b"]
        elif body.kind == "built":
            built = _ind_img(composite, "ndbi")
            cut = cut if cut is not None else 0.05
            mask = built.gt(cut)
            palette = ["d9ef8b", "a50026"]
        else:  # linear alignment corridors from edge strength
            natural = composite.divide(10000).select(["B8", "B4", "B3"])
            edges = ee.Algorithms.CannyEdgeDetector(natural.visualize(min=0.02, max=0.4, bands=["B8", "B4", "B3"]), 0.6, 0.7)
            mask = edges.gt(0).focal_max(1, "square", "meters")
            cut = None
            palette = ["000000", "f46d43"]

        min_pixels = max(1, int(round(body.min_hectares * 10000.0 / (body.scale * body.scale))))
        result = _vectorise(mask, field, body.scale, min_pixels, body.max_features)
        mid = mask.selfMask().getMapId({"min": 0, "max": 1, "palette": palette, "format": "png"})

        return {
            "type": "FeatureCollection",
            "features": result["features"],
            "kind": body.kind,
            "cut": round(float(cut), 5) if cut is not None else None,
            "candidateHectares": round(sum(f["properties"]["hectares"] for f in result["features"]), 3),
            "sceneCount": scenes,
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "reportedFeatures": result["reportedFeatures"],
            "returnedFeatures": result["returnedFeatures"],
            "truncated": result["truncated"],
            "tileUrl": _tileurl(mid),
            "source": "GEE/COPERNICUS/S2_SR_HARMONIZED",
            "scaleMeters": body.scale,
            "sensorResolutionMeters": _sensor_resolution_m(),
            "status": "candidate",
            "limitations": [CANDIDATE_NOTES[body.kind], "Every feature is unconfirmed until verified on the ground."],
        }

    try:
        return await asyncio.to_thread(_compute)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Candidate error: {exc}") from exc


@app.delete("/api/cache")
async def clear_cache() -> dict:
    n = len(_tile_cache); _tile_cache.clear(); return {"cleared": n}

