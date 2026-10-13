"""Natural-language query planning for the SEVA.GIS desktop plugins.

The QGIS and ArcMap plugins let a user type one sentence per box, for example
"make a red boundary line of my area" or "show only the healthy zones". Turning
those sentences into operations happens here rather than on the desktop, for
three reasons:

* the plugin stays a thin client with no model key on the user's machine,
* one planner serves QGIS, ArcGIS Pro and ArcMap identically,
* the plan is validated against one schedule, so an unknown operation can never
  reach Earth Engine.

Two engines produce the same plan shape:

``llm``
    A hosted model is asked for JSON only. Vertex AI is called with the service
    identity the backend already runs as, so no extra key is needed;
    an OpenAI-compatible endpoint (including a gateway) is supported by setting
    ``EE_LLM_BASE_URL`` and ``EE_LLM_API_KEY``.
``rules``
    A deterministic keyword planner. It needs no key and no network, so the
    feature works out of the box and still works when the model is unavailable
    or returns something unusable.

Every sentence gets exactly one box, even if both engines fail, so a user never
loses a query silently. Anything the planner could not fully honour is reported
in ``warnings`` and on the box as a ``note``.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta

PLAN_VERSION = 1

OP_NAMES = (
    "index",
    "composite",
    "dem",
    "lulc",
    "zones",
    "streams",
    "candidates",
    "boundary",
    "stats",
    "change",
    "alert",
    # A box that only states dates or a cloud limit. It draws nothing; it sets the
    # window for every other box, which is what "I forgot to add the date" means.
    "settings",
)

DEM_LAYERS = ("elevation", "slope", "aspect", "hillshade")
CANDIDATE_KINDS = ("hotspot", "water", "fallow", "built", "linear")
ZONE_LEVELS = ("low", "high")

# Replaced by main.py at import time so the indicator and band-combination lists
# have exactly one definition in the service.
INDICATORS: tuple[str, ...] = ("ndvi", "evi", "savi", "ndwi", "ndmi", "bsi")
BAND_COMBINATIONS: tuple[str, ...] = (
    "natural",
    "cir",
    "agri",
    "moisture",
    "swir",
    "chlorophyll",
    "geology",
    "redge",
    "bathymetric",
    "urban",
)

COLORS = {
    "red": "#e31a1c",
    "green": "#1a9850",
    "blue": "#2c7bb6",
    "yellow": "#fdd835",
    "orange": "#f46d43",
    "purple": "#7b3294",
    "magenta": "#c51b8a",
    "cyan": "#00acc1",
    "black": "#000000",
    "white": "#ffffff",
}

MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sep": 9, "sept": 9, "october": 10, "oct": 10,
    "november": 11, "nov": 11, "december": 12, "dec": 12,
}

INDEX_SYNONYMS = {
    "ndvi": ("ndvi", "vegetation index", "greenness", "crop health", "plant health", "vigour", "vigor"),
    "evi": ("evi", "enhanced vegetation"),
    "savi": ("savi", "soil adjusted", "soil-adjusted"),
    "msavi": ("msavi", "modified soil adjusted"),
    "gndvi": ("gndvi", "green ndvi"),
    "ndre": ("ndre", "red edge index", "red-edge index"),
    "cire": ("cire", "chlorophyll index red edge"),
    "chla": ("chla", "chlorophyll index"),
    "reip": ("reip", "red edge inflection"),
    "stress": ("crop stress index", "water stress index"),
    "lai": ("lai", "leaf area index"),
    "nbr": ("nbr", "burn severity", "burn scar", "fire severity", "burnt area", "burned area", "burnt", "burned", "burn", "fire damage"),
    "ndmi": ("ndmi", "leaf moisture", "moisture index", "water content"),
    "mndwi": ("mndwi", "modified water index"),
    "ndwi": ("ndwi", "water index", "surface water index"),
    "msi": ("msi", "moisture stress index"),
    "bsi": ("bsi", "bare soil index", "soil index"),
    "ndbi": ("ndbi", "built up index", "built-up index", "impervious", "urban index"),
    "swir_r": ("swir ratio", "swir band ratio"),
}

COMPOSITE_SYNONYMS = {
    "natural": ("true colour", "true color", "natural colour", "natural color", "true-colour", "true-color", "rgb image"),
    "cir": ("false colour", "false color", "colour infrared", "color infrared", "infrared composite", "cir image"),
    "agri": ("agriculture composite", "agricultural composite", "crop composite"),
    "moisture": ("moisture composite", "moisture colour", "moisture color"),
    "swir": ("swir composite", "shortwave infrared composite"),
    "chlorophyll": ("chlorophyll composite",),
    "geology": ("geology composite", "geological composite"),
    "redge": ("red edge composite", "red-edge composite", "rededge composite"),
    "bathymetric": ("bathymetric", "bathymetry", "underwater view"),
    "urban": ("urban composite", "built up composite", "built-up composite"),
}

DEM_SYNONYMS = {
    "elevation": ("elevation", "height", "dem", "terrain", "topography"),
    "slope": ("slope", "gradient"),
    "aspect": ("aspect",),
    "hillshade": ("hillshade", "hill shade"),
}

LIMITATIONS = {
    "poles": (
        "Electrical poles cannot be resolved here: a pole is well under one metre wide while "
        "Sentinel-2 records 10 m pixels, so no pole is individually visible in this imagery. "
        "The closest honest substitute is a candidate linear-feature layer (roads, canals, bunds, "
        "tracks) that supplies the alignment poles would follow, and it stays flagged as candidate."
    ),
    "candidates": (
        "Candidate features are derived from the satellite bands at the stated resolution and are "
        "suggestions for field verification, never confirmed infrastructure."
    ),
    "zones": (
        "Zones are classes of the chosen indicator over the selected dates, not a site survey. "
        "Adjust the class count or the dates and the boundaries move."
    ),
    "streams": (
        "Stream lines follow surface slope from the 30 m elevation model. They show where water "
        "would flow, not a surveyed channel, and drainage through pipes or canals is invisible."
    ),
    "change": (
        "Change is measured between the two date windows only. Phenology, cloud gaps and "
        "different overpass angles can all register as change."
    ),
}


def configure(indicators=None, band_combinations=None, dem_layers=None) -> None:
    """Bind this planner to the service's real vocabulary (called once by main.py)."""
    global INDICATORS, BAND_COMBINATIONS, DEM_LAYERS
    if indicators:
        INDICATORS = tuple(indicators)
    if band_combinations:
        BAND_COMBINATIONS = tuple(band_combinations)
    if dem_layers:
        DEM_LAYERS = tuple(dem_layers)


