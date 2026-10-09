import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
import math
import numpy as np
from PIL import Image, ImageDraw

OUT_DIR = r"c:\Users\Akshit Vinay\Desktop\seva gis\docs\readme_icons"
PUBLIC_DIR = r"c:\Users\Akshit Vinay\Desktop\seva gis\public\docs\readme_icons"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

def save_gif(frames, filename, duration=70):
    p_frames = []
    for f in frames:
        # Convert RGBA to palette with alpha transparency
        alpha = f.getchannel('A')
        f_rgb = f.convert('RGB')
        p_img = f_rgb.convert('P', palette=Image.ADAPTIVE, colors=128)
        # Mask transparent pixels
        mask = Image.eval(alpha, lambda a: 255 if a < 128 else 0)
        p_img.paste(255, mask)
        p_frames.append(p_img)

    out_path = os.path.join(OUT_DIR, filename)
    p_frames[0].save(
        out_path,
        save_all=True,
        append_images=p_frames[1:],
        duration=duration,
        loop=0,
        transparency=255,
        disposal=2
    )
    # Copy to public
    pub_path = os.path.join(PUBLIC_DIR, filename)
    p_frames[0].save(
        pub_path,
        save_all=True,
        append_images=p_frames[1:],
        duration=duration,
        loop=0,
        transparency=255,
        disposal=2
    )
    print(f"Generated {filename}")

# -------------------------------------------------------------
# 1. Clapping Hands GIF
# -------------------------------------------------------------
def gen_clapping_hands():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        # Clap phase
        phase = (i / N) * math.pi * 2
        # Clap strikes at phase ~ pi/2 and 3pi/2
        dist = abs(math.sin(phase * 2)) * 8
        is_hit = dist < 2

        # Left hand
        lx = 22 - dist * 0.7
        ly = 32 + dist * 0.2
        d.pieslice([lx - 12, ly - 14, lx + 12, ly + 14], 200, 380, fill=(245, 158, 11, 255), outline=(180, 83, 9, 255))
        # Left fingers
        d.line([lx, ly - 8, lx + 10 - dist, ly - 6], fill=(251, 191, 36, 255), width=3)
        d.line([lx, ly - 3, lx + 12 - dist, ly - 2], fill=(251, 191, 36, 255), width=3)
        d.line([lx, ly + 2, lx + 11 - dist, ly + 2], fill=(251, 191, 36, 255), width=3)

        # Right hand
        rx = 42 + dist * 0.7
        ry = 32 + dist * 0.2
        d.pieslice([rx - 12, ry - 14, rx + 12, ry + 14], 160, 340, fill=(251, 191, 36, 255), outline=(217, 119, 6, 255))
        # Right fingers
        d.line([rx, ry - 8, rx - 10 + dist, ry - 6], fill=(245, 158, 11, 255), width=3)
        d.line([rx, ry - 3, rx - 12 + dist, ry - 2], fill=(245, 158, 11, 255), width=3)
        d.line([rx, ry + 2, rx - 11 + dist, ry + 2], fill=(245, 158, 11, 255), width=3)

        # Sparkles on clap impact
        if is_hit:
            d.text((32, 14), "✦", fill=(250, 204, 21, 255))
            d.text((22, 16), "★", fill=(245, 158, 11, 255))
            d.text((40, 16), "★", fill=(251, 191, 36, 255))
            d.text((32, 46), "✧", fill=(250, 204, 21, 255))

        frames.append(im)
    save_gif(frames, "clapping_hands.gif", 70)

