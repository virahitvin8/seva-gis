import os
import shutil
from PIL import Image, ImageDraw, ImageFont

os.makedirs('docs', exist_ok=True)
os.makedirs('public/docs', exist_ok=True)

# Helper function to get default or system font
def get_font(size, bold=False):
    # Try system fonts on Windows
    candidates = [
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf"
    ]
    if bold:
        candidates = [
            "C:\\Windows\\Fonts\\segoeuib.ttf",
            "C:\\Windows\\Fonts\\arialbd.ttf",
            "C:\\Windows\\Fonts\\calibrib.ttf"
        ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

font_title = get_font(22, bold=True)
font_subtitle = get_font(14, bold=False)
font_bold = get_font(13, bold=True)
font_body = get_font(12, bold=False)
font_code = get_font(11, bold=True)
font_tag = get_font(10, bold=True)

WIDTH, HEIGHT = 760, 440

def create_base_canvas(bg_color=(15, 23, 42)):
    img = Image.new('RGB', (WIDTH, HEIGHT), bg_color)
    draw = ImageDraw.Draw(img)
    # Header bar
    draw.rectangle([(0, 0), (WIDTH, 48)], fill=(11, 18, 33))
    draw.line([(0, 48), (WIDTH, 48)], fill=(30, 41, 59), width=1)
    
    # SEVA.GIS Brand
    draw.ellipse([(14, 13), (35, 34)], fill=(16, 185, 129))
    draw.text((42, 14), "SEVA·GIS", fill=(255, 255, 255), font=font_bold)
    draw.text((116, 17), "Earth Intelligence & Precision Agriculture", fill=(148, 163, 184), font=font_subtitle)
    
    # Right badge
    draw.rounded_rectangle([(WIDTH - 180, 11), (WIDTH - 14, 37)], radius=6, fill=(22, 38, 59), outline=(51, 65, 85))
    draw.ellipse([(WIDTH - 168, 20), (WIDTH - 160, 28)], fill=(52, 211, 153))
    draw.text((WIDTH - 152, 15), "Open Data · Client-Side", fill=(203, 213, 225), font=font_tag)
    
    return img, draw

# ==========================================
# GIF 1: walkthrough_satellite_data.gif
# ==========================================
walkthrough_frames = []

# Frame 1: Ingestion
img, draw = create_base_canvas()
# Banner
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 106)], radius=8, fill=(19, 34, 56), outline=(37, 99, 235))
draw.text((34, 70), "STEP 1 · Sentinel-2B L2A Tile Ingestion (Zero API Keys)", fill=(56, 189, 248), font=font_bold)
draw.text((34, 88), "Tile: T43SDR · Target: Punjab Cadastral Parcel #84 (7.7 ha) · Cloud: 0.08% (Clear Sky)", fill=(203, 213, 225), font=font_subtitle)

# Granule Card
draw.rounded_rectangle([(20, 118), (WIDTH - 20, 178)], radius=8, fill=(8, 15, 28), outline=(30, 41, 59))
draw.text((32, 126), "Copernicus STAC Granule Identifier:", fill=(148, 163, 184), font=font_tag)
draw.text((32, 142), "S2B_MSIL2A_20240315T053649_N0510_R005_T43SDR", fill=(74, 222, 128), font=font_code)
draw.text((32, 158), "BOA Reflectance Offset Correction: (DN - 1000)/10000 · SCL Cloud & Shadow Mask: Active", fill=(148, 163, 184), font=font_tag)

# Map Preview Box
draw.rounded_rectangle([(20, 190), (WIDTH/2 - 10, 420)], radius=8, fill=(6, 18, 12), outline=(16, 185, 129))
draw.text((32, 200), "Cadastral Boundary Clipped Raster", fill=(52, 211, 153), font=font_bold)
# Polygon drawing
pts = [(60, 240), (280, 245), (310, 370), (70, 360)]
draw.polygon(pts, fill=(16, 185, 129, 60), outline=(255, 255, 255))
draw.text((80, 290), "Parcel #84 (Wheat)", fill=(255, 255, 255), font=font_bold)
draw.text((80, 310), "30.9010° N, 75.8573° E", fill=(203, 213, 225), font=font_tag)