# --------------------------------------------------------------------------- helpers
def _normalise_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


WORD_NUMBERS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "a couple of": "2", "a few": "3",
}


def digitise(text: str) -> str:
    """Turn small spoken numbers into digits so "two percent cloud" parses.

    Word boundaries on both sides keep 'zone' and 'zones' intact when 'one' is replaced.
    """
    out = text
    for word, digit in WORD_NUMBERS.items():
        out = re.sub(r"(?<![a-z])" + word + r"(?![a-z])", digit, out)
    return out


def _find_phrase(haystack: str, phrases) -> str | None:
    """Longest matching phrase wins, so 'mndwi' is never read as 'ndwi'."""
    best = None
    for phrase in phrases:
        pattern = r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])"
        if re.search(pattern, haystack):
            if best is None or len(phrase) > len(best):
                best = phrase
    return best


def _named(text: str, synonyms: dict) -> list[str]:
    """Every term from a synonym table that appears, in the order it appears.

    This is what lets "NDVI, EVI and SAVI" become three layers instead of one.
    """
    hits = []
    for name, phrases in synonyms.items():
        position = None
        for phrase in phrases:
            match = re.search(r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])", text)
            if match and (position is None or match.start() < position):
                position = match.start()
        if position is not None:
            hits.append((position, name))
    hits.sort()
    return [name for _, name in hits]


def _hex_color(text: str) -> str | None:
    explicit = re.search(r"#([0-9a-fA-F]{6})\b", text)
    if explicit:
        return "#" + explicit.group(1).lower()
    for name, value in COLORS.items():
        if re.search(r"(?<![a-z])" + name + r"(?![a-z])", text):
            return value
    return None


def _cloud_cover(text: str) -> int | None:
    match = re.search(r"(\d{1,3})\s*(?:%|percent|per cent)?\s*(?:of\s+)?cloud", text)
    if not match:
        match = re.search(r"cloud(?:s|iness|y)?\s*(?:below|under|less than|max|maximum)?\s*(\d{1,3})\s*%?", text)
    if not match:
        return None
    return max(0, min(100, int(match.group(1))))