# -------------------------------------------------------------
# 2. Author Waving GIF
# -------------------------------------------------------------
def gen_author_waving():
    frames = []
    N = 24
    for i in range(N):
        im = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Desk
        d.rectangle([10, 56, 62, 60], fill=(71, 85, 105, 255))

        # Body / Green Shirt
        d.rounded_rectangle([26, 36, 46, 56], radius=4, fill=(16, 185, 129, 255), outline=(4, 120, 87, 255))
        # Head
        d.ellipse([29, 14, 43, 28], fill=(253, 230, 138, 255), outline=(217, 119, 6, 255))
        # Hair
        d.chord([28, 12, 44, 22], 180, 360, fill=(30, 41, 59, 255))
        # Eyes & Smile
        d.ellipse([33, 19, 35, 21], fill=(15, 23, 42, 255))
        d.ellipse([37, 19, 39, 21], fill=(15, 23, 42, 255))
        d.arc([34, 22, 38, 25], 0, 180, fill=(217, 119, 6, 255), width=2)

        # Laptop Lid Angle: starts open (typing), then closes partially during wave
        wave_start = 8
        is_waving = i >= wave_start
        lid_h = 14 if not is_waving else 6  # closed slightly!

        # Laptop base
        d.rectangle([18, 52, 36, 55], fill=(148, 163, 184, 255))
        # Laptop screen (slanted)
        d.polygon([(18, 52), (20, 52 - lid_h), (34, 52 - lid_h), (32, 52)], fill=(51, 65, 85, 255), outline=(30, 41, 59, 255))
        if not is_waving:
            # Glowing screen
            d.polygon([(20, 51), (21, 52 - lid_h + 1), (33, 52 - lid_h + 1), (31, 51)], fill=(56, 189, 248, 255))

        # Right Hand: typing vs waving
        if not is_waving:
            # Typing on keyboard
            d.line([38, 42, 30, 52], fill=(253, 230, 138, 255), width=3)
        else:
            # Waving hand oscillating
            w_phase = ((i - wave_start) / (N - wave_start)) * math.pi * 4
            w_angle = math.sin(w_phase) * 6
            wx = 52 + w_angle
            wy = 22 - abs(w_angle) * 0.4
            d.line([42, 40, 48, 30], fill=(16, 185, 129, 255), width=4) # arm
            d.line([48, 30, wx, wy], fill=(253, 230, 138, 255), width=3) # forearm
            d.ellipse([wx - 3, wy - 3, wx + 3, wy + 3], fill=(253, 230, 138, 255)) # hand
            # Sparkle greeting
            d.text((56, 12), "✦", fill=(251, 191, 36, 255))

        frames.append(im)
    save_gif(frames, "author_waving.gif", 75)

# -------------------------------------------------------------
# 3. Heart to Butterfly GIF
# -------------------------------------------------------------
def gen_heart_butterfly():
    frames = []
    N = 28
    for i in range(N):
        im = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        t = i / N
        if t < 0.45:
            # Beating Purple to Red Heart with crack
            beat = 1.0 + 0.08 * math.sin(t * math.pi * 8)
            # Color transitions from Purple (168, 85, 247) to Red (239, 68, 68)
            frac = t / 0.45
            r = int(168 + (239 - 168) * frac)
            g = int(85 + (68 - 85) * frac)
            b = int(247 + (68 - 247) * frac)
            c = (r, g, b, 255)

            cx, cy = 36, 36
            # Draw Heart shape
            pts = []
            for deg in range(0, 360, 10):
                rad = math.radians(deg)
                hx = 16 * (math.sin(rad) ** 3)
                hy = -(13 * math.cos(rad) - 5 * math.cos(2 * rad) - 2 * math.cos(3 * rad) - math.cos(4 * rad))
                pts.append((cx + hx * beat * 1.1, cy + hy * beat * 1.1))
            d.polygon(pts, fill=c, outline=(255, 255, 255, 220))

            # Cracking line appears as it turns red
            if t > 0.2:
                c_len = (t - 0.2) / 0.25
                d.line([(36, 24), (34, 30), (38, 35), (35, 42), (36, 42 + 6 * c_len)], fill=(254, 240, 138, 255), width=2)
        else:
            # Cracked Heart splits & Butterfly emerges!
            b_t = (t - 0.45) / 0.55
            # Butterfly position flying upward
            bx = 36 + math.sin(b_t * math.pi * 4) * 4
            by = 42 - b_t * 26
            wing_flap = math.sin(b_t * math.pi * 10) * 12

            # Left split heart half fading
            alpha_h = int(255 * max(0, 1.0 - b_t * 2))
            if alpha_h > 10:
                d.chord([20 - b_t * 12, 34, 36 - b_t * 12, 54], 120, 300, fill=(239, 68, 68, alpha_h))
                d.chord([36 + b_t * 12, 34, 52 + b_t * 12, 54], 240, 60, fill=(239, 68, 68, alpha_h))

            # Rainbow Butterfly wings
            # Top wings
            d.pieslice([bx - 16 + wing_flap, by - 14, bx, by + 4], 160, 340, fill=(6, 182, 212, 255), outline=(255, 255, 255, 255)) # Cyan
            d.pieslice([bx, by - 14, bx + 16 - wing_flap, by + 4], 200, 20, fill=(244, 63, 94, 255), outline=(255, 255, 255, 255)) # Rose
            # Bottom wings
            d.pieslice([bx - 12 + wing_flap * 0.7, by - 2, bx, by + 12], 120, 260, fill=(16, 185, 129, 255)) # Emerald
            d.pieslice([bx, by - 2, bx + 12 - wing_flap * 0.7, by + 12], 280, 60, fill=(245, 158, 11, 255)) # Gold
            # Butterfly Body
            d.line([bx, by - 10, bx, by + 8], fill=(30, 41, 59, 255), width=3)
            # Antennae
            d.line([bx, by - 10, bx - 4, by - 15], fill=(30, 41, 59, 255), width=1)
            d.line([bx, by - 10, bx + 4, by - 15], fill=(30, 41, 59, 255), width=1)

            # Magic sparkles trail
            d.text((bx - 10, by + 10), "✧", fill=(251, 191, 36, 255))
            d.text((bx + 8, by + 8), "✦", fill=(192, 132, 252, 255))

        frames.append(im)
    save_gif(frames, "heart_butterfly.gif", 70)

