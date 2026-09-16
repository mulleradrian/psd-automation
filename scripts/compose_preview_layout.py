"""
Fix Preview-matched layout:
- Brand-correct 10 (dot top-left of bar, thick strokes, Preview-scale geometry)
- Large left-aligned Poppins-Medium type locked to the 1 bar
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
W, H = 1080, 1350
OUT = ROOT / "fixtures/layout-library/p10_ig_4x5"
PLATES = ROOT / "fixtures/layout-library/plates"
ASSETS = ROOT / "fixtures/layout-library/assets"
LIME = (182, 242, 92, 255)

# Preview-scale brand 10 — thinner strokes like plate, brand dot SEPARATE top-left
BAR_W = 42
BAR_H = 656
BAR_LEFT = 235
BAR_TOP = 82
ZERO_R = 318
ZERO_STROKE = 34
ZERO_CX = BAR_LEFT + BAR_W + 62 + ZERO_R
ZERO_CY = BAR_TOP + BAR_H // 2
# Brand mark: detached rounded square left of bar top (gap so it never melds into the 1)
DOT_S = 28
DOT_LEFT = BAR_LEFT - 48
DOT_TOP = BAR_TOP - 6

FONT_SIZE = 120
FONT_PATH = Path(r"C:\Windows\Fonts\Poppins-Medium.ttf")
FONT_PS = "Poppins-Medium"
LINE1_Y = 990
LINE2_Y = 1135
TEXT_LEFT = BAR_LEFT  # lock to the 1


def font(size: int = FONT_SIZE) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def make_ten() -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Brand dot — detached circle top-left of the 1 (never overlapping the bar)
    d.ellipse(
        [DOT_LEFT, DOT_TOP, DOT_LEFT + DOT_S, DOT_TOP + DOT_S],
        fill=(255, 255, 255, 255),
    )

    # Solid 1
    d.rounded_rectangle(
        [BAR_LEFT, BAR_TOP, BAR_LEFT + BAR_W, BAR_TOP + BAR_H],
        radius=BAR_W // 2,
        fill=(255, 255, 255, 255),
    )

    # Solid 0 ring via outer/inner ellipse
    ring = Image.new("L", (W, H), 0)
    rd = ImageDraw.Draw(ring)
    rd.ellipse(
        [ZERO_CX - ZERO_R, ZERO_CY - ZERO_R, ZERO_CX + ZERO_R, ZERO_CY + ZERO_R],
        fill=255,
    )
    inner = ZERO_R - ZERO_STROKE
    rd.ellipse(
        [ZERO_CX - inner, ZERO_CY - inner, ZERO_CX + inner, ZERO_CY + inner],
        fill=0,
    )
    ring = ring.filter(ImageFilter.GaussianBlur(0.4))
    layer = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    layer.putalpha(ring)
    img = Image.alpha_composite(img, layer)

    # Keep stroke fully opaque — no soft-depth fade (was making bottoms look clipped)
    ASSETS.mkdir(parents=True, exist_ok=True)
    out = img
    out.save(ASSETS / "ten_white.png")
    preview = Image.new("RGB", (W, H), (0, 0, 0))
    preview.paste(out, (0, 0), out)
    preview.save(ROOT / "fixtures/layouts/ten_brand_preview.jpg", quality=95)
    return out


def make_type_overlay(line1: str, line2: str) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font()
    x = TEXT_LEFT
    d.text((x, LINE1_Y), line1, font=f, fill=(255, 255, 255, 255))
    d.text((x, LINE2_Y), line2, font=f, fill=(255, 255, 255, 255))

    b1 = d.textbbox((x, LINE1_Y), line1, font=f)
    b2 = d.textbbox((x, LINE2_Y), line2, font=f)

    r = 12
    dx = x - 42
    dy = LINE1_Y + (b1[3] - b1[1]) // 2 - r
    d.ellipse([dx, dy, dx + 2 * r, dy + 2 * r], fill=LIME)

    ry = b2[3] + 18
    d.rectangle([x, ry, W - 48, ry + 6], fill=LIME)
    return img


def fit_cover(im: Image.Image) -> Image.Image:
    scale = max(W / im.width, H / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    return im.crop((left, top, left + W, top + H))


def compose(bg: Image.Image, ten: Image.Image, type_ov: Image.Image) -> Image.Image:
    base = fit_cover(bg.convert("RGB")).convert("RGBA")
    return Image.alpha_composite(Image.alpha_composite(base, ten), type_ov).convert("RGB")


def main() -> None:
    ten = make_ten()
    type_ov = make_type_overlay("Unlock the peace", "you deserve")
    type_ov.save(ASSETS / "type_overlay_baseline.png")

    tarr = np.array(ten)
    ys, xs = np.where(tarr[:, :, 3] > 10)
    oarr = np.array(type_ov)
    oys, oxs = np.where(oarr[:, :, 3] > 10)
    origins = {
        "ten_left": int(xs.min()),
        "ten_top": int(ys.min()),
        "type_left": int(oxs.min()),
        "type_top": int(oys.min()),
        "font_size": FONT_SIZE,
        "font_ps": FONT_PS,
    }
    (ROOT / "fixtures/layouts/overlay_origins.json").write_text(json.dumps(origins, indent=2))
    (ROOT / "fixtures/layouts/preview_metrics.json").write_text(
        json.dumps(
            {
                "font": FONT_PS,
                "font_file": str(FONT_PATH),
                "font_ps": FONT_PS,
                "font_size": FONT_SIZE,
                "text_left": TEXT_LEFT,
                "line1_y": LINE1_Y,
                "line2_y": LINE2_Y,
                "bar": [BAR_LEFT, BAR_TOP, BAR_LEFT + BAR_W, BAR_TOP + BAR_H],
                "dot": [DOT_LEFT, DOT_TOP, DOT_LEFT + DOT_S, DOT_TOP + DOT_S],
                "zero": {
                    "cx": ZERO_CX,
                    "cy": ZERO_CY,
                    "r": ZERO_R,
                    "stroke": ZERO_STROKE,
                },
                "accent": "B6F25C",
            },
            indent=2,
        )
    )

    OUT.mkdir(parents=True, exist_ok=True)
    variants = [
        ("Q1_W1_01_baseline", "bg_12.jpg", "Unlock the peace", "you deserve"),
        ("var_bg_9", "bg_9.jpg", "Unlock the peace", "you deserve"),
        ("var_bg_10", "bg_10.jpg", "Unlock the peace", "you deserve"),
        ("var_bg_11", "bg_11.jpg", "Unlock the peace", "you deserve"),
        ("var_bg_12", "bg_12.jpg", "Unlock the peace", "you deserve"),
        ("var_copy_morning", "bg_12.jpg", "Morning light", "awaits"),
        ("var_copy_neighbourhood", "bg_12.jpg", "The neighbourhood", "knows"),
    ]
    for vid, plate, l1, l2 in variants:
        p = PLATES / plate
        if not p.exists():
            print("missing", p)
            continue
        compose(Image.open(p), ten, make_type_overlay(l1, l2)).save(OUT / f"{vid}.jpg", quality=95)
        print("wrote", vid)

    ref = ROOT / "fixtures/references/Q1_W1_01_preview_from_clean_1080.png"
    if ref.exists():
        a = Image.open(ref).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
        b = Image.open(OUT / "Q1_W1_01_baseline.jpg").convert("RGB")
        cmp = Image.new("RGB", (W * 2 + 20, H), (20, 20, 20))
        cmp.paste(a, (0, 0))
        cmp.paste(b, (W + 20, 0))
        cmp.save(OUT / "compare_preview_vs_baseline.jpg", quality=90)
        print("wrote compare")

    print("origins", origins)
    print("done")


if __name__ == "__main__":
    main()