# Right Details Box
draw.rounded_rectangle([(WIDTH/2 + 10, 190), (WIDTH - 20, 420)], radius=8, fill=(15, 23, 42), outline=(30, 41, 59))
draw.text((WIDTH/2 + 25, 205), "Client-Side Ingestion Architecture", fill=(255, 255, 255), font=font_bold)
specs = [
    "• Microsoft Planetary Computer STAC endpoint queried",
    "• Dynamic TiTiler COG stream (10 m ground resolution)",
    "• Scene Classification Layer (SCL) filters clouds (8, 9, 10)",
    "• Direct browser raster array decode via Web Workers",
    "• Zero server storage · 100% privacy preserved on device"
]
for i, s in enumerate(specs):
    draw.text((WIDTH/2 + 25, 238 + i * 32), s, fill=(203, 213, 225), font=font_body)
walkthrough_frames.append(img)

# Frame 2: Reflectance Curves
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 106)], radius=8, fill=(19, 34, 56), outline=(37, 99, 235))
draw.text((34, 70), "STEP 2 · Bottom-Of-Atmosphere (BOA) Reflectance Spectrum", fill=(56, 189, 248), font=font_bold)
draw.text((34, 88), "Spectral signature shows dramatic Red-Edge transition from Red (0.038) to NIR (0.384)", fill=(203, 213, 225), font=font_subtitle)

# Band Cards Grid
bands_data = [
    ("B02 Blue", "490nm", "0.042", (59, 130, 246)),
    ("B03 Green", "560nm", "0.078", (34, 197, 94)),
    ("B04 Red", "665nm", "0.038", (239, 68, 68)),
    ("B05 RedEdge", "705nm", "0.114", (249, 115, 22)),
    ("B08 NIR", "842nm", "0.384", (16, 185, 129)),
    ("B11 SWIR1", "1610nm", "0.162", (168, 85, 247))
]
for idx, (b_name, wl, val, col) in enumerate(bands_data):
    row = idx // 3
    col_idx = idx % 3
    x0 = 20 + col_idx * 242
    y0 = 120 + row * 140
    draw.rounded_rectangle([(x0, y0), (x0 + 230, y0 + 125)], radius=8, fill=(22, 34, 54), outline=(37, 99, 235) if "NIR" in b_name else (51, 65, 85))
    draw.text((x0 + 14, y0 + 12), b_name, fill=(255, 255, 255), font=font_bold)
    draw.text((x0 + 140, y0 + 14), wl, fill=(148, 163, 184), font=font_tag)
    draw.text((x0 + 14, y0 + 38), val, fill=col, font=font_title)
    draw.text((x0 + 14, y0 + 72), "Surface Reflectance", fill=(148, 163, 184), font=font_tag)
    # Progress bar
    draw.rectangle([(x0 + 14, y0 + 94), (x0 + 214, y0 + 104)], fill=(15, 23, 42))
    w_bar = int(float(val) * 450)
    draw.rectangle([(x0 + 14, y0 + 94), (x0 + 14 + min(200, w_bar), y0 + 104)], fill=col)

walkthrough_frames.append(img)

# Frame 3: 14 Spectral Indices Math
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 106)], radius=8, fill=(19, 34, 56), outline=(37, 99, 235))
draw.text((34, 70), "STEP 3 · 14 Spectral Agro & Hydrological Indices (In-Browser Band Math)", fill=(56, 189, 248), font=font_bold)
draw.text((34, 88), "Pure client-side SIMD / WebAssembly execution directly inside user browser", fill=(203, 213, 225), font=font_subtitle)