# -------------------------------------------------------------
# 4. Limitations Warning Triangle GIF
# -------------------------------------------------------------
def gen_warning_triangle():
    frames = []
    N = 16
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Plain Yellow Triangular Board
        pts = [(32, 10), (56, 52), (8, 52)]
        d.polygon(pts, fill=(250, 204, 21, 255), outline=(217, 119, 6, 255))
        # Inner warning border
        d.polygon([(32, 16), (51, 50), (13, 50)], outline=(180, 83, 9, 200), width=2)

        # Blinking '!' inside
        # Sinusoidal blink
        alpha = int(255 * (0.3 + 0.7 * abs(math.sin(i / N * math.pi * 2))))
        d.line([32, 24, 32, 38], fill=(15, 23, 42, alpha), width=4)
        d.ellipse([30, 42, 34, 46], fill=(15, 23, 42, alpha))

        frames.append(im)
    save_gif(frames, "warning_triangle.gif", 75)

# -------------------------------------------------------------
# 5. Open Data Sources Antenna Hologram GIF
# -------------------------------------------------------------
def gen_antenna_hologram():
    frames = []
    N = 24
    for i in range(N):
        im = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Tower Antenna at bottom
        d.line([36, 40, 26, 66], fill=(100, 116, 139, 255), width=2)
        d.line([36, 40, 46, 66], fill=(100, 116, 139, 255), width=2)
        d.line([29, 52, 43, 52], fill=(100, 116, 139, 255), width=2)
        d.line([27, 60, 45, 60], fill=(100, 116, 139, 255), width=2)
        d.ellipse([34, 38, 38, 42], fill=(239, 68, 68, 255)) # Beacon light

        # Hologram projector beam cone
        d.polygon([(36, 38), (14, 10), (58, 10)], fill=(6, 182, 212, 35))

        # Rotating 3D Hologram Globe
        cx, cy, R = 36, 20, 14
        rot = (i / N) * math.pi * 2

        # Outer glow ring
        d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(6, 182, 212, 240), width=2)
        # Latitudes
        d.arc([cx - R, cy - R * 0.5, cx + R, cy + R * 0.5], 0, 360, fill=(34, 211, 238, 140))
        # Rotating Longitudes
        ew = abs(math.cos(rot)) * R
        d.ellipse([cx - ew, cy - R, cx + ew, cy + R], outline=(52, 211, 153, 200), width=1)
        ew2 = abs(math.cos(rot + math.pi / 2)) * R
        d.ellipse([cx - ew2, cy - R, cx + ew2, cy + R], outline=(34, 211, 238, 200), width=1)

        # Floating data bits
        bx = cx + math.cos(rot * 2) * (R + 4)
        by = cy + math.sin(rot * 2) * 5
        d.ellipse([bx - 1.5, by - 1.5, bx + 1.5, by + 1.5], fill=(250, 204, 21, 255))

        frames.append(im)
    save_gif(frames, "antenna_hologram.gif", 70)