def _month_span(text: str, today: date):
    # Word boundaries matter: without them "MARKING" reads as the month "mar".
    names = re.findall(
        r"\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|"
        r"september|sept|sep|october|oct|november|nov|december|dec)\b",
        text,
    )
    years = re.findall(r"(20\d{2})", text)
    if not names:
        return None
    year = int(years[-1]) if years else today.year
    ordered = [MONTHS[n] for n in names if n in MONTHS]
    if not ordered:
        return None
    first, last = min(ordered), max(ordered)
    if last < first:
        first, last = last, first
    start = date(year, first, 1)
    if last == 12:
        end = date(year, 12, 31)
    else:
        end = date(year, last + 1, 1) - timedelta(days=1)
    return start, end


def parse_date_range(text: str, today: date | None = None):
    """Best-effort date window from a sentence. Returns (start, end) or (None, None)."""
    today = today or date.today()
    lowered = text.lower()

    iso = re.findall(r"(20\d{2})-(\d{2})-(\d{2})", text)
    if len(iso) >= 2:
        try:
            return (
                date(int(iso[0][0]), int(iso[0][1]), int(iso[0][2])),
                date(int(iso[1][0]), int(iso[1][1]), int(iso[1][2])),
            )
        except ValueError:
            pass
    if len(iso) == 1:
        try:
            single = date(int(iso[0][0]), int(iso[0][1]), int(iso[0][2]))
            return single, single
        except ValueError:
            pass

    span = _month_span(lowered, today)
    if span:
        return span

    relative = (
        (r"\btoday\b", today, today),
        (r"\byesterday\b", today - timedelta(days=1), today - timedelta(days=1)),
        (r"\blast week\b", today - timedelta(days=7), today),
        (r"\blast month\b", today - timedelta(days=30), today),
        (r"\bthis month\b", today.replace(day=1), today),
        (r"\blast quarter\b", today - timedelta(days=90), today),
        (r"\blast year\b", today - timedelta(days=365), today),
        (r"\bthis year\b", today.replace(month=1, day=1), today),
        (r"\blast season\b", today - timedelta(days=180), today),
    )
    for pattern, start, end in relative:
        if re.search(pattern, lowered):
            return start, end

    window = re.search(r"(?:last|past)\s+(\d{1,3})\s+(day|week|month)s?", lowered)
    if window:
        count, unit = int(window.group(1)), window.group(2)
        days = count * {"day": 1, "week": 7, "month": 30}[unit]
        return today - timedelta(days=days), today
    return None, None


