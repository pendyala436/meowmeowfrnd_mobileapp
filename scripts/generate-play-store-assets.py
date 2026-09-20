#!/usr/bin/env python3
"""Generate Google Play Store listing graphics for Meow Meow Frnd App."""

from __future__ import annotations

import io
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "rajeshrajesh" / "play-store"
SOURCE_SVG = ROOT / "public" / "meow-meow-logo-source.svg"
CIRCLE_PNG = ROOT / "public" / "meow-logo-circle.png"
ICON_SRC = ROOT / "public" / "icons" / "icon-512x512.png"

PINK = (255, 43, 133)
PINK_LIGHT = (255, 184, 217)
PINK_DARK = (220, 20, 110)
WHITE = (255, 255, 255)
DARK = (31, 41, 55)
GRAY = (107, 114, 128)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def render_logo(size: int) -> Image.Image:
    src = CIRCLE_PNG if CIRCLE_PNG.exists() else ICON_SRC
    logo = Image.open(src).convert("RGBA")
    logo.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (*WHITE, 255))
    offset = ((size - logo.width) // 2, (size - logo.height) // 2)
    canvas.paste(logo, offset, logo)
    return canvas


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    width: int,
) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((width - tw) // 2, y), text, font=font, fill=fill)
    return y + th


def make_feature_graphic(logo: Image.Image) -> Image.Image:
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)

    for x in range(w):
        t = x / w
        r = int(PINK_LIGHT[0] + (PINK[0] - PINK_LIGHT[0]) * t * 0.35)
        g = int(PINK_LIGHT[1] + (PINK[1] - PINK_LIGHT[1]) * t * 0.35)
        b = int(PINK_LIGHT[2] + (PINK[2] - PINK_LIGHT[2]) * t * 0.35)
        draw.line([(x, 0), (x, h)], fill=(r, g, b))

    draw.rounded_rectangle((40, 40, w - 40, h - 40), radius=28, fill=WHITE)

    mark = logo.copy()
    mark.thumbnail((200, 200), Image.Resampling.LANCZOS)
    img.paste(mark, (80, (h - mark.height) // 2), mark)

    title_font = load_font(52, bold=True)
    sub_font = load_font(30)
    tag_font = load_font(24)

    tx = 320
    draw.text((tx, 140), "Meow Meow Frnd App", font=title_font, fill=PINK)
    draw.text((tx, 210), "Find Your Purrfect Match", font=sub_font, fill=DARK)
    draw.text((tx, 270), "Chat • Match • Groups • Friends Worldwide", font=tag_font, fill=GRAY)

    return img


def make_phone_screenshot(
    logo: Image.Image,
    title: str,
    subtitle: str,
    bullets: list[str],
    accent: tuple[int, int, int] = PINK,
) -> Image.Image:
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)

    draw.rectangle((0, 0, w, 420), fill=accent)
    mark = logo.copy()
    mark.thumbnail((140, 140), Image.Resampling.LANCZOS)
    img.paste(mark, ((w - mark.width) // 2, 70), mark)

    title_font = load_font(54, bold=True)
    sub_font = load_font(34)
    body_font = load_font(36)
    bullet_font = load_font(32)

    draw_centered_text(draw, 240, title, title_font, WHITE, w)
    draw_centered_text(draw, 310, subtitle, sub_font, (255, 235, 245), w)

    card_top = 480
    draw.rounded_rectangle((60, card_top, w - 60, h - 120), radius=36, fill=(250, 250, 252))

    y = card_top + 80
    for bullet in bullets:
        draw.ellipse((100, y + 12, 124, y + 36), fill=accent)
        draw.text((150, y), bullet, font=bullet_font, fill=DARK)
        y += 90

    draw.rounded_rectangle((120, h - 280, w - 120, h - 160), radius=28, fill=accent)
    draw_centered_text(draw, h - 245, "Meow Meow Frnd App", body_font, WHITE, w)

    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    logo = render_logo(512)

    feature = make_feature_graphic(logo)
    feature.save(OUT / "feature-graphic.png", optimize=True)
    print(f"Wrote {OUT / 'feature-graphic.png'}")

    shutil.copy2(ICON_SRC, OUT / "app-icon-512.png")
    print(f"Wrote {OUT / 'app-icon-512.png'}")

    screenshots = [
        (
            "01-chat.png",
            "Start Conversations",
            "Connect through meaningful chat",
            [
                "1-to-1 chat with real people",
                "Voice messages & auto-translation",
                "Verified profiles for safer chats",
            ],
        ),
        (
            "02-match.png",
            "Find Your Match",
            "Discover friends who fit you",
            [
                "Smart matching by language & interests",
                "Browse online users worldwide",
                "See profiles before you connect",
            ],
        ),
        (
            "03-groups.png",
            "Private Groups",
            "Join group calls with friends",
            [
                "Host or join private group rooms",
                "Voice & video group conversations",
                "Connect with your community",
            ],
        ),
        (
            "04-global.png",
            "Connect Globally",
            "Friends across borders",
            [
                "Meet people from many countries",
                "Multi-language support built in",
                "Your privacy always protected",
            ],
        ),
    ]

    for filename, title, subtitle, bullets in screenshots:
        shot = make_phone_screenshot(logo, title, subtitle, bullets)
        path = OUT / "phone-screenshots" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        shot.save(path, optimize=True)
        print(f"Wrote {path}")

    listing = OUT / "listing-copy.txt"
    listing.write_text(
        """GOOGLE PLAY LISTING — Meow Meow Frnd App
Package: in.co.meowmeow

SHORT DESCRIPTION (max 80 characters)
--------------------------------------
Chat, match & make friends worldwide with Meow Meow Frnd App.

(Alternative, 79 chars)
Find friends worldwide — chat, match, private groups & voice calls.


FULL DESCRIPTION
----------------
Meow Meow Frnd App helps you connect, chat, and build meaningful friendships with people around the world.

Whether you want a friendly conversation, a new connection, or to explore group chats, Meow Meow Frnd App makes it simple, fun, and safe.

KEY FEATURES

• Global friend matching — discover people based on language, interests, and availability
• 1-to-1 chat — send messages and voice notes with auto-translation support
• Private groups — join or host group voice and video conversations
• Online users — see who is available to chat right now
• Verified profiles — safer connections with profile verification
• Multi-language support — connect across languages and cultures
• Wallet & rewards — manage coins and earnings securely in-app
• Privacy first — you control your visibility and personal information

WHO IS IT FOR?

Meow Meow Frnd App is for adults 18+ who want genuine chat-based friendships and social connections without the pressure of traditional dating apps.

WHY MEOW MEOW FRND APP?

• Clean, modern pink-branded experience
• Built for mobile — fast, lightweight, and easy to use
• Connect globally from your phone
• Safe community guidelines and moderation

Download Meow Meow Frnd App today and find your purrfect match!

Privacy Policy: https://www.meow-meow.co.in/legal-documents/privacy-policy.txt
Terms of Service: https://www.meow-meow.co.in/legal-documents/terms-of-service.txt

Contact: privacy@meowmeow.app


ASSET CHECKLIST
---------------
App icon (512×512):     rajeshrajesh/play-store/app-icon-512.png
Feature graphic (1024×500): rajeshrajesh/play-store/feature-graphic.png
Phone screenshots:      rajeshrajesh/play-store/phone-screenshots/01-chat.png … 04-global.png

TIP: Replace phone screenshots with real in-app captures from your phone for best Play Store approval.
"""
    )
    print(f"Wrote {listing}")


if __name__ == "__main__":
    main()
