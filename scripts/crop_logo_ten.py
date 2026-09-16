"""
Logo top-crop for slot/ten — mask off PerfectTen wordmark only.
Keeps the full brand mark (top-left dot); does not redraw the 10.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "fixtures/layout-library/assets"
W, H = 1080, 1350


def crop_logo_ten() -> Path:
    """
    Top-crop Perfect Ten logo so PerfectTen wordmark is gone.
    Uses dark-green lockup, keeps ink as white alpha matte.
    """
    src = ASSETS / "logo_2.jpg"
    if not src.exists():
        raise SystemExit(f"missing {src} — export logos first")

    logo = np.array(Image.open(src).convert("RGB"))
    ink = logo.mean(axis=2) < 80
    # Keep full brand mark including left anti-alias (do not zero left columns)

    # Find gap between 10 and PerfectTen wordmark
    row = ink.sum(axis=1)
    ys = np.where(row > 30)[0]
    gaps = []
    in_gap = False
    g0 = None
    for y in range(int(ys.min()), int(ys.max()) + 1):
        empty = row[y] < 15
        if empty and not in_gap:
            in_gap = True
            g0 = y
        elif (not empty) and in_gap:
            gaps.append((g0, y - 1, y - g0))
            in_gap = False
    cut = max(gaps, key=lambda t: t[2])[0] if gaps else 900
    ink[cut:, :] = False

    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, 0:3] = 255
    rgba[:, :, 3] = ink.astype(np.uint8) * 255
    out = ASSETS / "ten_logo_crop.png"
    ASSETS.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(out)

    ys2, xs2 = np.where(ink)
    meta = {
        "cut_y": int(cut),
        "bbox": [int(xs2.min()), int(ys2.min()), int(xs2.max()), int(ys2.max())],
        "note": "Top crop of Perfect-Ten-Logo-dark-green; wordmark removed. Full brand mark kept.",
        "safe_inset_art": 40,
        "scale_pad": 0.9,
    }
    (ROOT / "fixtures/layouts/ten_crop_meta.json").write_text(json.dumps(meta, indent=2))
    print("wrote", out, "cut_y", cut, "bbox", meta["bbox"])
    return out


if __name__ == "__main__":
    crop_logo_ten()