# --------------------------------------------------------------------------- rules engine
def _rule_box(text: str, sentences_index: int, today: date) -> dict:
    lowered = digitise(text.lower())
    params: dict = {}

    start, end = parse_date_range(digitise(text), today)
    cloud = _cloud_cover(lowered)
    if cloud is not None:
        params["max_cloud"] = cloud

    # 1. Area outline and cartographic marks.
    if re.search(r"\b(boundary|outline|border|perimeter|perimeter line|demarcate)\b", lowered) or re.search(
        r"\bmark (my|the) (area|boundary|location|field)\b", lowered
    ):
        params["color"] = _hex_color(lowered) or "#e31a1c"
        params["width"] = 3 if re.search(r"\b(thick|bold|heavy)\b", lowered) else 1 if re.search(r"\bthin\b", lowered) else 2
        return _box(text, sentences_index, "boundary", params, "Area boundary", "", start, end)

    # 2. Streams and drainage.
    if re.search(r"\b(stream|streams|drainage|river|rivers|nala|nalas|channel|channels|tributary)\b", lowered) or re.search(
        r"water (flow|flows|flowing|movement)|flow accumulation|following the slope|per the slope|as per the slope|where water flows",
        lowered,
    ):
        percentile = 96.0
        share = re.search(r"top\s+(\d{1,2})\s*%", lowered)
        if share:
            percentile = max(80.0, min(99.5, 100.0 - float(share.group(1))))
        params["percentile"] = percentile
        return _box(text, sentences_index, "streams", params, "Stream lines", LIMITATIONS["streams"], start, end)

    # 3. Candidate infrastructure, kept explicitly unconfirmed.
    if re.search(r"\b(pole|poles|pillar|pillars|electric|electrical|transformer|infrastructure|tower|towers)\b", lowered):
        params["kind"] = "linear"
        params["color"] = _hex_color(lowered) or "#f46d43"
        return _box(text, sentences_index, "candidates", params, "Candidate infrastructure", LIMITATIONS["poles"], start, end)
    if re.search(r"\b(borewell|bore well|borewells|pipeline|pipelines|culvert|culverts)\b", lowered):
        params["kind"] = "linear"
        params["color"] = _hex_color(lowered) or "#2c7bb6"
        return _box(text, sentences_index, "candidates", params, "Candidate infrastructure", LIMITATIONS["candidates"], start, end)
    if re.search(r"\b(fallow|barren|wasteland|uncultivated)\b", lowered):
        params["kind"] = "fallow"
        return _box(text, sentences_index, "candidates", params, "Fallow land candidates", LIMITATIONS["candidates"], start, end)
    if re.search(r"\b(built|buildings|settlement|urban|impervious)\b", lowered):
        params["kind"] = "built"
        return _box(text, sentences_index, "candidates", params, "Built-up candidates", LIMITATIONS["candidates"], start, end)

    # 4. Zones, hotspots and health splits.
    if re.search(r"\b(zone|zones|hotspot|hot spot|hotspots|cluster|clusters|patch|patches|classify|classification of)\b", lowered) or re.search(
        r"\b(danger|dangerous|unhealthy|healthy|stressed|stress zones?|problem areas?|poor areas?)\b", lowered
    ):
        indicator = None
        for name, phrases in INDEX_SYNONYMS.items():
            if _find_phrase(lowered, phrases):
                indicator = name
                break
        params["indicator"] = indicator or "ndvi"
        if re.search(r"\b(healthy|health|vigorous|best|good)\b", lowered) and not re.search(
            r"\b(unhealthy|danger|stressed|stress|poor|worst)\b", lowered
        ):
            params["level"] = "high"
            params["color"] = _hex_color(lowered) or "#1a9850"
            label = "Healthy zones"
        else:
            params["level"] = "low"
            params["color"] = _hex_color(lowered) or "#d73027"
            label = "Hotspot / stress zones"
        count = re.search(r"\b(\d{1,2})\s*(?:zones?|classes?|categories?|levels?|bands?)\b", lowered)
        if not count:
            count = re.search(r"\b(?:into|in)\s+(\d{1,2})\b", lowered)
        if count:
            params["classes"] = max(1, min(5, int(count.group(1))))
        threshold = re.search(r"(?:below|under|less than|above|over|greater than)\s+(-?\d*\.?\d+)", lowered)
        if threshold:
            params["threshold"] = float(threshold.group(1))
            params["mode"] = "absolute"
        return _box(text, sentences_index, "zones", params, label, LIMITATIONS["zones"], start, end)

    # 5. Change between two windows.
    if re.search(r"\b(change|changes|changed|comparison|compare|before and after|gain|loss|changedetection)\b", lowered):
        params["indicator"] = "ndvi"
        for name, phrases in INDEX_SYNONYMS.items():
            if _find_phrase(lowered, phrases):
                params["indicator"] = name
                break
        return _box(text, sentences_index, "change", params, "Change detection", LIMITATIONS["change"], start, end)

    # 6. Terrain.
    if re.search(r"\b(dem|elevation|height|terrain|slope|gradient|aspect|hillshade|hill shade|topography|twi|wetness index)\b", lowered):
        names = _named(lowered, DEM_SYNONYMS) or ["elevation"]
        params["layer"] = names[0]
        return _box(text, sentences_index, "dem", params, "Terrain - %s" % names[0], "", start, end)

    # 7. Land cover.
    if re.search(r"\b(land cover|land use|landcover|landuse|lulc|dynamic world|crop classification)\b", lowered):
        return _box(text, sentences_index, "lulc", params, "Land cover", "", start, end)

    # 8. Alerts on a threshold.
    if re.search(r"\b(alert|alerts|warning|warn me|alarm|threshold)\b", lowered):
        threshold = re.search(r"(?:below|under|less than)\s+(-?\d*\.?\d+)", lowered)
        params["threshold"] = float(threshold.group(1)) if threshold else 0.3
        params["alert_pct"] = 30.0
        return _box(text, sentences_index, "alert", params, "Stress alert", "", start, end)

    # 9. Statistics rather than a layer.
    if re.search(r"\b(statistic|statistics|stats|mean|average|summary|table|report|how healthy|how much)\b", lowered):
        found = _named(lowered, INDEX_SYNONYMS)
        params["indicators"] = found or ["ndvi", "ndmi"]
        return _box(text, sentences_index, "stats", params, "Statistics", "", start, end)

    # 10. Band composites.
    for name, phrases in COMPOSITE_SYNONYMS.items():
        if _find_phrase(lowered, phrases):
            params["combo"] = name
            return _box(text, sentences_index, "composite", params, "%s composite" % name, "", start, end)

    # 11. A bare indicator name is the single most common query.
    for name, phrases in INDEX_SYNONYMS.items():
        if _find_phrase(lowered, phrases):
            params["indicator"] = name
            return _box(text, sentences_index, "index", params, name.upper(), "", start, end)

    # 12. A sentence that only states a date window or a cloud limit draws nothing, but
    # it does set the window for every other box - the very thing a user means by
    # "oh, I forgot to add the date".
    if start or end or cloud is not None:
        return _box(text, sentences_index, "settings", params, "Date and cloud window", "", start, end)

    return _box(
        text,
        sentences_index,
        "index",
        {"indicator": "ndvi"},
        "Vegetation index",
        "This sentence did not name an operation, so a vegetation index was assumed. "
        "Say what you want drawn (for example \"NDVI\", \"true colour\", \"streams\", "
        "\"danger zones\") and it will be honoured exactly.",
        start,
        end,
    )