# -------------------------------------------------------------
# 6. Satellite Scanning Earth GIF (Feature Matrix)
# -------------------------------------------------------------
def gen_satellite_earth_scan():
    frames = []
    N = 24
    for i in range(N):
        im = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Earth curved horizon at bottom
        d.pieslice([4, 42, 68, 96], 180, 360, fill=(14, 165, 233, 255), outline=(56, 189, 248, 255))
        # Land patches
        d.chord([16, 44, 40, 62], 200, 340, fill=(34, 197, 94, 255))

        # Satellite in upper area
        sat_x = 18 + (i / N) * 36
        sat_y = 16

        # Solar panels
        d.rectangle([sat_x - 12, sat_y - 3, sat_x - 4, sat_y + 3], fill=(59, 130, 246, 255), outline=(250, 204, 21, 255))
        d.rectangle([sat_x + 4, sat_y - 3, sat_x + 12, sat_y + 3], fill=(59, 130, 246, 255), outline=(250, 204, 21, 255))
        # Satellite body
        d.rectangle([sat_x - 4, sat_y - 4, sat_x + 4, sat_y + 4], fill=(226, 232, 240, 255), outline=(148, 163, 184, 255))

        # Scanner Laser Beam sweeping to Earth
        beam_w = 12
        d.polygon([(sat_x, sat_y + 4), (sat_x - beam_w, 48), (sat_x + beam_w, 48)], fill=(16, 185, 129, 65))
        # Active sensor sweep footprint on Earth
        d.ellipse([sat_x - 8, 46, sat_x + 8, 50], fill=(74, 222, 128, 200), outline=(255, 255, 255, 255))

        frames.append(im)
    save_gif(frames, "satellite_earth_scan.gif", 70)

# -------------------------------------------------------------
# 7. Packing / Unpacking Box GIF
# -------------------------------------------------------------
def gen_packing_box():
    frames = []
    N = 24
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        t = i / N
        cycle = math.sin(t * math.pi * 2) # -1 to 1

        # Box base (isometric kraft box)
        d.polygon([(32, 38), (52, 28), (52, 48), (32, 58)], fill=(180, 83, 9, 255)) # Right face
        d.polygon([(32, 38), (12, 28), (12, 48), (32, 58)], fill=(217, 119, 6, 255)) # Left face
        d.polygon([(32, 38), (12, 28), (32, 18), (52, 28)], fill=(245, 158, 11, 255)) # Top face

        # Item floating out / in
        doc_h = max(0, cycle) * 14
        dy = 24 - doc_h
        # Glowing Map Packet
        d.polygon([(32, dy), (44, dy - 6), (44, dy + 8), (32, dy + 14)], fill=(56, 189, 248, 255), outline=(255, 255, 255, 255))
        d.polygon([(32, dy), (20, dy - 6), (20, dy + 8), (32, dy + 14)], fill=(14, 165, 233, 255), outline=(255, 255, 255, 255))

        # Flaps opening in perspective
        flap_angle = max(0, cycle) * 8
        d.polygon([(12, 28), (32, 18), (32 - flap_angle, 18 - flap_angle), (12 - flap_angle, 28 - flap_angle)], fill=(251, 191, 36, 255))
        d.polygon([(52, 28), (32, 18), (32 + flap_angle, 18 - flap_angle), (52 + flap_angle, 28 - flap_angle)], fill=(251, 191, 36, 255))

        frames.append(im)
    save_gif(frames, "packing_box.gif", 70)

