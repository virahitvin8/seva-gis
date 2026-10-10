import math
import random
from PIL import Image, ImageDraw, ImageFilter

def create_star_explosion_gif(out_path="docs/star_explosion.gif", num_frames=48, size=400):
    # Set random seed for reproducible, elegant distribution
    random.seed(42)
    
    # 28 baby stars with initial directions, speeds, sizes, and wind trajectories
    baby_stars = []
    num_baby = 28
    for i in range(num_baby):
        angle = (i / num_baby) * 2 * math.pi + random.uniform(-0.15, 0.15)
        speed = random.uniform(2.5, 6.2)
        baby_stars.append({
            'angle': angle,
            'speed': speed,
            'vx': math.cos(angle) * speed,
            'vy': math.sin(angle) * speed,
            'size': random.uniform(2.2, 5.0),
            'twinkle_phase': random.uniform(0, math.pi * 2),
            'flutter': random.uniform(0.8, 1.8),
            'gold_shade': random.choice([
                (255, 230, 110), # Bright golden yellow
                (255, 215, 0),   # Pure gold
                (255, 245, 170), # Pale radiant gold
                (245, 180, 50),  # Warm amber gold
                (255, 255, 220), # Diamond gold-white
            ]),
            'trail': []
        })

    frames = []
    cx, cy = size / 2.0, size / 2.0

    # Phases (48 frames total, ~20fps, ~2.4s loop):
    # Frames 0..14 : Central star grows, throbs, pulses and becomes blindingly bright
    # Frame 15     : Explosion peak shockwave & flash
    # Frames 16..42: 28 baby stars burst out, fly on swirling wind currents, twinkle and shimmer
    # Frames 43..47: Gentle fade & rebirth loop transition

    for f in range(num_frames):
        # High-res canvas for anti-aliasing, downsampled later
        scale = 2
        W = size * scale
        H = size * scale
        MCX = cx * scale
        MCY = cy * scale

        img = Image.new("RGBA", (W, H), (6, 12, 18, 255))
        draw = ImageDraw.Draw(img)

        # Subtle cosmic background dust / nebulae
        for neb_r, alpha in [(W * 0.45, 12), (W * 0.3, 18), (W * 0.18, 25)]:
            draw.ellipse([MCX - neb_r, MCY - neb_r, MCX + neb_r, MCY + neb_r],
                         fill=(18, 48, 56, alpha))

        # Helper to draw a glowing 4-point or 8-point star
        def draw_star(d, x, y, r, color, points=4, core_color=(255, 255, 255)):
            pts = []
            outer_r = r
            inner_r = r * 0.22
            step = math.pi / points
            for idx in range(points * 2):
                curr_r = outer_r if idx % 2 == 0 else inner_r
                ang = idx * step - math.pi / 2
                pts.append((x + math.cos(ang) * curr_r, y + math.sin(ang) * curr_r))
            d.polygon(pts, fill=color)
            if inner_r > 1.0:
                core_r = inner_r * 0.85
                d.ellipse([x - core_r, y - core_r, x + core_r, y + core_r], fill=core_color)

        # Helper to draw soft halo glow
        def draw_glow(d, x, y, radius, color_rgba):
            r, g, b, a = color_rgba
            for step in range(5, 0, -1):
                cur_r = radius * (step / 5.0)
                cur_a = int(a * (1.0 - (step / 6.0)))
                d.ellipse([x - cur_r, y - cur_r, x + cur_r, y + cur_r], fill=(r, g, b, cur_a))

        if f <= 15:
            # PHASE 1: Central star intensifies, throbs and reaches climax
            progress = f / 15.0
            pulse = math.sin(progress * math.pi * 3) * 0.15
            star_radius = (14 + progress * 42 + pulse * 15) * scale

            # Growing soft golden aura
            aura_radius = star_radius * 2.6
            draw_glow(draw, MCX, MCY, aura_radius, (255, 215, 60, int(60 + progress * 160)))

            # Intense radial light rays (spikes) expanding
            num_spikes = 8
            for s_idx in range(num_spikes):
                s_ang = (s_idx / num_spikes) * math.pi * 2 + progress * 0.4
                ray_len = (star_radius * 1.8 + math.sin(progress * 10 + s_idx) * 20 * scale)
                rx = MCX + math.cos(s_ang) * ray_len
                ry = MCY + math.sin(s_ang) * ray_len
                draw.line([(MCX, MCY), (rx, ry)], fill=(255, 245, 180, int(80 + progress * 150)), width=int(2.5 * scale))

            # Main central star
            star_col = (255, int(220 + 35 * progress), int(100 + 155 * progress))
            draw_star(draw, MCX, MCY, star_radius, star_col, points=4, core_color=(255, 255, 255))
            draw_star(draw, MCX, MCY, star_radius * 0.65, (255, 255, 240), points=8, core_color=(255, 255, 255))

        if f >= 15:
            # PHASE 2: Explosion shockwave & 28+ baby stars flying away in the air
            post_f = f - 15
            blast_progress = post_f / (num_frames - 15)

            # Expanding golden shockwave ring
            if post_f <= 16:
                ring_r = (post_f * 22 * scale)
                ring_alpha = max(0, int(240 * (1.0 - post_f / 16.0)))
                if ring_r > 0:
                    draw.ellipse([MCX - ring_r, MCY - ring_r, MCX + ring_r, MCY + ring_r],
                                 outline=(255, 235, 140, ring_alpha), width=int(3.5 * scale))
                # Secondary faint inner ring
                inner_ring_r = ring_r * 0.65
                draw.ellipse([MCX - inner_ring_r, MCY - inner_ring_r, MCX + inner_ring_r, MCY + inner_ring_r],
                             outline=(255, 255, 220, int(ring_alpha * 0.7)), width=int(2 * scale))

            # Core residue fading & rebirthing
            core_alpha = max(0, int(255 * (1.0 - blast_progress * 1.8)))
            if core_alpha > 0:
                draw_glow(draw, MCX, MCY, 25 * scale * (1.0 - blast_progress), (255, 240, 180, core_alpha))

            # Air/wind dynamics: gentle upward and rightward breeze (cosmic wind)
            wind_x = blast_progress * 45 * scale
            wind_y = -blast_progress * 25 * scale

            # Draw all 28 baby stars
            for b_idx, b in enumerate(baby_stars):
                # Distance along initial blast vector with wind drift
                dist = b['speed'] * post_f * scale * 2.8
                # Add wind swirl / fluttering turbulence
                flutter_x = math.sin(post_f * 0.25 * b['flutter'] + b['angle']) * (6 * scale)
                flutter_y = math.cos(post_f * 0.2 * b['flutter'] + b['twinkle_phase']) * (4 * scale)

                bx = MCX + math.cos(b['angle']) * dist + wind_x + flutter_x
                by = MCY + math.sin(b['angle']) * dist + wind_y + flutter_y

                # Fade out near end of loop
                alpha_factor = 1.0
                if post_f > 22:
                    alpha_factor = max(0.0, 1.0 - (post_f - 22) / 11.0)

                if alpha_factor <= 0:
                    continue

                # Twinkle / shimmer pulsation
                twinkle = 0.7 + 0.35 * math.sin(post_f * 0.6 + b['twinkle_phase'])
                cur_size = b['size'] * scale * twinkle

                # Golden glow behind each baby star
                draw_glow(draw, bx, by, cur_size * 2.2,
                          (b['gold_shade'][0], b['gold_shade'][1], b['gold_shade'][2], int(90 * alpha_factor)))

                # Draw sparkling baby star
                num_points = 4 if b_idx % 3 != 0 else 6
                cur_col = (
                    b['gold_shade'][0],
                    b['gold_shade'][1],
                    b['gold_shade'][2]
                )
                draw_star(draw, bx, by, cur_size, cur_col, points=num_points, core_color=(255, 255, 255))

                # Tiny glittering sparkles trailing behind baby star
                if post_f > 2:
                    trail_len = 3
                    for tr in range(1, trail_len + 1):
                        t_ratio = tr / float(trail_len + 1)
                        trx = bx - math.cos(b['angle']) * (tr * 6 * scale) - (wind_x * 0.15 * tr)
                        try_ = by - math.sin(b['angle']) * (tr * 6 * scale) - (wind_y * 0.15 * tr)
                        tr_alpha = int(70 * alpha_factor * (1.0 - t_ratio))
                        draw.ellipse([trx - 1.2 * scale, try_ - 1.2 * scale, trx + 1.2 * scale, try_ + 1.2 * scale],
                                     fill=(255, 235, 120, tr_alpha))

        # Re-sample down to target size for smooth subpixel anti-aliasing
        frame_img = img.resize((size, size), Image.Resampling.LANCZOS)
        # Convert to RGB with optimal palette for high-fidelity GIF
        frames.append(frame_img.convert("RGB"))

    # Save animated GIF
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=55, # 55ms per frame (~18.2 fps)
        loop=0,
        optimize=True
    )
    print(f"Successfully generated {out_path} ({len(frames)} frames)")

if __name__ == "__main__":
    import os
    os.makedirs("docs", exist_ok=True)
    os.makedirs("public/docs", exist_ok=True)
    create_star_explosion_gif("docs/star_explosion.gif")
    import shutil
    shutil.copyfile("docs/star_explosion.gif", "public/docs/star_explosion.gif")
    print("Copied to public/docs/star_explosion.gif")
