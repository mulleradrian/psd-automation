from PIL import Image
import numpy as np

im = Image.open(r"fixtures/references/Q1_W1_01_preview.png").convert("RGBA")
arr = np.array(im)
h, w = arr.shape[:2]
print("size", w, h)


def is_orange(row):
    r, g, b, a = row.mean(axis=0)
    return r > 180 and 80 < g < 180 and b < 100


top = 0
for y in range(min(120, h)):
    if is_orange(arr[y]):
        top = y + 1
    elif top > 10:
        break
print("crop_top", top)

cream_left = 0
for x in range(min(40, w)):
    r, g, b, a = arr[h // 2, x]
    if r > 200 and g > 190 and b > 170:
        cream_left = x + 1
    else:
        break

cream_right = 0
for x in range(w - 1, max(w - 40, 0), -1):
    r, g, b, a = arr[h // 2, x]
    if r > 200 and g > 190 and b > 170:
        cream_right = w - x
    else:
        break
print("cream_left", cream_left, "cream_right", cream_right)

cropped = im.crop((cream_left, top, w - cream_right, h))
print("cropped", cropped.size)
cropped.save(r"fixtures/references/Q1_W1_01_preview_clean.png")

master = cropped.convert("RGB").resize((1080, 1350), Image.Resampling.LANCZOS)
master.save(r"fixtures/layout-library/p10_ig_4x5/Q1_W1_01_baseline.jpg", quality=95)
master.save(r"fixtures/workingsets/1.1.26/4x5_1.1.26/Q1_W1_01_4x5.jpg", quality=95)
print("wrote baseline 1080x1350")