indices_show = [
    ("NDVI", "0.820", "Normalized Difference Veg. Index", "(B08-B04)/(B08+B04)", "#16a34a"),
    ("EVI", "0.665", "Enhanced Vegetation Index", "2.5*(NIR-Red)/(NIR+6R-7.5B+1)", "#16a34a"),
    ("SAVI", "0.612", "Soil-Adjusted Vegetation", "((NIR-Red)/(NIR+Red+0.5))*1.5", "#16a34a"),
    ("MSAVI", "0.605", "Modified Soil-Adjusted Veg.", "Self-adjusting soil correction", "#16a34a"),
    ("GNDVI", "0.662", "Green NDVI (Chlorophyll)", "(B08-B03)/(B08+B03)", "#16a34a"),
    ("NDRE", "0.362", "Red-Edge Canopy Nitrogen", "(B08-B05)/(B08+B05)", "#0284c7"),
    ("CIre", "2.368", "Chlorophyll Red-Edge Index", "(B07/B05) - 1", "#0284c7"),
    ("NDMI", "0.407", "Canopy Water Content Index", "(B08-B11)/(B08+B11)", "#0284c7")
]
for idx, (code, val, title, formula, col) in enumerate(indices_show):
    row = idx // 4
    c_idx = idx % 4
    x0 = 20 + c_idx * 180
    y0 = 120 + row * 145
    draw.rounded_rectangle([(x0, y0), (x0 + 170, y0 + 130)], radius=8, fill=(22, 34, 54), outline=(51, 65, 85))
    draw.text((x0 + 12, y0 + 10), code, fill=(255, 255, 255), font=font_bold)
    draw.text((x0 + 12, y0 + 32), val, fill=(74, 222, 128) if "16a" in col else (56, 189, 248), font=font_title)
    draw.text((x0 + 12, y0 + 68), title[:22], fill=(203, 213, 225), font=font_tag)
    draw.text((x0 + 12, y0 + 86), formula[:22], fill=(148, 163, 184), font=font_tag)
    draw.rounded_rectangle([(x0 + 12, y0 + 106), (x0 + 158, y0 + 120)], radius=4, fill=(15, 23, 42))
    draw.text((x0 + 20, y0 + 108), "Status: Optimal Vigour", fill=(52, 211, 153), font=font_tag)

walkthrough_frames.append(img)

# Frame 4: Movable Floating Classification Legend
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 106)], radius=8, fill=(19, 34, 56), outline=(37, 99, 235))
draw.text((34, 70), "STEP 4 · In-Browser K-Means++ Clustering & Movable Legend", fill=(56, 189, 248), font=font_bold)
draw.text((34, 88), "Movable classification legend shortcut beside maps · Adjustable everywhere", fill=(203, 213, 225), font=font_subtitle)

# Map with 3 clusters
draw.rounded_rectangle([(20, 120), (440, 420)], radius=8, fill=(6, 18, 12), outline=(16, 185, 129))
draw.text((32, 130), "Unsupervised Spectral Clustering (k=3)", fill=(52, 211, 153), font=font_bold)
draw.polygon([(60, 170), (240, 175), (250, 380), (70, 370)], fill=(22, 163, 74), outline=(255, 255, 255))
draw.polygon([(240, 175), (380, 180), (390, 390), (250, 380)], fill=(132, 204, 22), outline=(255, 255, 255))
draw.polygon([(300, 240), (360, 245), (365, 340), (305, 335)], fill=(234, 179, 8), outline=(255, 255, 255))
draw.text((100, 260), "Zone 1: 54%", fill=(255, 255, 255), font=font_bold)
draw.text((280, 200), "Zone 2: 34%", fill=(255, 255, 255), font=font_bold)
draw.text((310, 280), "Z3: 12%", fill=(0, 0, 0), font=font_bold)

# Draggable Floating Legend Box (Highlighted on right)
draw.rounded_rectangle([(460, 120), (WIDTH - 20, 420)], radius=10, fill=(15, 23, 42), outline=(52, 211, 153), width=2)
# Legend Header Handle
draw.rounded_rectangle([(460, 120), (WIDTH - 20, 165)], radius=8, fill=(30, 41, 59))
draw.text((475, 130), "🏷️ K-Means Spectral Clusters", fill=(255, 255, 255), font=font_bold)
draw.text((475, 148), "Adjustable everywhere · Drag to move", fill=(148, 163, 184), font=font_tag)