# -------------------------------------------------------------
# 8. Arrow Target Bullseye GIF
# -------------------------------------------------------------
def gen_arrow_target():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        t = i / N
        hit_frame = 8
        is_hit = i >= hit_frame

        # Target Board (Center 44, 32)
        cx, cy = 44, 32
        wobble = math.sin((i - hit_frame) * 1.5) * 3 if (is_hit and i < hit_frame + 6) else 0

        # Target rings
        d.ellipse([cx - 18, cy - 18 + wobble, cx + 18, cy + 18 + wobble], fill=(248, 250, 252, 255), outline=(100, 116, 139, 255))
        d.ellipse([cx - 13, cy - 13 + wobble, cx + 13, cy + 13 + wobble], fill=(59, 130, 246, 255))
        d.ellipse([cx - 8, cy - 8 + wobble, cx + 8, cy + 8 + wobble], fill=(239, 68, 68, 255))
        d.ellipse([cx - 4, cy - 4 + wobble, cx + 4, cy + 4 + wobble], fill=(250, 204, 21, 255)) # 10-ring Gold Bullseye

        # Arrow
        if not is_hit:
            # Arrow flying toward target
            ax = 6 + (i / hit_frame) * 38
            ay = 32
            d.line([ax - 16, ay, ax, ay], fill=(148, 163, 184, 255), width=2)
            d.polygon([(ax, ay), (ax - 4, ay - 3), (ax - 4, ay + 3)], fill=(225, 29, 72, 255))
            # Speed trail
            d.line([ax - 24, ay, ax - 16, ay], fill=(226, 232, 240, 160), width=1)
        else:
            # Arrow stuck in bullseye
            d.line([cx - 14, cy + wobble, cx, cy + wobble], fill=(148, 163, 184, 255), width=2)
            # Fletching feathers
            d.line([cx - 14, cy + wobble, cx - 18, cy + wobble - 3], fill=(225, 29, 72, 255), width=2)
            d.line([cx - 14, cy + wobble, cx - 18, cy + wobble + 3], fill=(225, 29, 72, 255), width=2)
            # Bullseye hit sparkles
            if i < hit_frame + 5:
                d.text((cx + 1, cy - 12 + wobble), "✦", fill=(251, 191, 36, 255))
                d.text((cx + 8, cy + 6 + wobble), "★", fill=(239, 68, 68, 255))

        frames.append(im)
    save_gif(frames, "arrow_target.gif", 70)

# -------------------------------------------------------------
# 9. AI Classification Clustering GIF
# -------------------------------------------------------------
def gen_ai_classification():
    frames = []
    N = 24
    np.random.seed(42)
    # 3 clusters of points
    c1 = [(20 + np.random.randn() * 4, 24 + np.random.randn() * 4) for _ in range(6)] # Class Green
    c2 = [(44 + np.random.randn() * 4, 22 + np.random.randn() * 4) for _ in range(6)] # Class Gold
    c3 = [(32 + np.random.randn() * 4, 46 + np.random.randn() * 4) for _ in range(6)] # Class Red

    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Scanning Decision Boundary line
        sweep_x = (i / N) * 64
        d.line([sweep_x, 6, sweep_x, 58], fill=(56, 189, 248, 120), width=2)

        # Draw Points (Grey before sweep, classified color after sweep)
        for pt in c1:
            color = (34, 197, 94, 255) if pt[0] <= sweep_x else (148, 163, 184, 200)
            d.ellipse([pt[0] - 3, pt[1] - 3, pt[0] + 3, pt[1] + 3], fill=color)

        for pt in c2:
            color = (245, 158, 11, 255) if pt[0] <= sweep_x else (148, 163, 184, 200)
            d.ellipse([pt[0] - 3, pt[1] - 3, pt[0] + 3, pt[1] + 3], fill=color)

        for pt in c3:
            color = (239, 68, 68, 255) if pt[0] <= sweep_x else (148, 163, 184, 200)
            d.ellipse([pt[0] - 3, pt[1] - 3, pt[0] + 3, pt[1] + 3], fill=color)

        # Cluster boundary hulls (when classified)
        if sweep_x > 30:
            d.ellipse([12, 16, 28, 32], outline=(34, 197, 94, 100), width=1)
        if sweep_x > 45:
            d.ellipse([36, 14, 52, 30], outline=(245, 158, 11, 100), width=1)
            d.ellipse([24, 38, 40, 54], outline=(239, 68, 68, 100), width=1)

        frames.append(im)
    save_gif(frames, "ai_classification.gif", 75)

