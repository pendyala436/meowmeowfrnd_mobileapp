#!/usr/bin/env python3
"""Generate PWA + Capacitor Android icons from the official circular logo.

Source: logo copy.jpeg (circle only, no dark square background).
Writes web icons under public/ and Android mipmaps under android/app/src/main/res.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
SPLASH = PUBLIC / "splash"
ASSETS = ROOT / "src" / "assets"
SOURCE_JPEG = ROOT / "logo copy.jpeg"
CIRCLE_PNG = PUBLIC / "meow-logo-circle.png"
ASSETS_CIRCLE = ASSETS / "meow-logo-circle.png"
CAPACITOR_RES = ROOT / "android" / "app" / "src" / "main" / "res"
TWA_RES = ROOT / "rajeshrajesh" / "android" / "app" / "src" / "main" / "res"

# Matches android/app/src/main/res/values/colors.xml ic_launcher_background
BRAND_PINK = (255, 43, 133, 255)  # #FF2B85
WHITE = (255, 255, 255, 255)


def extract_circle(src: Path) -> Image.Image:
    """Crop the circular badge and make outside transparent."""
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    def is_bg(x: int, y: int, thresh: int = 28) -> bool:
        r, g, b, _a = pixels[x, y]
        return r < thresh and g < thresh and b < thresh

    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if not is_bg(x, y):
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    r = min((maxx - minx) / 2, (maxy - miny) / 2) - 2

    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.8))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    out.putalpha(mask)

    pad = 2
    left = max(0, int(cx - r) - pad)
    top = max(0, int(cy - r) - pad)
    right = min(w, int(cx + r) + pad + 1)
    bottom = min(h, int(cy + r) + pad + 1)
    return out.crop((left, top, right, bottom))


def fit_circle(logo: Image.Image, size: int, scale: float, bg: tuple[int, int, int, int] | None) -> Image.Image:
    """Center the circular logo on a square canvas."""
    if bg is None:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (size, size), bg)
    target = max(1, int(size * scale))
    fitted = logo.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    offset = ((size - fitted.width) // 2, (size - fitted.height) // 2)
    canvas.paste(fitted, offset, fitted)
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)
    print(f"Wrote {path.relative_to(ROOT)}")


def save_jpeg(image: Image.Image, path: Path, quality: int = 92) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb = Image.new("RGB", image.size, (255, 255, 255))
    if image.mode == "RGBA":
        rgb.paste(image, mask=image.split()[-1])
    else:
        rgb.paste(image)
    rgb.save(path, format="JPEG", quality=quality, optimize=True)
    print(f"Wrote {path.relative_to(ROOT)}")


def save_favicon_ico(master: Image.Image, sizes: list[int]) -> None:
    ico_images = []
    for size in sizes:
        ico_images.append(fit_circle(master, size, 0.92, WHITE).convert("RGBA"))
    ico_path = PUBLIC / "favicon.ico"
    ico_images[0].save(
        ico_path,
        format="ICO",
        sizes=[(img.width, img.height) for img in ico_images],
        append_images=ico_images[1:],
    )
    print(f"Wrote {ico_path.relative_to(ROOT)}")


def sync_android_res(res_root: Path, logo: Image.Image) -> None:
    if not res_root.exists():
        print(f"Skip missing Android res: {res_root.relative_to(ROOT)}")
        return

    # Adaptive icon foreground sizes (full-bleed canvas; logo inset for safe zone)
    foreground_sizes = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    # Legacy launcher sizes
    launcher_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }

    for folder, size in foreground_sizes.items():
        # Transparent outside circle — adaptive icon clips to mask
        fg = fit_circle(logo, size, 0.72, None)
        save_png(fg, res_root / folder / "ic_launcher_foreground.png")

    for folder, size in launcher_sizes.items():
        # Legacy square icons: circle on brand pink
        legacy = fit_circle(logo, size, 0.88, BRAND_PINK)
        save_png(legacy, res_root / folder / "ic_launcher.png")
        save_png(legacy, res_root / folder / "ic_launcher_round.png")
        maskable = fit_circle(logo, size, 0.66, BRAND_PINK)
        save_png(maskable, res_root / folder / "ic_maskable.png")

    # Splash drawables (portrait / landscape density buckets if present)
    splash_logo_sizes = {
        "drawable-port-mdpi": 200,
        "drawable-port-hdpi": 300,
        "drawable-port-xhdpi": 400,
        "drawable-port-xxhdpi": 600,
        "drawable-port-xxxhdpi": 800,
        "drawable-land-mdpi": 200,
        "drawable-land-hdpi": 300,
        "drawable-land-xhdpi": 400,
        "drawable-land-xxhdpi": 600,
        "drawable-land-xxxhdpi": 800,
        "drawable-mdpi": 200,
        "drawable-hdpi": 300,
        "drawable-xhdpi": 400,
        "drawable-xxhdpi": 600,
        "drawable-xxxhdpi": 800,
    }
    for folder, size in splash_logo_sizes.items():
        folder_path = res_root / folder
        if not folder_path.exists():
            continue
        splash = fit_circle(logo, size, 0.9, BRAND_PINK)
        save_png(splash, folder_path / "splash.png")

    manifest_src = PUBLIC / "manifest.json"
    raw_dir = res_root / "raw"
    if raw_dir.exists() and manifest_src.exists():
        manifest_dst = raw_dir / "web_app_manifest.json"
        manifest_dst.write_text(json.dumps(json.loads(manifest_src.read_text()), separators=(",", ":")))
        print(f"Wrote {manifest_dst.relative_to(ROOT)}")


def main() -> None:
    if SOURCE_JPEG.exists():
        circle = extract_circle(SOURCE_JPEG)
        save_png(circle, CIRCLE_PNG)
        save_png(circle, ASSETS / "meow-logo-circle.png")
    elif CIRCLE_PNG.exists():
        print(f"Using existing circle: {CIRCLE_PNG.relative_to(ROOT)}")
        circle = Image.open(CIRCLE_PNG).convert("RGBA")
        save_png(circle, ASSETS / "meow-logo-circle.png")
    elif (ASSETS / "meow-logo-circle.png").exists():
        print(f"Using existing circle: {(ASSETS / 'meow-logo-circle.png').relative_to(ROOT)}")
        circle = Image.open(ASSETS / "meow-logo-circle.png").convert("RGBA")
        save_png(circle, CIRCLE_PNG)
    else:
        raise SystemExit(
            f"Missing logo source. Place 'logo copy.jpeg' in project root "
            f"or ensure {CIRCLE_PNG.relative_to(ROOT)} exists."
        )

    # Web / PWA icons — circle on transparent (PNG) or white (favicon)
    icon_specs = [
        (PUBLIC / "meow-meow-logo.png", 512, 0.96, None),
        (PUBLIC / "favicon.png", 512, 0.92, WHITE),
        (ICONS / "icon-72x72.png", 72, 0.92, WHITE),
        (ICONS / "icon-180x180.png", 180, 0.92, WHITE),
        (ICONS / "icon-192x192.png", 192, 0.92, WHITE),
        (ICONS / "icon-512x512.png", 512, 0.92, WHITE),
        (ICONS / "icon-512x512-maskable.png", 512, 0.66, BRAND_PINK),
    ]
    for path, size, scale, bg in icon_specs:
        img = fit_circle(circle, size, scale, bg)
        # Keep alpha for transparent canvases; flatten white/pink ones to RGB PNG is fine as RGBA
        save_png(img, path)

    # JPEG used by some meta/legacy references — circle only on white
    save_jpeg(fit_circle(circle, 1024, 0.96, WHITE), PUBLIC / "meow-meow-logo.jpeg")

    # iOS / PWA splash
    save_png(_splash(circle, 1290, 2796), SPLASH / "splash-screen.png")

    save_favicon_ico(circle, [16, 32, 48, 64, 128, 256])

    # Capacitor Android (primary mobile app)
    sync_android_res(CAPACITOR_RES, circle)
    # Legacy TWA project if present
    sync_android_res(TWA_RES, circle)

    print(f"Done — circular logo across web + Android (brand pink #{BRAND_PINK[0]:02X}{BRAND_PINK[1]:02X}{BRAND_PINK[2]:02X})")


def _splash(logo: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), WHITE)
    target = int(min(width, height) * 0.42)
    fitted = logo.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    offset = ((width - fitted.width) // 2, (height - fitted.height) // 2 - int(height * 0.04))
    canvas.paste(fitted, offset, fitted)
    return canvas


if __name__ == "__main__":
    main()