# Legend Items
c_items = [
    ("Zone 1: High Vigour", "54%", "4.16 ha", (22, 163, 74)),
    ("Zone 2: Standard Vigour", "34%", "2.62 ha", (132, 204, 22)),
    ("Zone 3: Canopy Stress", "12%", "0.92 ha", (234, 179, 8))
]
for idx, (name, pct, ha, col) in enumerate(c_items):
    y_pos = 180 + idx * 64
    draw.rounded_rectangle([(472, y_pos), (WIDTH - 32, y_pos + 52)], radius=6, fill=(22, 34, 54), outline=(51, 65, 85))
    draw.ellipse([(482, y_pos + 12), (496, y_pos + 26)], fill=col)
    draw.text((506, y_pos + 12), name, fill=(255, 255, 255), font=font_bold)
    draw.text((WIDTH - 110, y_pos + 12), f"{pct} · {ha}", fill=(52, 211, 153), font=font_tag)
    # mini bar
    draw.rectangle([(506, y_pos + 34), (WIDTH - 44, y_pos + 40)], fill=(15, 23, 42))
    draw.rectangle([(506, y_pos + 34), (506 + int(int(pct[:-1]) * 1.8), y_pos + 40)], fill=col)

draw.text((475, 385), "💡 Click row to copy · Snap beside map", fill=(148, 163, 184), font=font_tag)
walkthrough_frames.append(img)

# Frame 5: Swath Robotics
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 106)], radius=8, fill=(19, 34, 56), outline=(37, 99, 235))
draw.text((34, 70), "STEP 5 · Autonomous Machinery Coverage Path Planning (Fields2Cover)", fill=(56, 189, 248), font=font_bold)
draw.text((34, 88), "Generates turn-efficient tractor swaths, headland loops, and variable-rate N prescriptions", fill=(203, 213, 225), font=font_subtitle)

# Swaths Map
draw.rounded_rectangle([(20, 120), (440, 420)], radius=8, fill=(10, 20, 30), outline=(56, 189, 248))
draw.text((32, 130), "18m Boom Swath Tracks (Heading: 74.2°)", fill=(56, 189, 248), font=font_bold)
for line_i in range(12):
    y_l = 170 + line_i * 19
    draw.line([(60 + line_i * 8, y_l), (380 + line_i * 4, y_l)], fill=(56, 189, 248), width=2)
# Headland loops
draw.arc([(50, 165), (70, 390)], start=90, end=270, fill=(249, 115, 22), width=3)
draw.arc([(380, 165), (400, 390)], start=270, end=90, fill=(249, 115, 22), width=3)
draw.text((80, 395), "🚜 34 Swaths · 4.82 km total distance", fill=(255, 255, 255), font=font_tag)

# Robotics Cards on Right
draw.rounded_rectangle([(460, 120), (WIDTH - 20, 420)], radius=8, fill=(15, 23, 42), outline=(30, 41, 59))
draw.text((475, 132), "Coverage & VRA Prescription", fill=(255, 255, 255), font=font_bold)
specs_r = [
    ("Implement Width", "18.0 m Sprayer Boom"),
    ("Coverage Efficiency", "98.4% Parcel Area"),
    ("Headland Loop Turns", "34 Dubins curves"),
    ("Fuel Savings", "~14% vs unguided driving"),
    ("Zone 1 Prescription", "45 kg N/ha (Maintenance)"),
    ("Zone 2 Prescription", "70 kg N/ha (Standard)"),
    ("Zone 3 Prescription", "95 kg N/ha (Booster)")
]
for i, (k, v) in enumerate(specs_r):
    y_p = 168 + i * 34
    draw.text((475, y_p), k + ":", fill=(148, 163, 184), font=font_tag)
    draw.text((475, y_p + 14), v, fill=(52, 211, 153) if "Prescription" in k else (255, 255, 255), font=font_body)

walkthrough_frames.append(img)

