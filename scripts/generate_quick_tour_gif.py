import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_quick_tour_gif():
    # Load base frames
    base_0 = Image.open('docs/_sg_0.png').convert('RGB')
    base_1 = Image.open('docs/_sg_1.png').convert('RGB')
    base_2 = Image.open('docs/_sg_2.png').convert('RGB')
    base_5 = Image.open('docs/_sg_5.png').convert('RGB')
    base_9 = Image.open('docs/_sg_9.png').convert('RGB')
    base_10 = Image.open('docs/_sg_10.png').convert('RGB')
    base_14 = Image.open('docs/_sg_14.png').convert('RGB')

    # Load brand avatar for popup header and bottom bar
    avatar_img = None
    if os.path.exists('docs/logo.png'):
        try:
            av = Image.open('docs/logo.png').convert('RGBA')
            avatar_img = av.resize((26, 26), Image.Resampling.LANCZOS)
        except Exception:
            avatar_img = None

    # Step specifications
    steps = [
        {
            "step": 1,
            "base": base_0,
            "spot": (10, 110, 125, 145), # Workspace nav (Overview, My farms, Crop journal, Alerts, Reports)
            "pop": (160, 120, 350, 175), # To the right of the sidebar
            "title": "Your menu & workspace",
            "body": "Overview takes you to the top, My farms to your farm list, Crop journal to your notes, Alerts to farms that need care, and Reports to your printable dossier.",
            "caption_title": "Mitra's Tour: 1. Your Menu & Workspace",
            "caption_sub": "Workspace navigation, farm lists, and printable dossiers are always one click away",
            "btn": "Next ->"
        },
        {
            "step": 2,
            "base": base_0,
            "spot": (700, 70, 82, 28), # + Add a farm button
            "pop": (370, 112, 350, 175), # Below and to the left of the button
            "title": "Add a farm",
            "body": "Start here. Draw your farm boundary directly on the map, walk the perimeter with GPS, type coordinates, or upload GeoJSON, KML, GPX, WKT, or Shapefiles.",
            "caption_title": "Mitra's Tour: 2. Add a Farm — Boundary Editor",
            "caption_sub": "Draw on satellite map, walk with GPS, or upload GeoJSON, KML, Shapefile, or WKT",
            "btn": "Next ->"
        },
        {
            "step": 3,
            "base": base_1,
            "spot": (452, 195, 330, 270), # The Live Map card (whole map with parameters & tools)
            "pop": (140, 220, 295, 185), # To the left of the map card
            "title": "The live map",
            "body": "Use Parameters to toggle between NDVI crop vigour, moisture and terrain, Base map for satellite or topo, and Whole map / Farm only to clip to your exact boundary.",
            "caption_title": "Mitra's Tour: 3. The Live Map — Sentinel-2 L2A & Spectral Layers",
            "caption_sub": "Parameters, base maps, and farm boundary clipping updated with each clear pass",
            "btn": "Next ->"
        },
        {
            "step": 4,
            "base": base_2,
            "spot": (212, 64, 128, 250), # NDVI Index card with color-coded scale bar
            "pop": (355, 90, 360, 175), # To the right of the scale card
            "title": "NDVI indices with scales",
            "body": "Every number comes directly from the newest clear Sentinel-2 pass with a color-coded scale under it, so you can evaluate crop vigour and soil moisture at a glance.",
            "caption_title": "Mitra's Tour: 4. NDVI Indices with Scales — Clear Agronomic Indicators",
            "caption_sub": "Color-coded vegetation vigour and moisture scales with min, mean, and max values",
            "btn": "Next ->"
        },
        {
            "step": 5,
            "base": base_5,
            "spot": (202, 118, 580, 342), # Analysis Lab Land Cover & Management Zones
            "pop": (220, 12, 360, 158), # Cleanly above the maps at the top
            "title": "Analysis lab",
            "body": "Explore Earth Engine-style analytics: true-colour reflectance, vegetation maps, seasonal NDVI change detection, and pest/disease weather vulnerability models.",
            "caption_title": "Mitra's Tour: 5. Analysis Lab — Earth Engine Workflows & Zones",
            "caption_sub": "Pixel-level land cover, k-means management zones, and seasonal crop change models",
            "btn": "Next ->"
        },
        {
            "step": 6,
            "base": base_9,
            "spot": (202, 88, 580, 380), # GeoAI Studio with method toggles and clusters
            "pop": (410, 95, 360, 175), # Top-right above the maps (leaves method toggles visible!)
            "title": "GeoAI studio",
            "body": "The in-browser GeoAI studio runs k-means++ spectral clustering and supervised classification directly on your device. It automatically groups your field into crop vigor zones.",
            "caption_title": "Mitra's Tour: 6. GeoAI Studio — In-Browser Spectral Clustering",
            "caption_sub": "Unsupervised k-means++ and supervised classification grouping your field into vigor zones",
            "btn": "Next ->"
        },
        {
            "step": 7,
            "base": base_10,
            "spot": (202, 176, 580, 288), # Complete Geo toolkit farm geometry cards and scale
            "pop": (250, 12, 365, 155), # Positioned in the upper region, perfectly clear of geometry cards
            "title": "Geospatial tools",
            "body": "Field calculation suite: WKT polygon reader, geodesic buffer rings, GPS coordinate converter, and geodesic area/distance calculators.",
            "caption_title": "Mitra's Tour: 7. Geospatial Tools — Geodesic Calculators & Converters",
            "caption_sub": "WKT parser, buffer expansion, GPS converter, and geodesic area/perimeter tools",
            "btn": "Next ->"
        },
        {
            "step": 8,
            "base": base_14,
            "spot": (120, 204, 605, 265), # Branded report modal
            "pop": (240, 20, 365, 165), # Right above the modal dialog
            "title": "Branded farm reports",
            "body": "Generate a print-ready PDF or standalone HTML dossier with North arrow, scale bar, Sentinel-2 metadata, and agronomic index scorecards in one click.",
            "caption_title": "Mitra's Tour: 8. Branded Farm Reports — Print-Ready Cartographic Dossier",
            "caption_sub": "Export PDF or standalone HTML with North arrow, scale bar, and agronomic scorecards",
            "btn": "Next ->"
        },
        {
            "step": 9,
            "base": base_0,
            "spot": (18, 430, 85, 26), # Log out button in sidebar
            "pop": (130, 295, 350, 160), # Right next to logout, leaves button visible
            "title": "Signing out",
            "body": "Sign out securely whenever you are done. Your farm boundaries and local settings stay safely saved on this device.",
            "caption_title": "Mitra's Tour: 9. Signing Out — Local In-Browser Privacy & Security",
            "caption_sub": "Zero cloud lock-in: farm boundaries, settings, and journal notes stay on your device",
            "btn": "Finish"
        }
    ]

    # Try loading high quality fonts
    font_paths = [
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf"
    ]
    font_bold_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\calibrib.ttf"
    ]

    font_regular = None
    font_bold = None
    for p in font_paths:
        if os.path.exists(p):
            font_regular = p
            break
    for p in font_bold_paths:
        if os.path.exists(p):
            font_bold = p
            break

    f_title = ImageFont.truetype(font_bold or "arial.ttf", 15)
    f_body = ImageFont.truetype(font_regular or "arial.ttf", 12)
    f_badge = ImageFont.truetype(font_bold or "arial.ttf", 11)
    f_meta = ImageFont.truetype(font_regular or "arial.ttf", 11)
    f_btn = ImageFont.truetype(font_bold or "arial.ttf", 11)
    f_cap_t = ImageFont.truetype(font_bold or "arial.ttf", 13)
    f_cap_s = ImageFont.truetype(font_regular or "arial.ttf", 11)

    frames = []

    for item in steps:
        bg = item["base"].copy()
        W, H = bg.size

        # Create dimmed overlay with transparent spotlight cutout
        overlay = Image.new("RGBA", (W, H), (7, 17, 12, 160)) # 62% dim
        odraw = ImageDraw.Draw(overlay)

        # Clear spotlight area
        sx, sy, sw, sh = item["spot"]
        pad = 8
        rx1, ry1 = max(0, sx - pad), max(0, sy - pad)
        rx2, ry2 = min(W, sx + sw + pad), min(H, sy + sh + pad)
        odraw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=10, fill=(0, 0, 0, 0))

        # Composite dim overlay over base image
        bg = Image.alpha_composite(bg.convert("RGBA"), overlay)
        draw = ImageDraw.Draw(bg)

        # Draw glowing neon-lime spotlight border around target
        # Inner soft glow
        draw.rounded_rectangle([rx1 - 2, ry1 - 2, rx2 + 2, ry2 + 2], radius=12, outline=(182, 243, 106, 90), width=1)
        draw.rounded_rectangle([rx1 - 1, ry1 - 1, rx2 + 1, ry2 + 1], radius=11, outline=(182, 243, 106, 180), width=1)
        # Sharp high-contrast ring
        draw.rounded_rectangle([rx1, ry1, rx2, ry2], radius=10, outline=(182, 243, 106, 255), width=3)

        # Draw Mitra Popup Card (.mi-pop)
        px, py, pw, ph = item["pop"]

        # Drop shadow for popup
        shadow = Image.new("RGBA", (pw + 24, ph + 24), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        sdraw.rounded_rectangle([12, 12, pw + 12, ph + 12], radius=16, fill=(0, 0, 0, 110))
        shadow = shadow.filter(ImageFilter.GaussianBlur(6))
        bg.paste(shadow, (px - 12, py - 6), shadow)

        # White popup box
        draw.rounded_rectangle([px, py, px + pw, py + ph], radius=14, fill=(255, 255, 255, 255), outline=(230, 238, 233, 255), width=1)

        # Header: Mitra Avatar + "Mitra" + step count + close button
        # Avatar circle
        av_x, av_y = px + 14, py + 12
        draw.ellipse([av_x, av_y, av_x + 22, av_y + 22], fill=(31, 107, 58, 255))
        draw.text((av_x + 7, av_y + 4), "M", font=f_badge, fill=(255, 255, 255))

        draw.text((av_x + 28, av_y + 3), "Mitra", font=f_badge, fill=(31, 107, 58))
        draw.text((px + pw - 62, av_y + 3), f"{item['step']} of 9", font=f_meta, fill=(107, 128, 113))
        draw.text((px + pw - 24, av_y + 2), "×", font=f_title, fill=(130, 145, 135))

        # Title
        ty = av_y + 28
        draw.text((px + 14, ty), f"{item['step']}. {item['title']}", font=f_title, fill=(16, 35, 26))

        # Body text with clean word-wrapping
        words = item["body"].split()
        lines = []
        cur_line = []
        max_w = pw - 28
        for w in words:
            test_line = " ".join(cur_line + [w])
            bbox = draw.textbbox((0, 0), test_line, font=f_body)
            if bbox[2] - bbox[0] > max_w:
                if cur_line:
                    lines.append(" ".join(cur_line))
                    cur_line = [w]
                else:
                    lines.append(w)
                    cur_line = []
            else:
                cur_line.append(w)
        if cur_line:
            lines.append(" ".join(cur_line))

        by = ty + 24
        for l in lines:
            draw.text((px + 14, by), l, font=f_body, fill=(44, 70, 54))
            by += 16

        # Progress dots (9 dots, active is elongated green pill)
        dot_y = py + ph - 38
        dot_x = px + 14
        for k in range(9):
            if k == item["step"] - 1:
                draw.rounded_rectangle([dot_x, dot_y, dot_x + 16, dot_y + 6], radius=3, fill=(31, 107, 58))
                dot_x += 21
            else:
                draw.ellipse([dot_x, dot_y, dot_x + 6, dot_y + 6], fill=(201, 217, 198))
                dot_x += 11

        # Action Buttons
        # "Next ->" / "Finish" Button
        btn_w = 68
        btn_h = 24
        btn_x = px + pw - btn_w - 14
        btn_y = py + ph - btn_h - 10
        draw.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=12, fill=(31, 107, 58))
        draw.text((btn_x + 12, btn_y + 5), item["btn"], font=f_btn, fill=(255, 255, 255))

        # Bottom Bar: Dark Green Banner with Mitra branding and step summary
        bar_h = 56
        bar_y = H - bar_h
        draw.rectangle([0, bar_y, W, H], fill=(16, 38, 26, 255)) # Dark green #10261a
        draw.line([0, bar_y, W, bar_y], fill=(36, 68, 50, 255), width=1)

        # Avatar thumbnail in bottom bar
        if avatar_img:
            bg.paste(avatar_img, (14, bar_y + 15), avatar_img)
        else:
            draw.ellipse([14, bar_y + 15, 40, bar_y + 41], fill=(31, 107, 58))
            draw.text((22, bar_y + 20), "M", font=f_badge, fill=(255, 255, 255))

        draw.text((50, bar_y + 10), item["caption_title"], font=f_cap_t, fill=(240, 250, 242))
        draw.text((50, bar_y + 30), item["caption_sub"], font=f_cap_s, fill=(160, 205, 175))

        frames.append(bg.convert("RGB"))

    # Save as high quality animated GIF with 2400ms per frame
    output_path = "docs/quick-tour.gif"
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=2400,
        loop=0,
        optimize=True
    )
    print(f"Generated {output_path} successfully with {len(frames)} frames.")

    # Also save frames to inspect
    for i, f in enumerate(frames):
        f.save(f"docs/_latest_tour_{i}.png")
    print("Exported debug frames _latest_tour_0..8.png")

if __name__ == "__main__":
    create_quick_tour_gif()