# -------------------------------------------------------------
# 10. Water Droplet Ripple GIF (Decision Engines)
# -------------------------------------------------------------
def gen_water_droplet():
    frames = []
    N = 24
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        t = i / N
        impact_t = 0.35

        # Water surface base line
        d.line([8, 44, 56, 44], fill=(14, 165, 233, 160), width=2)

        if t < impact_t:
            # Falling droplet
            dy = 10 + (t / impact_t) * 34
            d.chord([30, dy - 8, 34, dy], 180, 360, fill=(56, 189, 248, 255))
            d.pieslice([30, dy - 4, 34, dy + 2], 0, 180, fill=(14, 165, 233, 255))
        else:
            # Bouncing bead & expanding ripples
            rip_t = (t - impact_t) / (1.0 - impact_t)

            # Expanding concentric ripples
            for r_idx in range(3):
                r_phase = max(0, rip_t - r_idx * 0.2)
                if r_phase > 0:
                    rw = r_phase * 22
                    rh = rw * 0.4
                    alpha = int(255 * (1.0 - r_phase))
                    d.ellipse([32 - rw, 44 - rh, 32 + rw, 44 + rh], outline=(56, 189, 248, alpha), width=1)

            # Slow-motion bounce bead
            bead_y = 44 - math.sin(rip_t * math.pi) * 8
            if rip_t < 0.6:
                d.ellipse([30.5, bead_y - 2, 33.5, bead_y + 2], fill=(186, 230, 253, 255))

        frames.append(im)
    save_gif(frames, "water_droplet.gif", 70)

# -------------------------------------------------------------
# 11. Radar Satellite Inciding Earth GIF
# -------------------------------------------------------------
def gen_radar_satellite():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Curved Earth horizon
        d.pieslice([4, 44, 60, 84], 180, 360, fill=(34, 197, 94, 255), outline=(22, 163, 74, 255))

        # Satellite at top left
        sx, sy = 20, 14
        d.rectangle([sx - 4, sy - 3, sx + 4, sy + 3], fill=(226, 232, 240, 255), outline=(71, 85, 105, 255))
        d.rectangle([sx - 10, sy - 2, sx - 4, sy + 2], fill=(245, 158, 11, 255)) # Solar panel
        d.rectangle([sx + 4, sy - 2, sx + 10, sy + 2], fill=(245, 158, 11, 255))

        # Radar Wave Arcs traveling toward Earth
        for arc_i in range(3):
            phase = ((i / N) + arc_i * 0.33) % 1.0
            arc_r = phase * 34
            if arc_r > 4:
                alpha = int(255 * (1.0 - phase * 0.7))
                d.arc([sx - arc_r, sy - arc_r, sx + arc_r, sy + arc_r], 40, 95, fill=(6, 182, 212, alpha), width=2)

        # Backscatter reflection on ground
        pulse = abs(math.sin((i / N) * math.pi * 2))
        d.ellipse([30, 44, 42, 48], outline=(250, 204, 21, int(255 * pulse)), width=1)

        frames.append(im)
    save_gif(frames, "radar_satellite.gif", 70)

# -------------------------------------------------------------
# 12. Tractor Pulling Plow GIF (How it Works)
# -------------------------------------------------------------
def gen_tractor_pulling():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        rot = (i / N) * math.pi * 2
        ground_y = 52

        # Ground / Soil layer
        d.rectangle([4, ground_y, 68, 62], fill=(120, 53, 15, 255))
        # Tilled furrows wave
        fx = (i % 5) * 2
        d.line([4, ground_y + 2, 68, ground_y + 2], fill=(146, 64, 14, 255), width=2)

        # Tractor body (facing right)
        tx = 38
        # Green chassis
        d.polygon([(tx - 6, ground_y - 12), (tx + 14, ground_y - 12), (tx + 14, ground_y - 6), (tx - 6, ground_y - 6)], fill=(34, 197, 94, 255))
        # Cab
        d.polygon([(tx - 6, ground_y - 24), (tx + 4, ground_y - 24), (tx + 4, ground_y - 12), (tx - 6, ground_y - 12)], fill=(226, 232, 240, 255), outline=(22, 163, 74, 255))
        # Exhaust pipe puffing
        d.line([tx + 10, ground_y - 12, tx + 10, ground_y - 26], fill=(51, 65, 85, 255), width=2)
        puff = (i % 4) * 2
        d.ellipse([tx + 9 - puff, ground_y - 28 - puff, tx + 13 + puff, ground_y - 24 - puff], fill=(203, 213, 225, 180))

        # Big Rear Wheel (yellow hub, rotating spokes)
        rx, ry = tx - 4, ground_y - 6
        d.ellipse([rx - 9, ry - 9, rx + 9, ry + 9], fill=(30, 41, 59, 255), outline=(250, 204, 21, 255), width=2)
        d.line([rx - 6 * math.cos(rot), ry - 6 * math.sin(rot), rx + 6 * math.cos(rot), ry + 6 * math.sin(rot)], fill=(250, 204, 21, 255), width=2)

        # Small Front Wheel
        fx_w, fy_w = tx + 14, ground_y - 4
        d.ellipse([fx_w - 5, fy_w - 5, fx_w + 5, fy_w + 5], fill=(30, 41, 59, 255), outline=(250, 204, 21, 255), width=1)

        # Hitch & Pulled Plow / Cultivator behind tractor
        d.line([rx - 8, ground_y - 6, rx - 18, ground_y - 2], fill=(71, 85, 105, 255), width=2)
        d.polygon([(rx - 22, ground_y - 8), (rx - 16, ground_y - 8), (rx - 18, ground_y + 1)], fill=(148, 163, 184, 255)) # Plow share digging

        frames.append(im)
    save_gif(frames, "tractor_pulling.gif", 70)

