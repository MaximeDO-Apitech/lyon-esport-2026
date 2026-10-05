from __future__ import annotations

import math
import os
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, r"C:\tmp\les_video_deps")
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).parent
OUT = ROOT / "Assets Scène" / "Écran d'attente"
OUT.mkdir(parents=True, exist_ok=True)
TMP = Path(r"C:\tmp\les_waiting_loop")
TMP.mkdir(parents=True, exist_ok=True)

W, H, FPS, DURATION = 1664, 1024, 30, 12
FRAMES = FPS * DURATION

BLACK = (1, 10, 20)
WHITE = (250, 251, 251)
CYAN = (1, 247, 253)
ORANGE = (239, 123, 40)
SOLAR = (252, 199, 102)


def extract_font(zip_name: str, member: str, target: Path) -> Path:
    if not target.exists():
        source = ROOT / "DA 2026" / "DA 2026" / "GIIGZ - Guillaume" / "FONT" / zip_name
        with zipfile.ZipFile(source) as archive:
            target.write_bytes(archive.read(member))
    return target


EURO = extract_font("eurostile-extended.zip", "EurostileExtendedBlack.ttf", TMP / "EurostileExtendedBlack.ttf")
GOTHAM = extract_font("gotham.zip", "Gotham/Gotham Medium/Gotham Medium.otf", TMP / "GothamMedium.otf")


def fit_font(path: Path, text: str, width: int, start: int) -> ImageFont.FreeTypeFont:
    size = start
    while size > 8:
        font = ImageFont.truetype(str(path), size)
        if ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=font)[2] <= width:
            return font
        size -= 2
    return ImageFont.truetype(str(path), 8)


title_font = fit_font(EURO, "LE LIVE COMMENCE BIENTÔT", 1240, 94)
label_font = ImageFont.truetype(str(GOTHAM), 28)
placeholder_font = ImageFont.truetype(str(EURO), 104)


def alpha_line(draw: ImageDraw.ImageDraw, points, color, width, alpha=255):
    draw.line(points, fill=(*color, alpha), width=width, joint="curve")


def frame_at(t: float, placeholder: bool) -> Image.Image:
    # Deep navy field with a restrained moving cyan light haze.
    img = Image.new("RGB", (W, H), BLACK)
    haze = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hp = haze.load()
    cx = W * (0.24 + 0.10 * math.sin(t * math.tau / 12))
    cy = H * (0.70 + 0.07 * math.cos(t * math.tau / 9))
    for y in range(0, H, 4):
        for x in range(0, W, 4):
            d = math.hypot((x - cx) / 1.1, (y - cy) * 1.3)
            a = max(0, int(20 * (1 - d / 720)))
            if a:
                hp[x, y] = (*CYAN, a)
    haze = haze.resize((W, H), Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(42))
    img = Image.alpha_composite(img.convert("RGBA"), haze)

    # Two flowing bands are original composition elements, matching the approved palette.
    bands = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(bands)
    for index, (base_y, color, amp, speed, thickness) in enumerate([
        (156, CYAN, 44, 0.52, 9), (210, ORANGE, 38, 0.41, 7),
        (850, ORANGE, 54, 0.49, 10), (912, CYAN, 38, 0.56, 7),
    ]):
        points = []
        for x in range(-80, W + 81, 12):
            y = base_y + amp * math.sin(x / 225 + t * speed + index * 1.3) + 14 * math.sin(x / 73 - t * 0.8)
            points.append((x, int(y)))
        alpha_line(d, points, color, thickness + 18, 25)
        alpha_line(d, points, color, thickness, 210)
        alpha_line(d, points, WHITE, 2, 170)
    bands = bands.filter(ImageFilter.GaussianBlur(0.35))
    img = Image.alpha_composite(img, bands)

    decor = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(decor)
    # Orbiting dots and diamond markers deliberately avoid the live-copy safe area.
    for i in range(20):
        phase = t * (0.35 + (i % 3) * 0.04) + i * 1.77
        side = -1 if i % 2 else 1
        x = W / 2 + side * (650 + 80 * math.sin(phase * 0.7))
        y = H / 2 + 400 * math.sin(phase) + 72 * math.cos(phase * 1.7)
        size = 7 + (i % 3) * 3
        col = CYAN if i % 2 else ORANGE
        if i % 3 == 0:
            d.polygon([(x, y - size), (x + size, y), (x, y + size), (x - size, y)], outline=(*col, 225), width=3)
        else:
            d.ellipse((x - size, y - size, x + size, y + size), fill=(*col, 220))
    img = Image.alpha_composite(img, decor.filter(ImageFilter.GaussianBlur(0.18)))

    # The central panel is deliberately steady, giving vMix a reliable chroma-free countdown target.
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(panel)
    bx0, by0, bx1, by1 = 426, 370, 1238, 742
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=24, fill=(1, 10, 20, 205), outline=(*CYAN, 210), width=3)
    d.line((bx0 + 38, by0 + 38, bx1 - 38, by0 + 38), fill=(*ORANGE, 205), width=3)
    title = "LE LIVE COMMENCE BIENTÔT"
    title_box = d.textbbox((0, 0), title, font=title_font)
    d.text(((W - (title_box[2] - title_box[0])) / 2, 417), title, font=title_font, fill=WHITE)
    label = "COMPTE À REBOURS"
    lb = d.textbbox((0, 0), label, font=label_font)
    d.text(((W - (lb[2] - lb[0])) / 2, 555), label, font=label_font, fill=SOLAR)
    # Explicit 540x108 protected space for a vMix countdown overlay.
    slot = (562, 600, 1102, 708)
    d.rounded_rectangle(slot, radius=12, fill=(1, 10, 20, 235), outline=(*WHITE, 135), width=2)
    if placeholder:
        value = "HH:MM:SS"
        vb = d.textbbox((0, 0), value, font=placeholder_font)
        d.text(((W - (vb[2] - vb[0])) / 2, 598), value, font=placeholder_font, fill=(*WHITE, 95))
    img = Image.alpha_composite(img, panel)
    return img.convert("RGB")


def encode(destination: Path, placeholder: bool) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [
        ffmpeg, "-y", "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{W}x{H}",
        "-pix_fmt", "rgb24", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(destination),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for number in range(FRAMES):
            process.stdin.write(frame_at(number / FPS, placeholder).tobytes())
        process.stdin.close()
        stderr = process.stderr.read()
        process.wait()
    finally:
        if process.stdin and not process.stdin.closed:
            process.stdin.close()
    if process.returncode:
        raise RuntimeError(stderr.decode("utf-8", errors="replace"))


if __name__ == "__main__":
    encode(OUT / "LES2026_attente_compteur-vmix.mp4", placeholder=False)
    encode(OUT / "LES2026_attente_apercu-compteur.mp4", placeholder=True)
    frame_at(0, False).save(OUT / "LES2026_attente_compteur-vmix-preview.png")
