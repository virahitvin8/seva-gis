#!/usr/bin/env python3
"""
SEVA·GIS — System Architecture & Geospatial Dataflow Generator
Renders:
1. docs/architecture-diagram.png (High-res 3200x1920 tldraw infinite canvas whiteboard aesthetic)
2. docs/seva-gis-architecture.tldr (Official tldraw JSON format for https://www.tldraw.com)
"""

import os
import json
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 3200, 1920

# Colors (tldraw modern whiteboard aesthetic)
CANVAS_BG = "#f8fafc"
DOT_COLOR = "#cbd5e1"
TEXT_MAIN = "#0f172a"
TEXT_MUTED = "#475569"
CARD_BG = "#ffffff"
CARD_BORDER = "#cbd5e1"

THEMES = {
    "client": {
        "bg": "#f0f9ff",
        "border": "#0284c7",
        "header_bg": "#bae6fd",
        "text": "#0369a1",
        "pill_bg": "#e0f2fe",
        "pill_text": "#0284c7",
        "icon_bg": "#0284c7"
    },
    "providers": {
        "bg": "#fffbeb",
        "border": "#d97706",
        "header_bg": "#fde68a",
        "text": "#b45309",
        "pill_bg": "#fef3c7",
        "pill_text": "#d97706",
        "icon_bg": "#d97706"
    },
    "engine": {
        "bg": "#f0fdf4",
        "border": "#16a34a",
        "header_bg": "#bbf7d0",
        "text": "#15803d",
        "pill_bg": "#dcfce7",
        "pill_text": "#16a34a",
        "icon_bg": "#16a34a"
    },
    "geoai": {
        "bg": "#faf5ff",
        "border": "#9333ea",
        "header_bg": "#e9d5ff",
        "text": "#7e22ce",
        "pill_bg": "#f3e8ff",
        "pill_text": "#9333ea",
        "icon_bg": "#9333ea"
    },
    "output": {
        "bg": "#f0fdfa",
        "border": "#0d9488",
        "header_bg": "#99f6e4",
        "text": "#0f766e",
        "pill_bg": "#ccfbf1",
        "pill_text": "#0d9488",
        "icon_bg": "#0d9488"
    }
}

def get_font(name, size):
    try:
        font_path = os.path.join("C:/Windows/Fonts", name)
        if os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
    except Exception:
        pass
    return ImageFont.load_default()

FONT_TITLE = get_font("segoeuib.ttf", 36)
FONT_SUBTITLE = get_font("segoeui.ttf", 18)
FONT_FRAME = get_font("segoeuib.ttf", 19)
FONT_CARD_TITLE = get_font("segoeuib.ttf", 16)
FONT_CARD_DESC = get_font("segoeui.ttf", 13)
FONT_TAG = get_font("consola.ttf", 12)
FONT_BADGE = get_font("segoeuib.ttf", 13)
FONT_LABEL = get_font("segoeuib.ttf", 12)