# -------------------------------------------------------------
# 13. Dual-Engine 2D + 3D Map Architecture GIF
# -------------------------------------------------------------
def gen_dual_engine_2d_3d():
    frames = []
    N = 24
    for i in range(N):
        im = Image.new('RGBA', (72, 72), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        t = i / N
        morph = math.sin(t * math.pi * 2) * 0.5 + 0.5 # 0 (2D) to 1 (3D)

        # 2D Flat Map Layer (Left/bottom)
        d.polygon([(14, 38), (34, 26), (54, 38), (34, 50)], fill=(22, 163, 74, 200), outline=(255, 255, 255, 255))
        d.line([(24, 32), (44, 44)], fill=(14, 165, 233, 255), width=2) # 2D river line

        # 3D Extrusion Elevation Mesh (Tilted up)
        h = morph * 16
        d.polygon([(14, 38 - h), (34, 26 - h * 1.4), (54, 38 - h), (34, 50 - h)], fill=(16, 185, 129, 240), outline=(56, 189, 248, 255))
        # Elevation contour peaks
        d.polygon([(26, 32 - h * 1.2), (34, 22 - h * 1.5), (42, 32 - h * 1.2)], fill=(245, 158, 11, 240))

        # Vertical connector rays
        d.line([(14, 38), (14, 38 - h)], fill=(56, 189, 248, 160), width=1)
        d.line([(54, 38), (54, 38 - h)], fill=(56, 189, 248, 160), width=1)
        d.line([(34, 50), (34, 50 - h)], fill=(56, 189, 248, 160), width=1)

        # 2D & 3D text pills
        d.text((10, 54), "2D", fill=(34, 197, 94, 255))
        d.text((50, 12), "3D", fill=(56, 189, 248, 255))

        frames.append(im)
    save_gif(frames, "dual_engine_2d_3d.gif", 75)

# -------------------------------------------------------------
# 14. Turning Pages Book GIF (Contents)
# -------------------------------------------------------------
def gen_turning_pages():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Book Spine & Left Page (static open book)
        d.polygon([(32, 48), (32, 22), (12, 24), (12, 50)], fill=(241, 245, 249, 255), outline=(148, 163, 184, 255))
        # Right Page (static base)
        d.polygon([(32, 48), (32, 22), (52, 24), (52, 50)], fill=(226, 232, 240, 255), outline=(148, 163, 184, 255))

        # Turning page curl from right (52) to left (12)
        turn_t = i / N
        # Angle from 0 (flat right) to pi (flat left)
        angle = turn_t * math.pi
        px = 32 + math.cos(angle) * 20
        py = 23 + math.sin(angle) * 4 # arc lift

        d.polygon([(32, 48), (32, 22), (px, py), (px, py + 26)], fill=(255, 255, 255, 255), outline=(71, 85, 105, 255))
        # Text line marks on turning page
        d.line([32 + (px - 32) * 0.3, 30, 32 + (px - 32) * 0.7, 30], fill=(148, 163, 184, 200), width=1)
        d.line([32 + (px - 32) * 0.3, 36, 32 + (px - 32) * 0.7, 36], fill=(148, 163, 184, 200), width=1)

        frames.append(im)
    save_gif(frames, "turning_pages.gif", 70)

# -------------------------------------------------------------
# 15. Where is What Quick Tour Icon GIF
# -------------------------------------------------------------
def gen_quick_tour_icon():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        # Folded Map background
        d.polygon([(14, 20), (26, 16), (26, 48), (14, 52)], fill=(226, 232, 240, 255), outline=(148, 163, 184, 255))
        d.polygon([(26, 16), (38, 20), (38, 52), (26, 48)], fill=(241, 245, 249, 255), outline=(148, 163, 184, 255))
        d.polygon([(38, 20), (50, 16), (50, 48), (38, 52)], fill=(226, 232, 240, 255), outline=(148, 163, 184, 255))

        # Tour Route line
        d.line([(18, 36), (32, 30), (44, 40)], fill=(239, 68, 68, 200), width=2)

        # Moving Magnifying Glass / Tour Pin
        t = i / N
        mx = 32 + math.cos(t * math.pi * 2) * 10
        my = 32 + math.sin(t * math.pi * 2) * 6

        # Magnifying glass lens
        d.ellipse([mx - 8, my - 8, mx + 8, my + 8], outline=(16, 185, 129, 255), width=2)
        d.ellipse([mx - 6, my - 6, mx + 6, my + 6], fill=(56, 189, 248, 70))
        # Handle
        d.line([mx + 6, my + 6, mx + 12, my + 12], fill=(16, 185, 129, 255), width=3)

        frames.append(im)
    save_gif(frames, "quick_tour_icon.gif", 70)

# -------------------------------------------------------------
# 16. Flickering Video Reel GIF (Walkthrough)
# -------------------------------------------------------------
def gen_flickering_video():
    frames = []
    N = 20
    for i in range(N):
        im = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)

        rot = (i / N) * math.pi * 2
        flicker = 0.7 + 0.3 * (math.sin(i * 3.7) ** 2)

        # Projector Body
        d.rounded_rectangle([18, 28, 44, 46], radius=3, fill=(30, 41, 59, 255), outline=(71, 85, 105, 255))

        # Spinning Film Reels on top
        # Left reel
        d.ellipse([14, 14, 28, 28], outline=(203, 213, 225, 255), width=2)
        d.line([21 - 5 * math.cos(rot), 21 - 5 * math.sin(rot), 21 + 5 * math.cos(rot), 21 + 5 * math.sin(rot)], fill=(250, 204, 21, 255), width=1)
        # Right reel
        d.ellipse([34, 14, 48, 28], outline=(203, 213, 225, 255), width=2)
        d.line([41 - 5 * math.cos(rot), 41 - 5 * math.sin(rot), 41 + 5 * math.cos(rot), 41 + 5 * math.sin(rot)], fill=(250, 204, 21, 255), width=1)

        # Lens
        d.polygon([(44, 33), (48, 31), (48, 43), (44, 41)], fill=(148, 163, 184, 255))

        # Flickering Projection Light Cone
        alpha = int(120 * flicker)
        d.polygon([(48, 37), (62, 24), (62, 50)], fill=(254, 240, 138, alpha))

        frames.append(im)
    save_gif(frames, "flickering_video.gif", 70)

def main():
    print("🎨 Generating all 16 requested README GIFs...")
    gen_clapping_hands()
    gen_author_waving()
    gen_heart_butterfly()
    gen_warning_triangle()
    gen_antenna_hologram()
    gen_satellite_earth_scan()
    gen_packing_box()
    gen_arrow_target()
    gen_ai_classification()
    gen_water_droplet()
    gen_radar_satellite()
    gen_tractor_pulling()
    gen_dual_engine_2d_3d()
    gen_turning_pages()
    gen_quick_tour_icon()
    gen_flickering_video()
    print("✅ All 16 GIFs generated and saved to docs/readme_icons/ and public/docs/readme_icons/!")

if __name__ == "__main__":
    main()
