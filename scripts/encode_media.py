import os
import sys
import subprocess
import shutil

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

FFMPEG = r"C:\Users\Akshit Vinay\AppData\Roaming\Python\Python314\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
FRAMES_DIR = r"c:\Users\Akshit Vinay\Desktop\seva gis\scratch\frames_portal"
DOCS_DIR = r"c:\Users\Akshit Vinay\Desktop\seva gis\docs"
PUBLIC_DOCS_DIR = r"c:\Users\Akshit Vinay\Desktop\seva gis\public\docs"

os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(PUBLIC_DOCS_DIR, exist_ok=True)

def run_cmd(cmd, desc):
    print(f">> {desc}...")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"ERROR during {desc}:")
        print(res.stderr[-1000:])
        sys.exit(1)
    print(f"Finished: {desc}")

def main():
    frame_files = [f for f in os.listdir(FRAMES_DIR) if f.endswith(".jpg")]
    frame_files.sort()
    count = len(frame_files)
    print(f"Found {count} frames in {FRAMES_DIR}")
    if count == 0:
        print("No frames found!")
        sys.exit(1)

    # 1. Generate MP4 Walkthrough
    mp4_out = os.path.join(DOCS_DIR, "seva_gis_portal_walkthrough.mp4")
    cmd_mp4 = [
        FFMPEG, "-y",
        "-framerate", "24",
        "-i", os.path.join(FRAMES_DIR, "frame_%05d.jpg"),
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        mp4_out
    ]
    run_cmd(cmd_mp4, "Encoding seva_gis_portal_walkthrough.mp4")

    # 2. Generate Figma-style Tutorial GIF (where_is_what_tour.gif)
    # Using high-quality 2-pass palette generation
    gif_out = os.path.join(DOCS_DIR, "where_is_what_tour.gif")
    palette_png = os.path.join(FRAMES_DIR, "palette.png")
    
    # Pass 1: Palettegen
    cmd_pal = [
        FFMPEG, "-y",
        "-framerate", "16",
        "-i", os.path.join(FRAMES_DIR, "frame_%05d.jpg"),
        "-vf", "fps=14,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff",
        palette_png
    ]
    run_cmd(cmd_pal, "Generating color palette for GIF")

    # Pass 2: Paletteuse
    cmd_gif = [
        FFMPEG, "-y",
        "-framerate", "16",
        "-i", os.path.join(FRAMES_DIR, "frame_%05d.jpg"),
        "-i", palette_png,
        "-lavfi", "fps=14,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3",
        gif_out
    ]
    run_cmd(cmd_gif, "Encoding where_is_what_tour.gif")

    # 3. Also update walkthrough_satellite_data.gif
    walkthrough_gif = os.path.join(DOCS_DIR, "walkthrough_satellite_data.gif")
    shutil.copy2(gif_out, walkthrough_gif)
    print(f"Copied to {walkthrough_gif}")

    # 4. Copy to public/docs for live web hosting
    for fname in ["seva_gis_portal_walkthrough.mp4", "where_is_what_tour.gif", "walkthrough_satellite_data.gif"]:
        src = os.path.join(DOCS_DIR, fname)
        dst = os.path.join(PUBLIC_DOCS_DIR, fname)
        shutil.copy2(src, dst)
        print(f"Copied {fname} to public/docs/")

    # File size report
    for fname in ["seva_gis_portal_walkthrough.mp4", "where_is_what_tour.gif", "walkthrough_satellite_data.gif"]:
        p = os.path.join(DOCS_DIR, fname)
        sz_mb = os.path.getsize(p) / (1024 * 1024)
        print(f"File size of {fname}: {sz_mb:.2f} MB")

if __name__ == "__main__":
    main()
