#by YukinX
import math
from PIL import Image, ImageDraw, ImageFilter

def orb_icon(size):
    S = 512
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((8, 8, S - 8, S - 8), radius=110, fill=(3, 8, 22, 255))
    img = Image.alpha_composite(img, bg)

    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    core = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd, cd = ImageDraw.Draw(glow), ImageDraw.Draw(core)
    cx, cy, R = S / 2, S / 2, 150
    n = 7
    for i in range(n):
        a = -math.pi / 2 - i * (2 * math.pi * 0.8 / n)
        x, y = cx + math.cos(a) * R, cy + math.sin(a) * R
        r = 34 * (1 - i * 0.07)
        gd.ellipse((x - r * 2.2, y - r * 2.2, x + r * 2.2, y + r * 2.2), fill=(70, 150, 255, 200))
        cd.ellipse((x - r, y - r, x + r, y + r), fill=(235, 245, 255, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, core.filter(ImageFilter.GaussianBlur(2)))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((8, 8, S - 8, S - 8), radius=110, fill=255)
    img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (S, S), 0), mask))
    return img.resize((size, size), Image.LANCZOS)

for s in (16, 32, 48, 128):
    orb_icon(s).save(f"extension/icons/icon{s}.png")
print("icons ok")