# Save GIF 1
walkthrough_frames[0].save(
    'docs/walkthrough_satellite_data.gif',
    save_all=True,
    append_images=walkthrough_frames[1:],
    duration=2200,
    loop=0
)
shutil.copy('docs/walkthrough_satellite_data.gif', 'public/docs/walkthrough_satellite_data.gif')
print("Successfully generated docs/walkthrough_satellite_data.gif")


# ==========================================
# GIF 2: where_is_what_tour.gif
# ==========================================
tour_frames = []

# Frame 1: Cadastral Boundary Ingestion & Open Data
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 110)], radius=8, fill=(19, 34, 56), outline=(16, 185, 129))
draw.text((34, 72), "WHERE IS WHAT · 1. Cadastral Boundary Ingestion & Formats", fill=(52, 211, 153), font=font_bold)
draw.text((34, 90), "Location: Header & Sidebar → 'Add a Farm' & Pro-GIS Exporters", fill=(203, 213, 225), font=font_subtitle)

# Visual card
draw.rounded_rectangle([(20, 125), (WIDTH - 20, 420)], radius=10, fill=(10, 25, 20), outline=(52, 211, 153))
draw.text((40, 145), "🗺️ Ingest & Export High-Precision Vector Geometries", fill=(52, 211, 153), font=font_title)
draw.text((40, 175), "• Draw vector polygons directly on Sentinel-2 satellite basemap", fill=(255, 255, 255), font=font_body)
draw.text((40, 205), "• Walk farm perimeter with live mobile GPS receiver", fill=(255, 255, 255), font=font_body)
draw.text((40, 235), "• Ingest ESRI Shapefiles (.zip), GeoJSON, KML, GPX, and WKT", fill=(255, 255, 255), font=font_body)
draw.text((40, 265), "• Instant client-side Dexie.js IndexedDB vault storage with zero telemetry", fill=(255, 255, 255), font=font_body)

draw.rounded_rectangle([(40, 310), (320, 370)], radius=8, fill=(16, 185, 129))
draw.text((60, 332), "Draw / Walk Field Boundary", fill=(0, 0, 0), font=font_bold)
draw.rounded_rectangle([(340, 310), (620, 370)], radius=8, fill=(56, 189, 248))
draw.text((360, 332), "Upload Shapefile / GeoJSON", fill=(0, 0, 0), font=font_bold)
tour_frames.append(img)

# Frame 2: Map & Metered Tape Ruler
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 110)], radius=8, fill=(19, 34, 56), outline=(16, 185, 129))
draw.text((34, 72), "WHERE IS WHAT · 2. Interactive Map & Metered Tape Ruler", fill=(52, 211, 153), font=font_bold)
draw.text((34, 90), "Location: Main Map Canvas → Movable TradingView-Style Precision Ruler", fill=(203, 213, 225), font=font_subtitle)

draw.rounded_rectangle([(20, 125), (WIDTH - 20, 420)], radius=10, fill=(15, 23, 42), outline=(51, 65, 85))
# Ruler visualization
draw.line([(80, 240), (520, 240)], fill=(52, 211, 153), width=3)
draw.ellipse([(72, 232), (88, 248)], fill=(16, 185, 129))
draw.ellipse([(512, 232), (528, 248)], fill=(16, 185, 129))

# Ruler Tag
draw.rounded_rectangle([(220, 180), (410, 225)], radius=6, fill=(16, 185, 129))
draw.text((235, 195), "📏 482.5 m · 0.8% slope", fill=(0, 0, 0), font=font_bold)

draw.text((60, 280), "• Movable & adjustable anywhere across maps and pages", fill=(255, 255, 255), font=font_body)
draw.text((60, 310), "• Dynamic geodesic distance, bearing angle, and Copernicus DEM elevation delta", fill=(255, 255, 255), font=font_body)
draw.text((60, 340), "• TradingView style drag handles with 1-click measurement reset", fill=(255, 255, 255), font=font_body)
tour_frames.append(img)