def draw_rounded_rect(draw, bbox, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_shadow(draw, bbox, radius, offset=4):
    x0, y0, x1, y1 = bbox
    for i in range(3, 0, -1):
        c = (15, 23, 42, 5 * i)
        draw_rounded_rect(draw, [x0 + offset - i, y0 + offset - i, x1 + offset + i, y1 + offset + i], radius + i, fill=c)

def draw_icon(draw, icon_type, cx, cy, size=38, bg_color="#3b82f6"):
    r = size // 2
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg_color)
    white = "#ffffff"
    
    if icon_type == "user":
        draw.ellipse([cx - 4, cy - 8, cx + 4, cy - 1], fill=white)
        draw.chord([cx - 8, cy + 1, cx + 8, cy + 10], 180, 360, fill=white)
    elif icon_type == "workspace":
        draw_rounded_rect(draw, [cx - 8, cy - 7, cx + 8, cy + 7], 2, outline=white, width=2)
        draw.line([cx - 8, cy - 2, cx + 8, cy - 2], fill=white, width=1)
        draw.point([cx - 5, cy - 5], fill=white)
        draw.point([cx - 2, cy - 5], fill=white)
    elif icon_type == "geometry":
        pts = [(cx - 7, cy + 6), (cx + 7, cy + 6), (cx + 8, cy - 2), (cx, cy - 7), (cx - 8, cy - 2)]
        draw.polygon(pts, outline=white, width=2)
    elif icon_type == "auth":
        draw.polygon([(cx - 7, cy - 6), (cx + 7, cy - 6), (cx + 7, cy), (cx, cy + 8), (cx - 7, cy)], fill=white)
        draw.ellipse([cx - 2, cy - 3, cx + 2, cy + 1], fill=bg_color)
    elif icon_type == "satellite":
        draw_rounded_rect(draw, [cx - 4, cy - 4, cx + 4, cy + 4], 1, fill=white)
        draw.line([cx - 9, cy, cx - 4, cy], fill=white, width=2)
        draw.line([cx + 4, cy, cx + 9, cy], fill=white, width=2)
        draw.line([cx - 9, cy - 4, cx - 9, cy + 4], fill=white, width=2)
        draw.line([cx + 9, cy - 4, cx + 9, cy + 4], fill=white, width=2)
    elif icon_type == "dem":
        draw.polygon([(cx - 8, cy + 6), (cx - 2, cy - 5), (cx + 3, cy + 6)], outline=white, width=2)
        draw.polygon([(cx, cy + 6), (cx + 5, cy - 2), (cx + 9, cy + 6)], outline=white, width=2)
    elif icon_type == "weather":
        draw.ellipse([cx - 2, cy - 7, cx + 7, cy + 2], fill=white)
        draw.ellipse([cx - 8, cy - 2, cx + 3, cy + 6], fill=white)
    elif icon_type == "soil":
        draw.line([cx - 7, cy - 5, cx + 7, cy - 5], fill=white, width=2)
        draw.line([cx - 7, cy, cx + 7, cy], fill=white, width=2)
        draw.line([cx - 7, cy + 5, cx + 7, cy + 5], fill=white, width=2)
    elif icon_type == "nearby":
        draw.ellipse([cx - 5, cy - 7, cx + 5, cy + 3], outline=white, width=2)
        draw.line([cx, cy + 2, cx, cy + 7], fill=white, width=2)
    elif icon_type == "pipeline":
        draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], outline=white, width=2)
        draw.line([cx, cy - 8, cx, cy + 8], fill=white, width=2)
        draw.line([cx - 8, cy, cx + 8, cy], fill=white, width=2)
    elif icon_type == "raster":
        for i in (-4, 0, 4):
            draw.line([cx - 6, cy + i, cx + 6, cy + i], fill=white, width=1)
            draw.line([cx + i, cy - 6, cx + i, cy + 6], fill=white, width=1)
    elif icon_type == "vegetation":
        draw.chord([cx - 6, cy - 7, cx + 6, cy + 5], 0, 180, fill=white)
        draw.line([cx, cy - 6, cx, cy + 7], fill=white, width=2)
    elif icon_type == "hydro":
        draw.arc([cx - 8, cy - 3, cx - 1, cy + 4], 0, 180, fill=white, width=2)
        draw.arc([cx, cy - 3, cx + 7, cy + 4], 0, 180, fill=white, width=2)
    elif icon_type == "geoai":
        draw.ellipse([cx - 6, cy - 5, cx - 2, cy - 1], fill=white)
        draw.ellipse([cx + 2, cy - 5, cx + 6, cy - 1], fill=white)
        draw.ellipse([cx - 2, cy + 2, cx + 2, cy + 6], fill=white)
        draw.line([cx - 4, cy - 3, cx, cy + 4], fill=white, width=1)
        draw.line([cx + 4, cy - 3, cx, cy + 4], fill=white, width=1)
    elif icon_type == "timelapse":
        draw.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], outline=white, width=2)
        draw.line([cx, cy - 5, cx, cy], fill=white, width=2)
        draw.line([cx, cy, cx + 4, cy], fill=white, width=2)
    elif icon_type == "advisory":
        draw_rounded_rect(draw, [cx - 7, cy - 6, cx + 7, cy + 4], 2, fill=white)
        draw.polygon([(cx - 3, cy + 4), (cx + 2, cy + 4), (cx - 4, cy + 8)], fill=white)
    elif icon_type == "map":
        draw.polygon([(cx - 7, cy - 5), (cx - 2, cy - 7), (cx + 3, cy - 5), (cx + 8, cy - 7),
                      (cx + 8, cy + 5), (cx + 3, cy + 7), (cx - 2, cy + 5), (cx - 7, cy + 7)], outline=white, width=2)
    elif icon_type == "report":
        draw_rounded_rect(draw, [cx - 6, cy - 8, cx + 6, cy + 8], 1, outline=white, width=2)
        draw.line([cx - 3, cy - 4, cx + 3, cy - 4], fill=white, width=1)
        draw.line([cx - 3, cy, cx + 3, cy], fill=white, width=1)
        draw.line([cx - 3, cy + 4, cx + 1, cy + 4], fill=white, width=1)
    elif icon_type == "tools":
        draw.line([cx - 6, cy - 6, cx + 6, cy + 6], fill=white, width=2)
        draw.line([cx + 6, cy - 6, cx - 6, cy + 6], fill=white, width=2)
        draw.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=white)
    elif icon_type == "mitra":
        draw.line([cx, cy - 7, cx, cy + 7], fill=white, width=2)
        draw.line([cx - 7, cy + 7, cx + 7, cy - 7], fill=white, width=2)
        draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=white)
    else:
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=white)

