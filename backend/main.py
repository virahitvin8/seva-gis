# SEVA GIS - Google Earth Engine tile service
from __future__ import annotations
import asyncio, hashlib, logging, os, time
from collections import defaultdict, deque
from datetime import date, timedelta
from typing import Any, Literal, Optional
import ee
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s - %(message)s")
log = logging.getLogger("seva-gee")

PROJECT_ID: str = os.environ.get("EE_PROJECT_ID", "seva-gis-backend").strip()
ALLOWED_ORIGINS: list[str] = [o.strip() for o in os.environ.get("EE_ALLOWED_ORIGINS", "http://localhost:8443,http://localhost:5173,https://seva-gis.web.app").split(",") if o.strip()]
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
    global _ee_ready
    if _ee_ready: return
    if not PROJECT_ID: raise RuntimeError("EE_PROJECT_ID required.")
    # Cloud Run supplies short-lived Application Default Credentials from the
    # attached service identity. No service-account key is needed or accepted.
    ee.Initialize(project=PROJECT_ID)
    log.info("EE: Cloud Run Application Default Credentials")
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
    dem = ee.ImageCollection("COPERNICUS/DEM/GLO30").filterBounds(field).select("DEM").mosaic().clip(field)
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

def _tileurl(mid: dict) -> str:
    return f"https://earthengine.googleapis.com/map/{mid['mapid']}/{{z}}/{{x}}/{{y}}?token={mid['token']}"

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
    max_cloud: int = Field(default=40, ge=0, le=100)
    ndvi_threshold: float = Field(default=0.3, ge=-1.0, le=1.0)
    alert_pct: float = Field(default=30.0, ge=1.0, le=100.0)
    scale: int = Field(default=30, ge=10, le=500)

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
        if body.band_combination:
            bands = BAND_COMBOS[body.band_combination]; vz = COMBO_VIZ.get(body.band_combination, COMBO_VIZ["natural"])
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

@app.delete("/api/cache")
async def clear_cache() -> dict:
    n = len(_tile_cache); _tile_cache.clear(); return {"cleared":n}