def _box(text, index, op, params, label, note, start=None, end=None) -> dict:
    box = {
        "id": "b%d" % (index + 1),
        "text": _normalise_text(text),
        "op": op,
        "params": {k: v for k, v in params.items() if v is not None},
        "enabled": True,
        "label": label or op,
        "engine": "rules",
    }
    if start:
        box["start_date"] = start.isoformat()
    if end:
        box["end_date"] = end.isoformat()
    if note:
        box["note"] = note
    return box


def interpret_rules(sentences, today: date | None = None) -> list[dict]:
    """Deterministic plan, expanding a sentence that names several layers into several boxes."""
    today = today or date.today()
    boxes: list[dict] = []
    for sentence in sentences:
        text = _normalise_text(sentence)
        boxes.extend(_expand(_rule_box(text, len(boxes), today), digitise(text.lower())))
    return _reindex(boxes)


def _expand(box: dict, lowered: str) -> list[dict]:
    """One sentence may legitimately ask for several layers: "NDVI, EVI and SAVI"."""
    op = box["op"]
    if op == "index":
        names = _named(lowered, INDEX_SYNONYMS)
    elif op == "composite":
        names = _named(lowered, COMPOSITE_SYNONYMS)
    elif op == "dem":
        names = _named(lowered, DEM_SYNONYMS)
    else:
        return [box]
    if len(names) < 2:
        return [box]

    shared = {k: v for k, v in box.items() if k not in ("id", "op", "params", "label")}
    expanded = []
    for name in names:
        clone = dict(shared)
        clone["op"] = op
        clone["params"] = dict(box["params"])
        if op == "index":
            clone["params"]["indicator"] = name
            clone["label"] = name.upper()
        elif op == "composite":
            clone["params"]["combo"] = name
            clone["label"] = "%s composite" % name
        else:
            clone["params"]["layer"] = name
            clone["label"] = "Terrain - %s" % name
        expanded.append(clone)
    return expanded


def _reindex(boxes: list[dict]) -> list[dict]:
    for index, box in enumerate(boxes):
        box["id"] = "b%d" % (index + 1)
    return boxes


