"""Refine Preview metrics: locate white 10 strokes + text block."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
im = Image.open("fixtures/references/Q1_W1_01_preview_1080x1350.png").convert("RGB")
arr = np.array(im)

# Strict white for graphic strokes (exclude warm lights)
white = (
    (arr[:, :, 0] > 230)
    & (arr[:, :, 1] > 230)
    & (arr[:, :, 2] > 230)
    & (np.abs(arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) < 12)
)

# Focus on upper 70% for the 10
upper = white.copy()
upper[int(H * 0.72) :, :] = False

# Find vertical bar: columns with high white count AND tall contiguous run
col_counts = upper.sum(axis=0)
# Ignore extreme edges (frame)
col_counts[:40] = 0
col_counts[-40:] = 0

# Top candidates
peaks = np.argsort(col_counts)[::-1][:15]
print("top cols", [(int(c), int(col_counts[c])) for c in peaks[:8]])

# Estimate bar as the leftmost strong peak cluster
strong = np.where(col_counts > col_counts.max() * 0.45)[0]
strong = strong[(strong > 40) & (strong < 500)]
print("strong left cols", strong[:20], "...", "count", len(strong))
if len(strong):
    # contiguous groups
    breaks = np.where(np.diff(strong) > 3)[0]
    starts = np.concatenate([[0], breaks + 1])
    ends = np.concatenate([breaks + 1, [len(strong)]])
    groups = [(strong[s], strong[e - 1]) for s, e in zip(starts, ends)]
    # pick tallest/widest group in left half
    best = max(groups, key=lambda g: (col_counts[g[0] : g[1] + 1].sum(), -(g[0])))
    bar_left, bar_right = int(best[0]), int(best[1])
    print("bar", bar_left, bar_right)

# Circle: look for white ring — row with two clusters
# Approximate circle center from max white in mid-right
mid = upper[:, 300:]
print("white pixels upper", int(upper.sum()))

# Lime accents — tighter threshold
lime = (
    (arr[:, :, 1] > 200)
    & (arr[:, :, 0] > 140)
    & (arr[:, :, 0] < 210)
    & (arr[:, :, 2] < 120)
    & (arr[:, :, 1] > arr[:, :, 0] + 30)
)
# Only lower area
lime_l = lime.copy()
lime_l[:1000, :] = False
ys, xs = np.where(lime_l)
print("lime lower", len(xs))
if len(xs):
    # cluster by y
    for label, lo, hi in [("dot", 1000, 1100), ("rule", 1180, 1280)]:
        m = (ys >= lo) & (ys <= hi)
        if m.any():
            print(label, int(xs[m].min()), int(ys[m].min()), int(xs[m].max()), int(ys[m].max()))

# Render font samples overlaid for visual pick
sample = im.copy()
d = ImageDraw.Draw(sample)
fonts = [
    ("Inter-Regular", r"C:\Windows\Fonts\Inter-Regular.ttf"),
    ("Inter-Medium", r"C:\Windows\Fonts\Inter-Medium.ttf"),
    ("Poppins-Regular", r"C:\Windows\Fonts\Poppins-Regular.ttf"),
    ("Poppins-Medium", r"C:\Windows\Fonts\Poppins-Medium.ttf"),
]
y = 50
for name, path in fonts:
    font = ImageFont.truetype(path, 40)
    d.rectangle([40, y - 5, 1040, y + 90], fill=(0, 0, 0, 180))
    d.text((60, y), f"{name}: Unlock the peace", font=font, fill=(255, 255, 255))
    d.text((60, y + 45), "you deserve", font=font, fill=(255, 255, 255))
    y += 110
sample.save("fixtures/references/font_compare_overlay.jpg", quality=90)
print("wrote font_compare_overlay.jpg")

metrics = {
    "bar_left": int(bar_left) if len(strong) else 200,
    "bar_right": int(bar_right) if len(strong) else 260,
    "text_left": int(bar_left) if len(strong) else 200,
    "line1_y": 1068,
    "line2_y": 1148,
    "dot": [227, 1042, 236, 1057],
    "font": "Inter-Regular",
    "font_ps": "Inter-Regular",
    "accent": "B6F25C",
}
# Prefer measured lime
if len(xs):
    m = (ys >= 1000) & (ys <= 1100)
    if m.any():
        metrics["dot"] = [
            int(xs[m].min()),
            int(ys[m].min()),
            int(xs[m].max()),
            int(ys[m].max()),
        ]
        metrics["text_left"] = int(xs[m].max()) + 12
    m = (ys >= 1180) & (ys <= 1280)
    if m.any():
        metrics["rule"] = [
            int(xs[m].min()),
            int(ys[m].min()),
            int(xs[m].max()),
            int(ys[m].max()),
        ]
        metrics["line2_y"] = int(ys[m].min()) - 20

Path("fixtures/layouts/preview_metrics.json").write_text(json.dumps(metrics, indent=2))
print(json.dumps(metrics, indent=2))