def render_diagram():
    img = Image.new("RGBA", (W, H), CANVAS_BG)
    draw = ImageDraw.Draw(img)

    # 1. Subtle tldraw dot grid
    grid_spacing = 32
    dot_radius = 1.2
    for x in range(grid_spacing, W, grid_spacing):
        for y in range(grid_spacing, H, grid_spacing):
            draw.ellipse([x - dot_radius, y - dot_radius, x + dot_radius, y + dot_radius], fill=DOT_COLOR)

    # 2. Header
    header_x = 90
    draw.text((header_x, 38), "SEVA·GIS — System Architecture & Geospatial Dataflow", fill=TEXT_MAIN, font=FONT_TITLE)
    draw.text((header_x, 88), "Diagram-as-Code (mingrammer/diagrams) & Infinite Whiteboard Canvas (tldraw) • Zero-Cloud In-Browser Pipeline", fill=TEXT_MUTED, font=FONT_SUBTITLE)

    # Top right badges
    badges = [
        ("tldraw Canvas", "#e0f2fe", "#0284c7"),
        ("mingrammer / diagrams", "#dcfce7", "#16a34a"),
        ("Sentinel-2 L2A BOA", "#fef3c7", "#d97706"),
        ("100% In-Browser Edge", "#f3e8ff", "#9333ea")
    ]
    bx = W - 90
    for label, bg_c, text_c in reversed(badges):
        bbox = draw.textbbox((0, 0), label, font=FONT_BADGE)
        bw = (bbox[2] - bbox[0]) + 30
        bx -= bw
        draw_rounded_rect(draw, [bx, 48, bx + bw, 84], 18, fill=bg_c, outline=text_c, width=2)
        draw.ellipse([bx + 12, 62, bx + 20, 70], fill=text_c)
        draw.text((bx + 26, 56), label, fill=text_c, font=FONT_BADGE)
        bx -= 16

    # Containers configuration
    frames = [
        {
            "id": "client",
            "title": "1. APP WORKSPACE & CLIENT CORE",
            "theme": THEMES["client"],
            "bbox": [80, 140, 680, 1260],
            "cards": [
                {
                    "id": "c_farmer",
                    "title": "Field Farmer / User",
                    "desc": "Mobile PWA / Desktop. Walks GPS farm perimeter, traces boundary polygon, inspects health indices.",
                    "tag": "[Browser / Mobile PWA]",
                    "icon": "user",
                    "rect": [110, 220, 650, 395]
                },
                {
                    "id": "c_app",
                    "title": "Workspace Shell & Navigation",
                    "desc": "Farm state coordinator, multilingual context (EN, HI, TE), reactive URL params & tab navigation.",
                    "tag": "[src/App.tsx]",
                    "icon": "workspace",
                    "rect": [110, 425, 650, 600]
                },
                {
                    "id": "c_boundary",
                    "title": "Farm Boundary & Geometry",
                    "desc": "Polygon vertex editor, GeoJSON / KML parser, centroid locator, geodesic buffer rings & area ha.",
                    "tag": "[src/AddFarm.tsx & geo.ts]",
                    "icon": "geometry",
                    "rect": [110, 630, 650, 805]
                },
                {
                    "id": "c_auth",
                    "title": "Device Vault & Local Accounts",
                    "desc": "Zero-cloud device store, offline-first IndexedDB credentials, PBKDF2 hash & local farm storage.",
                    "tag": "[src/Auth.tsx & db.ts]",
                    "icon": "auth",
                    "rect": [110, 835, 650, 1010]
                },
                {
                    "id": "c_mitra_guide",
                    "title": "Mitra 60s Field Guide & Tour",
                    "desc": "Click-by-click onboarding tour, interactive step highlights, voice-ready tooltips for grassroot farmers.",
                    "tag": "[src/Mitra.tsx]",
                    "icon": "mitra",
                    "rect": [110, 1040, 650, 1215]
                }
            ]
        },
        {
            "id": "providers",
            "title": "2. KEYLESS OPEN DATA PROVIDERS (REST / STAC / COG)",
            "theme": THEMES["providers"],
            "bbox": [730, 140, 2010, 640],
            "cards": [
                {
                    "id": "p_soil",
                    "title": "SoilGrids ISRIC 250m",
                    "desc": "Depth profiles (0-30cm): pH, organic carbon stock, sand, silt, clay, cation exchange.",
                    "tag": "[ISRIC SoilGrids WCS]",
                    "icon": "soil",
                    "rect": [755, 215, 1125, 390]
                },
                {
                    "id": "p_fallback",
                    "title": "NASA Landsat / Fallback",
                    "desc": "Secondary surface reflectance & thermal verification tiles during overcast passes.",
                    "tag": "[USGS / Open Fallback]",
                    "icon": "pipeline",
                    "rect": [1185, 215, 1555, 390]
                },
                {
                    "id": "p_meteo",
                    "title": "Open-Meteo Agro API",
                    "desc": "Keyless hourly temperature, precipitation, soil temp, evapotranspiration, 7-day forecast.",
                    "tag": "[open-meteo.com]",
                    "icon": "weather",
                    "rect": [1615, 215, 1985, 390]
                },
                {
                    "id": "p_sentinel",
                    "title": "Sentinel-2 L2A BOA",
                    "desc": "10m multispectral surface reflectance: B02, B03, B04, B08, B11, B12 via Planetary Computer STAC.",
                    "tag": "[Planetary Computer STAC]",
                    "icon": "satellite",
                    "rect": [755, 420, 1125, 595]
                },
                {
                    "id": "p_dem",
                    "title": "Copernicus DEM (GLO-30)",
                    "desc": "30m radar global elevation model for terrain slopes, aspects, hillshade & drainage basins.",
                    "tag": "[Copernicus / AWS Open Data]",
                    "icon": "dem",
                    "rect": [1185, 420, 1555, 595]
                },
                {
                    "id": "p_osm",
                    "title": "OSM Overpass Infrastructure",
                    "desc": "Geo-queries: nearby borewells, irrigation canals, water bodies, high-tension power lines.",
                    "tag": "[Overpass Turbo API]",
                    "icon": "nearby",
                    "rect": [1615, 420, 1985, 595]
                }
            ]
        },
        {
            "id": "engine",
            "title": "3. GEOSPATIAL & SPECTRAL COMPUTE CORE (CLIENT-SIDE)",
            "theme": THEMES["engine"],
            "bbox": [730, 680, 2010, 1260],
            "cards": [
                {
                    "id": "e_pipeline",
                    "title": "Satellite Analysis Pipeline",
                    "desc": "Acquisition search, cloud shadow filtering, spatial intersection & temporal sorting.",
                    "tag": "[src/seva.ts]",
                    "icon": "pipeline",
                    "rect": [755, 755, 1125, 960]
                },
                {
                    "id": "e_raster",
                    "title": "Raster & Band Math Engine",
                    "desc": "Client-side GeoTIFF windowing, floating-point array math, NDVI/NDRE normalizations.",
                    "tag": "[src/raster.ts]",
                    "icon": "raster",
                    "rect": [1185, 755, 1555, 960]
                },
                {
                    "id": "e_indices",
                    "title": "Spectral Vegetation Indices",
                    "desc": "NDVI, NDMI, NDRE, EVI, BSI & SAVI crop indices with agronomic health thresholds.",
                    "tag": "[src/indicators.ts]",
                    "icon": "vegetation",
                    "rect": [1615, 755, 1985, 960]
                },
                {
                    "id": "e_hydro",
                    "title": "Terrain Hydrology & Flow",
                    "desc": "D8 flow direction, slope gradient, TWI (Topographic Wetness), waterlogging risk zones.",
                    "tag": "[src/hydro.ts]",
                    "icon": "hydro",
                    "rect": [755, 1000, 1125, 1215]
                },
                {
                    "id": "e_gee",
                    "title": "Analysis Map Compositor",
                    "desc": "False-colour NIR synthesis, false-colour moisture, dynamic stretch & color ramp generator.",
                    "tag": "[src/gee.ts]",
                    "icon": "map",
                    "rect": [1185, 1000, 1555, 1215]
                },
                {
                    "id": "e_nearby",
                    "title": "Infrastructure Proximity",
                    "desc": "Euclidean & geodesic distance rings to closest canal, borewell, road & 3-phase grid line.",
                    "tag": "[src/nearby.ts]",
                    "icon": "nearby",
                    "rect": [1615, 1000, 1985, 1215]
                }
            ]
        },
        {
            "id": "geoai",
            "title": "4. GEOAI STUDIO & FARM INTELLIGENCE",
            "theme": THEMES["geoai"],
            "bbox": [2130, 140, 3120, 1260],
            "cards": [
                {
                    "id": "g_studio",
                    "title": "GeoAI Segmentation Studio",
                    "desc": "Client-side k-means++ spectral clustering: auto-detects vigorous crops vs stressed zones.",
                    "tag": "[src/Studio.tsx]",
                    "icon": "geoai",
                    "rect": [2160, 220, 2605, 485]
                },
                {
                    "id": "g_intelligence",
                    "title": "Agronomic Intelligence Lab",
                    "desc": "Anomaly detection: flags spatial weak spots, nitrogen deficiency & moisture drop early.",
                    "tag": "[src/Intelligence.tsx]",
                    "icon": "geoai",
                    "rect": [2640, 220, 3085, 485]
                },
                {
                    "id": "g_timelapse",
                    "title": "Seasonal Time-Lapse",
                    "desc": "Multi-month historical animation player: scrub vegetation recovery across seasons.",
                    "tag": "[src/Timelapse.tsx]",
                    "icon": "timelapse",
                    "rect": [2160, 520, 2605, 785]
                },
                {
                    "id": "g_advisory",
                    "title": "Agro & Weather Advisory",
                    "desc": "Actionable agronomic verdicts: spray safety window, heat stress alert, fertilizer timing.",
                    "tag": "[src/AgroPanel.tsx]",
                    "icon": "advisory",
                    "rect": [2640, 520, 3085, 785]
                },
                {
                    "id": "g_water",
                    "title": "Water & Soil Diagnostics",
                    "desc": "Deep soil moisture, drainage slope profile, runoff risk calculator, drought index.",
                    "tag": "[src/WaterPanel.tsx]",
                    "icon": "hydro",
                    "rect": [2160, 820, 2605, 1085]
                },
                {
                    "id": "g_nearby_layer",
                    "title": "Nearby Feature Overlays",
                    "desc": "Interactive map markers for borewells, irrigation channels & power lines with buffer radii.",
                    "tag": "[src/NearbyLayer.tsx]",
                    "icon": "nearby",
                    "rect": [2640, 820, 3085, 1085]
                }
            ]
        },
        {
            "id": "output",
            "title": "5. CARTOGRAPHIC DELIVERABLES & FIELD DECISION ARTIFACTS",
            "theme": THEMES["output"],
            "bbox": [80, 1315, 3120, 1850],
            "cards": [
                {
                    "id": "o_map",
                    "title": "Interactive Geospatial Map Canvas",
                    "desc": "Leaflet + Canvas GPU rendering: True-Colour RGB, False-Colour NIR, DEM hillshade, NDVI choropleth overlay, layer opacity mixer & GPS crosshair.",
                    "tag": "[src/IndicatorMap.tsx]",
                    "icon": "map",
                    "rect": [110, 1395, 800, 1800]
                },
                {
                    "id": "o_report",
                    "title": "Branded PDF & HTML Farm Dossier",
                    "desc": "One-click print-ready farm health certificate. Includes farm coordinates, NDVI index scorecard, soil & weather report, North arrow, scale bar & QR seal.",
                    "tag": "[src/report.ts & ReportPanel.tsx]",
                    "icon": "report",
                    "rect": [840, 1395, 1550, 1800]
                },
                {
                    "id": "o_tools",
                    "title": "Geospatial Multi-Tool Suite",
                    "desc": "Field calculation utilities: GPS coordinate conversion (UTM/WGS84), geodesic distance measure, elevation profile slice, GeoJSON/Shapefile export.",
                    "tag": "[src/GeoTools.tsx]",
                    "icon": "tools",
                    "rect": [1590, 1395, 2310, 1800]
                },
                {
                    "id": "o_mitra_tour",
                    "title": "Field Operator Quick-Tour & Audio Guide",
                    "desc": "60-second guided onboarding: walk-through of menu, boundary creation, indices, GeoAI studio & export. Trilingual voice & text for grassroot farmers.",
                    "tag": "[Mitra Tour Engine]",
                    "icon": "mitra",
                    "rect": [2350, 1395, 3090, 1800]
                }
            ]
        }
    ]

    # Draw Containers & Cards
    for frame in frames:
        f_bbox = frame["bbox"]
        theme = frame["theme"]
        
        draw_rounded_rect(draw, f_bbox, 24, fill=theme["bg"], outline=theme["border"], width=3)
        header_h = 44
        draw_rounded_rect(draw, [f_bbox[0] + 16, f_bbox[1] + 16, f_bbox[2] - 16, f_bbox[1] + 16 + header_h], 14, fill=theme["header_bg"])
        draw.text((f_bbox[0] + 32, f_bbox[1] + 26), frame["title"], fill=theme["text"], font=FONT_FRAME)
        
        for card in frame["cards"]:
            c_rect = card["rect"]
            draw_shadow(draw, c_rect, 16, offset=4)
            draw_rounded_rect(draw, c_rect, 16, fill=CARD_BG, outline=CARD_BORDER, width=2)
            draw.line([c_rect[0] + 16, c_rect[1] + 2, c_rect[2] - 16, c_rect[1] + 2], fill=theme["border"], width=3)
            
            icon_cx = c_rect[0] + 34
            icon_cy = c_rect[1] + 36
            draw_icon(draw, card["icon"], icon_cx, icon_cy, size=38, bg_color=theme["icon_bg"])
            
            title_x = c_rect[0] + 62
            title_y = c_rect[1] + 25
            draw.text((title_x, title_y), card["title"], fill=TEXT_MAIN, font=FONT_CARD_TITLE)
            
            desc_y = c_rect[1] + 58
            desc_text = card["desc"]
            words = desc_text.split(" ")
            lines = []
            cur_line = []
            max_w = (c_rect[2] - c_rect[0]) - 36
            for w in words:
                cur_line.append(w)
                line_str = " ".join(cur_line)
                bbox = draw.textbbox((0, 0), line_str, font=FONT_CARD_DESC)
                if (bbox[2] - bbox[0]) > max_w:
                    cur_line.pop()
                    lines.append(" ".join(cur_line))
                    cur_line = [w]
            if cur_line:
                lines.append(" ".join(cur_line))
                
            for idx, line in enumerate(lines[:3]):
                draw.text((c_rect[0] + 18, desc_y + idx * 22), line, fill=TEXT_MUTED, font=FONT_CARD_DESC)
                
            tag_text = card["tag"]
            tag_bbox = draw.textbbox((0, 0), tag_text, font=FONT_TAG)
            tag_w = (tag_bbox[2] - tag_bbox[0]) + 16
            tag_h = 24
            tag_x = c_rect[2] - tag_w - 14
            tag_y = c_rect[3] - tag_h - 12
            draw_rounded_rect(draw, [tag_x, tag_y, tag_x + tag_w, tag_y + tag_h], 8, fill=theme["pill_bg"])
            draw.text((tag_x + 8, tag_y + 4), tag_text, fill=theme["pill_text"], font=FONT_TAG)

    # 3. Clean Connectors
    arrows = [
        # Inside Client
        {
            "points": [(380, 395), (380, 425)],
            "label": "opens workspace",
            "color": "#0284c7"
        },
        {
            "points": [(380, 600), (380, 630)],
            "label": "traces perimeter",
            "color": "#0284c7"
        },
        {
            "points": [(380, 805), (380, 835)],
            "label": "persists offline",
            "color": "#0284c7"
        },
        {
            "points": [(380, 1010), (380, 1040)],
            "label": "triggers tour",
            "color": "#0284c7"
        },
        # Boundary Editor -> Compute Pipeline
        {
            "points": [(650, 715), (705, 715), (705, 855), (755, 855)],
            "label": "farm GeoJSON",
            "color": "#16a34a"
        },
        # Sentinel-2 -> Satellite Pipeline (Straight down)
        {
            "points": [(940, 595), (940, 755)],
            "label": "10m multispectral bands",
            "color": "#d97706"
        },
        # Copernicus DEM -> Raster Math (Straight down)
        {
            "points": [(1370, 595), (1370, 755)],
            "label": "30m elevation DEM",
            "color": "#d97706"
        },
        # Open-Meteo -> Agro Advisory (Track 1 X=2040)
        {
            "points": [(1985, 305), (2040, 305), (2040, 650), (2640, 650)],
            "label": "7d weather forecast",
            "color": "#d97706",
            "label_pos": (2040, 475)
        },
        # SoilGrids -> Water & Soil Diagnostics (Top highway Y=120 -> Track 3 X=2080)
        {
            "points": [(755, 305), (705, 305), (705, 120), (2080, 120), (2080, 950), (2160, 950)],
            "label": "soil depth profiles",
            "color": "#d97706",
            "label_pos": (1390, 120)
        },
        # OSM Overpass -> Nearby Feature Overlays (Track 4 X=2100)
        {
            "points": [(1985, 510), (2100, 510), (2100, 950), (2640, 950)],
            "label": "borewells & canals",
            "color": "#d97706",
            "label_pos": (2100, 550)
        },
        # Satellite Pipeline -> Raster Math Engine (Across gap 1125 to 1185)
        {
            "points": [(1125, 855), (1185, 855)],
            "label": "GeoTIFF tiles",
            "color": "#16a34a",
            "label_pos": (1155, 830)
        },
        # Raster Math Engine -> Spectral Indices (Across gap 1555 to 1615)
        {
            "points": [(1555, 855), (1615, 855)],
            "label": "band math",
            "color": "#16a34a",
            "label_pos": (1585, 830)
        },
        # Satellite Pipeline -> Terrain Hydrology
        {
            "points": [(940, 960), (940, 1000)],
            "label": "slope & aspect",
            "color": "#16a34a"
        },
        # Raster Math Engine -> Analysis Map Compositor
        {
            "points": [(1370, 960), (1370, 1000)],
            "label": "color ramps",
            "color": "#16a34a"
        },
        # Spectral Indices -> GeoAI Segmentation Studio (Track 2 X=2060)
        {
            "points": [(1985, 810), (2060, 810), (2060, 350), (2160, 350)],
            "label": "NDVI arrays",
            "color": "#9333ea",
            "label_pos": (2060, 375)
        },
        # Spectral Indices -> Agronomic Intelligence Lab (Track 2 X=2060)
        {
            "points": [(1985, 840), (2060, 840), (2060, 410), (2640, 410)],
            "label": "anomaly detection",
            "color": "#9333ea",
            "label_pos": (2060, 625)
        },
        # Spectral Indices -> Seasonal Time-Lapse (Track 2 X=2060)
        {
            "points": [(1985, 870), (2060, 870), (2060, 650), (2160, 650)],
            "label": "temporal series",
            "color": "#9333ea",
            "label_pos": (2060, 760)
        },
        # Terrain Hydrology -> Water & Soil Diagnostics (Corridor Y=1240)
        {
            "points": [(1125, 1110), (1155, 1110), (1155, 1240), (2080, 1240), (2080, 1010), (2160, 1010)],
            "label": "drainage & TWI",
            "color": "#16a34a",
            "label_pos": (1612, 1240)
        },
        # Infrastructure Proximity -> Nearby Feature Overlays (Track 4 X=2100)
        {
            "points": [(1985, 1110), (2100, 1110), (2100, 1020), (2640, 1020)],
            "label": "distance buffers",
            "color": "#16a34a",
            "label_pos": (2100, 1065)
        },
        # Map Compositor -> Interactive Geospatial Map (Highway Y=1285)
        {
            "points": [(1370, 1215), (1370, 1285), (455, 1285), (455, 1395)],
            "label": "GPU WebGL map layers",
            "color": "#0d9488",
            "label_pos": (700, 1272)
        },
        # Spectral Indices & Advisory -> Branded PDF Report (Highway Y=1285)
        {
            "points": [(1765, 1215), (1765, 1285), (1195, 1285), (1195, 1395)],
            "label": "agronomic certificate",
            "color": "#0d9488",
            "label_pos": (1480, 1272)
        },
        # Proximity & Tools -> Geospatial Multi-Tool Suite (Highway Y=1285)
        {
            "points": [(1950, 1215), (1950, 1395)],
            "label": "WGS84 / UTM toolkit",
            "color": "#0d9488",
            "label_pos": (1950, 1272)
        },
        # Mitra Guide -> Field Operator Quick-Tour (Highway Y=1285)
        {
            "points": [(650, 1130), (705, 1130), (705, 1285), (2720, 1285), (2720, 1395)],
            "label": "60s onboarding guide",
            "color": "#0d9488",
            "label_pos": (2300, 1272)
        }
    ]

    for arr in arrows:
        pts = arr["points"]
        col = arr["color"]
        
        for i in range(len(pts) - 1):
            p1 = pts[i]
            p2 = pts[i + 1]
            draw.line([p1, p2], fill=col, width=3)
            
        last_p = pts[-1]
        prev_p = pts[-2]
        dx = last_p[0] - prev_p[0]
        dy = last_p[1] - prev_p[1]
        length = math.hypot(dx, dy)
        if length > 0:
            ux = dx / length
            uy = dy / length
            px = -uy
            py = ux
            arrow_len = 12
            arrow_wid = 7
            base_x = last_p[0] - ux * arrow_len
            base_y = last_p[1] - uy * arrow_len
            tip1 = (base_x + px * arrow_wid, base_y + py * arrow_wid)
            tip2 = (base_x - px * arrow_wid, base_y - py * arrow_wid)
            draw.polygon([last_p, tip1, tip2], fill=col)
            
        if "label" in arr:
            lbl = arr["label"]
            lbl_bbox = draw.textbbox((0, 0), lbl, font=FONT_LABEL)
            lw = (lbl_bbox[2] - lbl_bbox[0]) + 16
            lh = 22
            
            if "label_pos" in arr:
                mid_x, mid_y = arr["label_pos"]
            elif len(pts) >= 2:
                mid_idx = len(pts) // 2
                p_a = pts[mid_idx - 1]
                p_b = pts[mid_idx]
                mid_x = (p_a[0] + p_b[0]) // 2
                mid_y = (p_a[1] + p_b[1]) // 2
            else:
                mid_x, mid_y = pts[0]
                
            lx = mid_x - lw // 2
            ly = mid_y - lh // 2
            draw_rounded_rect(draw, [lx, ly, lx + lw, ly + lh], 6, fill="#ffffff", outline=col, width=1)
            draw.text((lx + 8, ly + 3), lbl, fill=col, font=FONT_LABEL)

    out_path = os.path.join("docs", "architecture-diagram.png")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    rgb_img = Image.new("RGB", img.size, CANVAS_BG)
    rgb_img.paste(img, mask=img.split()[3])
    rgb_img.save(out_path, format="PNG", quality=95)
    print(f"Successfully generated {out_path} ({W}x{H})")

    generate_tldraw_file(frames, arrows)