# --------------------------------------------------------------------------- model engine
SYSTEM_PROMPT = """You convert short Geographic Information System requests into a strict JSON plan.

One input line produces exactly one output box, in the same order, however many lines you receive.

Choose "op" and fill only the fields that apply:
- index: satellite index layer. params: {"indicator": one of %s}
- composite: colour-composite layer. params: {"combo": one of %s}
- dem: terrain layer. params: {"layer": one of %s}
- lulc: land-cover classification layer. params: {}
- settings: the box only states dates or a cloud limit and draws nothing. params: {"max_cloud": 0-100} plus start_date/end_date
- zones: vector polygons for healthy, stressed or hotspot areas. params: {"indicator": <index>, "level": "low" or "high", "classes": 1-5, "color": "#rrggbb", "mode": "quantile" or "absolute", "threshold": number}
- streams: vector lines where water flows down the slope. params: {"percentile": 80-99.5}
- candidates: candidate features for field verification. params: {"kind": one of %s, "color": "#rrggbb"}
- boundary: outline of the selected area. params: {"color": "#rrggbb", "width": 1-4}
- stats: numeric summary instead of a layer. params: {"indicators": [<index>, ...]}
- change: difference between two date windows. params: {"indicator": <index>}
- alert: mask of pixels below a threshold. params: {"threshold": number, "alert_pct": number}

Also allowed on any box: "start_date" and "end_date" as YYYY-MM-DD, and "max_cloud" as 0-100.

Rules:
- Copy the user's sentence verbatim into "text". Never rewrite or answer it.
- If one sentence names several indices or layers ("NDVI, EVI and SAVI"), emit one box per named layer, all carrying that same "text".
- Never invent an operation outside the list. Prefer a standard index when the sentence names vegetation, moisture or water.
- Electrical poles, individual buildings, buried pipes: these are below the imagery resolution. Still emit "candidates" with kind "linear", and put a short "note" saying the feature is below the pixel size and must be verified on the ground.
- Put a "label" of at most four words naming what the layer shows.
- Output JSON only, shaped exactly {"boxes":[...]}.
""" % (
    ", ".join(INDICATORS),
    ", ".join(BAND_COMBINATIONS),
    ", ".join(DEM_LAYERS),
    ", ".join(CANDIDATE_KINDS),
)

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "boxes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "op": {"type": "string", "enum": list(OP_NAMES)},
                    "label": {"type": "string"},
                    "note": {"type": "string"},
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "max_cloud": {"type": "integer"},
                    "indicator": {"type": "string"},
                    "combo": {"type": "string"},
                    "layer": {"type": "string"},
                    "kind": {"type": "string", "enum": list(CANDIDATE_KINDS)},
                    "level": {"type": "string", "enum": list(ZONE_LEVELS)},
                    "classes": {"type": "integer"},
                    "mode": {"type": "string", "enum": ["quantile", "absolute"]},
                    "threshold": {"type": "number"},
                    "alert_pct": {"type": "number"},
                    "percentile": {"type": "number"},
                    "color": {"type": "string"},
                    "width": {"type": "integer"},
                    "indicators": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "op"],
            },
        }
    },
    "required": ["boxes"],
}

PARAM_KEYS = (
    "indicator",
    "combo",
    "layer",
    "kind",
    "level",
    "classes",
    "mode",
    "threshold",
    "alert_pct",
    "percentile",
    "color",
    "width",
    "indicators",
    "max_cloud",
)


