"""Renders web/public/og.png, the link-preview card. Run after build.py."""

import json
import os

from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None

OUT = "web/public/og.png"
MAP = "AmbroseValley"
W, H = 1200, 630
BG = (4, 6, 11)
CYAN = (0, 229, 255)
BOT = (251, 146, 60)  # matches the app legend

FONTS = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def font(size, bold=True):
    for p in FONTS:
        if os.path.exists(p) and (bold == ("Bold" in p)):
            return ImageFont.truetype(p, size)
    for p in FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    d = json.load(open(f"web/public/data/{MAP}.json"))
    card = Image.new("RGB", (W, H), BG)

    # map panel on the right, routes drawn over the dimmed art
    side = 560
    panel = Image.open(f"web/public/maps/{MAP}.webp").convert("RGB").resize((side, side))
    panel = Image.blend(panel, Image.new("RGB", (side, side), (6, 8, 12)), 0.62)
    draw = ImageDraw.Draw(panel, "RGBA")

    for j in d["journeys"]:
        p = j["path"]
        if len(p) < 6:
            continue
        pts = [(p[i] * side, p[i + 1] * side) for i in range(0, len(p), 3)]
        draw.line(pts, fill=(*BOT, 85) if j["bot"] else (*CYAN, 80), width=1)

    for j in d["journeys"]:
        for e in j["ev"]:
            t = d["eventTypes"][e[3]]
            col = {"Loot": (74, 222, 128), "BotKill": (239, 68, 68),
                   "BotKilled": (167, 139, 250), "KilledByStorm": (250, 204, 21)}.get(t)
            if not col:
                continue
            x, y = e[0] * side, e[1] * side
            draw.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(*col, 210))

    card.paste(panel, (W - side - 40, (H - side) // 2))

    # left column
    dc = ImageDraw.Draw(card)
    x = 64
    dc.text((x, 176), "LILA GAMES  ·  LEVEL DESIGN TELEMETRY", font=font(17), fill=(110, 127, 157))
    dc.text((x, 214), "BLACKBOX", font=font(86), fill=(234, 246, 255))
    dc.text((x, 322), "Five days of production match data.", font=font(24, False), fill=(169, 188, 214))
    dc.text((x, 356), "Every route, every kill, every crate.", font=font(24, False), fill=(169, 188, 214))

    stats = [("87,599", "EVENTS"), ("796", "MATCHES"), ("3", "MAPS")]
    sx = x
    for n, label in stats:
        dc.text((sx, 424), n, font=font(34), fill=CYAN)
        dc.text((sx, 466), label, font=font(14), fill=(90, 105, 130))
        sx += 150

    dc.rectangle([x, 176 - 26, x + 46, 176 - 22], fill=CYAN)

    card.save(OUT, "PNG", optimize=True)
    print(f"  {OUT}: {os.path.getsize(OUT) / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