def generate_tldraw_file(frames, arrows):
    tldraw_data = {
        "tldrawFileFormatVersion": 1,
        "schema": {
            "schemaVersion": 2,
            "sequences": {
                "com.tldraw.store": 4,
                "com.tldraw.asset": 1,
                "com.tldraw.camera": 1,
                "com.tldraw.document": 2,
                "com.tldraw.instance": 25,
                "com.tldraw.instance_page_state": 5,
                "com.tldraw.page": 1,
                "com.tldraw.instance_presence": 6,
                "com.tldraw.pointer": 1,
                "com.tldraw.shape": 4,
                "com.tldraw.shape.group": 0,
                "com.tldraw.shape.text": 3,
                "com.tldraw.shape.geo": 10,
                "com.tldraw.shape.arrow": 5,
                "com.tldraw.shape.frame": 1
            }
        },
        "records": [
            {
                "gridSize": 10,
                "name": "",
                "meta": {},
                "id": "document:document",
                "typeName": "document"
            },
            {
                "id": "page:page",
                "name": "SEVA.GIS Architecture",
                "index": "a1",
                "typeName": "page",
                "meta": {}
            }
        ]
    }

    shape_idx = 1
    for frame in frames:
        fb = frame["bbox"]
        fw = fb[2] - fb[0]
        fh = fb[3] - fb[1]
        frame_id = f"shape:frame_{frame['id']}"
        tldraw_data["records"].append({
            "id": frame_id,
            "typeName": "shape",
            "parentId": "page:page",
            "index": f"a{shape_idx}",
            "type": "frame",
            "x": fb[0],
            "y": fb[1],
            "rotation": 0,
            "isLocked": False,
            "opacity": 1,
            "meta": {},
            "props": {
                "w": fw,
                "h": fh,
                "name": frame["title"]
            }
        })
        shape_idx += 1

        for card in frame["cards"]:
            cr = card["rect"]
            cw = cr[2] - cr[0]
            ch = cr[3] - cr[1]
            card_id = f"shape:card_{card['id']}"
            tldraw_data["records"].append({
                "id": card_id,
                "typeName": "shape",
                "parentId": frame_id,
                "index": f"a{shape_idx}",
                "type": "geo",
                "x": cr[0] - fb[0],
                "y": cr[1] - fb[1],
                "rotation": 0,
                "isLocked": False,
                "opacity": 1,
                "meta": {
                    "tag": card["tag"],
                    "icon": card["icon"]
                },
                "props": {
                    "w": cw,
                    "h": ch,
                    "geo": "rectangle",
                    "color": "black",
                    "labelColor": "black",
                    "fill": "semi",
                    "dash": "draw",
                    "size": "m",
                    "font": "sans",
                    "text": f"{card['title']}\n\n{card['desc']}\n\n{card['tag']}",
                    "align": "start",
                    "verticalAlign": "start",
                    "growY": 0,
                    "url": ""
                }
            })
            shape_idx += 1

    tldr_path = os.path.join("docs", "seva-gis-architecture.tldr")
    with open(tldr_path, "w", encoding="utf-8") as f:
        json.dump(tldraw_data, f, indent=2)
    print(f"Successfully generated {tldr_path}")

if __name__ == "__main__":
    render_diagram()