# Frame 3: Movable Classification Legend
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 110)], radius=8, fill=(19, 34, 56), outline=(16, 185, 129))
draw.text((34, 72), "WHERE IS WHAT · 3. Adjustable Classification Legends Beside Maps", fill=(52, 211, 153), font=font_bold)
draw.text((34, 90), "Location: Beside all classified maps & GeoAI Studio → '🏷️ Floating legend shortcut'", fill=(203, 213, 225), font=font_subtitle)

draw.rounded_rectangle([(20, 125), (WIDTH - 20, 420)], radius=10, fill=(15, 23, 42), outline=(51, 65, 85))
draw.text((40, 145), "Adjustable Everywhere Classification Legend Features:", fill=(255, 255, 255), font=font_title)
draw.text((40, 180), "• Draggable to any screen corner with touch and mouse support", fill=(203, 213, 225), font=font_body)
draw.text((40, 210), "• Minimize into compact pill badge ('🏷️ Legend · 3 classes')", fill=(203, 213, 225), font=font_body)
draw.text((40, 240), "• Snap shortcuts: 'Snap Beside Map' and 'Top-Right'", fill=(203, 213, 225), font=font_body)
draw.text((40, 270), "• 1-Click copy class name, percentage, and hectare metrics to clipboard", fill=(203, 213, 225), font=font_body)
draw.text((40, 300), "• Available across Supervised Classifications, K-Means, and Land-Cover maps", fill=(203, 213, 225), font=font_body)
tour_frames.append(img)

# Frame 4: Trilingual Reports & Robotics
img, draw = create_base_canvas()
draw.rounded_rectangle([(20, 62), (WIDTH - 20, 110)], radius=8, fill=(19, 34, 56), outline=(16, 185, 129))
draw.text((34, 72), "WHERE IS WHAT · 4. Swath Robotics & Trilingual Dossiers (EN / HI / TE)", fill=(52, 211, 153), font=font_bold)
draw.text((34, 90), "Location: Analysis Lab → GeoTools & Topbar → 'Create report' Dialog", fill=(203, 213, 225), font=font_subtitle)

draw.rounded_rectangle([(20, 125), (WIDTH - 20, 420)], radius=10, fill=(15, 23, 42), outline=(51, 65, 85))
# 3 Language cards
langs = [
    ("English Dossier", "Precision agriculture formulas & North arrow maps", (59, 130, 246)),
    ("हिन्दी (Hindi)", "किसान पोषण सलाह और यूरिया छिड़काव मात्रा", (34, 197, 94)),
    ("తెలుగు (Telugu)", "రైతు సంరక్షణ మరియు ఎరువుల సమగ్ర నివేదిక", (249, 115, 22))
]
for idx, (l_title, l_desc, col) in enumerate(langs):
    x_c = 40 + idx * 225
    draw.rounded_rectangle([(x_c, 150), (x_c + 215, 280)], radius=8, fill=(22, 34, 54), outline=col)
    draw.text((x_c + 14, 165), l_title, fill=(255, 255, 255), font=font_bold)
    draw.text((x_c + 14, 200), l_desc, fill=(203, 213, 225), font=font_tag)
    draw.rounded_rectangle([(x_c + 14, 235), (x_c + 195, 265)], radius=6, fill=col)
    draw.text((x_c + 30, 245), "Download Report", fill=(0, 0, 0), font=font_tag)

draw.text((40, 320), "• Fields2Cover Swath Robotics: Coverage path planning, tractor width & turn loops", fill=(203, 213, 225), font=font_body)
draw.text((40, 350), "• Variable-Rate Application (VRA): Urea and irrigation prescription maps", fill=(203, 213, 225), font=font_body)
tour_frames.append(img)

# Save GIF 2
tour_frames[0].save(
    'docs/where_is_what_tour.gif',
    save_all=True,
    append_images=tour_frames[1:],
    duration=2400,
    loop=0
)
shutil.copy('docs/where_is_what_tour.gif', 'public/docs/where_is_what_tour.gif')
print("Successfully generated docs/where_is_what_tour.gif")