def provider_config() -> dict | None:
    """Describe the configured model endpoint, or None to use the rule engine."""
    name = os.environ.get("EE_LLM_PROVIDER", "").strip().lower()
    if not name:
        return None
    if name == "vertex":
        return {
            "provider": "vertex",
            "model": os.environ.get("EE_LLM_MODEL", "gemini-2.5-flash").strip(),
            "location": os.environ.get("EE_LLM_LOCATION", "us-central1").strip(),
            "project": (os.environ.get("EE_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "").strip(),
        }
    if name in ("openai", "openai_compatible", "gateway"):
        api_key = os.environ.get("EE_LLM_API_KEY", "").strip()
        if not api_key:
            return None
        return {
            "provider": "openai",
            "model": os.environ.get("EE_LLM_MODEL", "gpt-4o-mini").strip(),
            "base_url": os.environ.get("EE_LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
            "api_key": api_key,
        }
    return None


def _post_json(url: str, payload: dict, headers: dict, timeout: float = 30.0) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _call_vertex(prompt: str, settings: dict) -> str:
    import google.auth  # provided by earthengine-api; used here only for the token
    import google.auth.transport.requests

    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    credentials.refresh(google.auth.transport.requests.Request())
    url = (
        "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent"
        % (settings["location"], settings["project"], settings["location"], settings["model"])
    )
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }
    body = _post_json(url, payload, {"Authorization": "Bearer " + credentials.token})
    return body["candidates"][0]["content"]["parts"][0]["text"]


def _call_openai(prompt: str, settings: dict) -> str:
    payload = {
        "model": settings["model"],
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }
    body = _post_json(
        settings["base_url"] + "/chat/completions",
        payload,
        {"Authorization": "Bearer " + settings["api_key"]},
    )
    return body["choices"][0]["message"]["content"]


def interpret_llm(sentences, settings: dict) -> list[dict]:
    """Ask the model for a plan. Raises on any transport or shape problem."""
    prompt = "Lines to convert, one box each, in this order:\n" + "\n".join(
        "%d. %s" % (i + 1, s) for i, s in enumerate(sentences)
    )
    raw = _call_vertex(prompt, settings) if settings["provider"] == "vertex" else _call_openai(prompt, settings)
    parsed = json.loads(raw)
    boxes = parsed.get("boxes")
    if not isinstance(boxes, list):
        raise ValueError("model response has no boxes array")
    return boxes


# --------------------------------------------------------------------------- validation
def _coerce_params(raw: dict, op: str) -> dict:
    params: dict = {}
    for key in PARAM_KEYS:
        if key not in raw or raw[key] in (None, ""):
            continue
        value = raw[key]
        if key == "indicator":
            lowered = str(value).lower().strip()
            if lowered not in INDICATORS:
                continue
            params[key] = lowered
        elif key == "combo":
            lowered = str(value).lower().strip()
            if lowered not in BAND_COMBINATIONS:
                continue
            params[key] = lowered
        elif key == "layer":
            lowered = str(value).lower().strip()
            if lowered not in DEM_LAYERS:
                continue
            params[key] = lowered
        elif key == "kind":
            lowered = str(value).lower().strip()
            params[key] = lowered if lowered in CANDIDATE_KINDS else "linear"
        elif key == "level":
            lowered = str(value).lower().strip()
            params[key] = "high" if lowered.startswith("high") else "low"
        elif key == "mode":
            params[key] = "absolute" if str(value).lower().startswith("abs") else "quantile"
        elif key == "classes":
            try:
                params[key] = max(1, min(5, int(float(value))))
            except (TypeError, ValueError):
                pass
        elif key == "width":
            try:
                params[key] = max(1, min(6, int(float(value))))
            except (TypeError, ValueError):
                pass
        elif key == "max_cloud":
            try:
                params[key] = max(0, min(100, int(float(value))))
            except (TypeError, ValueError):
                pass
        elif key in ("threshold", "alert_pct", "percentile"):
            try:
                params[key] = float(value)
            except (TypeError, ValueError):
                pass
        elif key == "color":
            text = str(value).strip()
            if re.fullmatch(r"#[0-9a-fA-F]{6}", text):
                params[key] = text.lower()
        elif key == "indicators":
            found = [str(v).lower() for v in value if str(v).lower() in INDICATORS] if isinstance(value, list) else []
            if found:
                params[key] = found
    if op == "streams" and "percentile" in params:
        params["percentile"] = max(80.0, min(99.5, params["percentile"]))
    return params


def _defaults_for(op: str, params: dict) -> dict:
    defaults = {
        "index": {"indicator": "ndvi"},
        "composite": {"combo": "natural"},
        "dem": {"layer": "elevation"},
        "zones": {"indicator": "ndvi", "level": "low", "classes": 2, "mode": "quantile"},
        "streams": {"percentile": 96.0},
        "candidates": {"kind": "linear"},
        "boundary": {"color": "#e31a1c", "width": 2},
        "stats": {"indicators": ["ndvi", "ndmi"]},
        "change": {"indicator": "ndvi"},
        "alert": {"threshold": 0.3, "alert_pct": 30.0},
    }.get(op, {})
    return {**defaults, **params}


def normalise_plan(raw_boxes, sentences, engine: str):
    """Force whatever an engine produced into one valid box per sentence."""
    warnings: list[str] = []
    boxes: list[dict] = []

    for index, sentence in enumerate(sentences):
        text = _normalise_text(sentence)
        candidate = raw_boxes[index] if index < len(raw_boxes) else None
        if not isinstance(candidate, dict):
            candidate = None

        op = str((candidate or {}).get("op", "")).lower().strip()
        if op not in OP_NAMES:
            if candidate is not None:
                warnings.append("Turned an unrecognised operation into a vegetation index: %s" % text[:80])
            fallback = _rule_box(text, index, date.today())
            boxes.append(_finalise(fallback, index, "rules"))
            continue

        box = {
            "id": "b%d" % (index + 1),
            "text": _normalise_text((candidate or {}).get("text") or text),
            "op": op,
            "params": _defaults_for(op, _coerce_params(candidate or {}, op)),
            "enabled": True,
            "label": _normalise_text((candidate or {}).get("label") or "")[:60] or op,
            "engine": engine,
        }
        for key in ("note",):
            note = _normalise_text((candidate or {}).get(key) or "")
            if note:
                box[key] = note
        for key in ("start_date", "end_date"):
            value = str((candidate or {}).get(key) or "")
            if re.fullmatch(r"20\d\d-\d\d-\d\d", value):
                box[key] = value
        cloud = (candidate or {}).get("max_cloud")
        try:
            if cloud is not None:
                box["params"]["max_cloud"] = max(0, min(100, int(float(cloud))))
        except (TypeError, ValueError):
            pass
        if "note" not in box:
            note = _limitation_for(box)
            if note:
                box["note"] = note
        boxes.append(box)

    return boxes, warnings


def _limitation_for(box: dict) -> str:
    if box["op"] == "streams":
        return LIMITATIONS["streams"]
    if box["op"] == "zones":
        return LIMITATIONS["zones"]
    if box["op"] == "change":
        return LIMITATIONS["change"]
    if box["op"] == "candidates":
        if re.search(r"\b(pole|electric|tower|pillar)\b", box["text"].lower()):
            return LIMITATIONS["poles"]
        return LIMITATIONS["candidates"]
    return ""


def _finalise(box: dict, index: int, engine: str) -> dict:
    box["id"] = "b%d" % (index + 1)
    box["engine"] = engine
    if "note" not in box:
        note = _limitation_for(box)
        if note:
            box["note"] = note
    return box


def interpret(sentences, defaults: dict | None = None) -> dict:
    """Full planner entry point used by the HTTP route.

    Returns ``{"engine": ..., "boxes": [...], "warnings": [...]}``. The rule engine
    always produces a usable plan, so a model outage degrades the phrasing quality
    of the plan rather than the availability of the feature.
    """
    sentences = [_normalise_text(s) for s in sentences if _normalise_text(s)]
    if not sentences:
        return {"engine": "none", "boxes": [], "warnings": ["No sentences to interpret."]}

    settings = provider_config()
    result: dict
    if settings:
        try:
            boxes, warnings = normalise_plan(
                interpret_llm(sentences, settings), sentences, "llm:" + settings["provider"]
            )
            result = {"engine": "llm:" + settings["provider"], "boxes": boxes, "warnings": warnings}
        except (urllib.error.URLError, KeyError, ValueError, IndexError, TypeError, OSError) as exc:
            fallback = interpret_rules(sentences)
            result = {
                "engine": "rules",
                "boxes": [_finalise(b, i, "rules") for i, b in enumerate(fallback)],
                "warnings": [
                    "Model planner (%s) unavailable, used the built-in planner: %s" % (settings["provider"], exc)
                ],
            }
    else:
        result = {
            "engine": "rules",
            "boxes": [_finalise(b, i, "rules") for i, b in enumerate(interpret_rules(sentences))],
            "warnings": [],
        }

    return apply_defaults(result, defaults or {})


def apply_defaults(result: dict, defaults: dict) -> dict:
    """Fill plan-wide date and cloud settings into any box that did not state its own.

    The plugin shows one date range and one cloud limit for the whole run; a sentence
    that names its own window ("July to August", "only 2 percent cloud") keeps it.
    """
    start = str(defaults.get("start_date") or "")
    end = str(defaults.get("end_date") or "")
    cloud = defaults.get("max_cloud")
    try:
        cloud = None if cloud in (None, "") else max(0, min(100, int(float(cloud))))
    except (TypeError, ValueError):
        cloud = None

    for box in result.get("boxes", []):
        if start and re.fullmatch(r"20\d\d-\d\d-\d\d", start) and "start_date" not in box:
            box["start_date"] = start
        if end and re.fullmatch(r"20\d\d-\d\d-\d\d", end) and "end_date" not in box:
            box["end_date"] = end
        if cloud is not None and "max_cloud" not in box.get("params", {}):
            box.setdefault("params", {})["max_cloud"] = cloud
    return result
