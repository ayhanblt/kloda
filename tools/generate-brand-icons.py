#!/usr/bin/env python3
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent

TILE = (28, 26, 24, 255)          # #1C1A18 (--tile)
RING = (241, 236, 230, 255)       # #F1ECE6 (--tile-ring)
DOT = (232, 195, 161, 255)        # #E8C3A1 (--brand-base on dark tile)
WHITE = (255, 255, 255, 255)
BLACK = (0, 0, 0, 255)

SS = 4  # 4x supersampling factor for razor-sharp curves and round caps


def draw_kloda_symbol(draw: ImageDraw.ImageDraw, cx: float, cy: float, box: float, ring_color, dot_color) -> None:
    """Draw Kloda open sync ring + center dot matching 120x120 SVG geometry."""
    u = box / 120.0
    radius = 26.0 * u
    cap_radius = (10.0 * u) / 2.0

    # strokeDasharray="122 41" with rotate(-90 60 60): clockwise from 12 o'clock (-pi/2).
    sweep_rad = (122.0 / (2.0 * math.pi * 26.0)) * 2.0 * math.pi
    start_rad = -math.pi / 2.0
    steps = 720
    for i in range(steps + 1):
        theta = start_rad + (sweep_rad * i) / steps
        x = cx + radius * math.cos(theta)
        y = cy + radius * math.sin(theta)
        draw.ellipse((x - cap_radius, y - cap_radius, x + cap_radius, y + cap_radius), fill=ring_color)

    dot_r = 7.0 * u
    draw.ellipse((cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r), fill=dot_color)


def render_tray_template(size: int) -> Image.Image:
    """Render monochrome 24x24 TrayIcon geometry (thicker stroke, transparent background) for macOS template menu bar."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    u = s / 24.0
    cx = cy = s / 2.0
    radius = 7.0 * u
    cap_radius = (3.0 * u) / 2.0
    sweep_rad = (33.0 / (2.0 * math.pi * 7.0)) * 2.0 * math.pi
    start_rad = -math.pi / 2.0
    steps = 720
    for i in range(steps + 1):
        theta = start_rad + (sweep_rad * i) / steps
        x = cx + radius * math.cos(theta)
        y = cy + radius * math.sin(theta)
        draw.ellipse((x - cap_radius, y - cap_radius, x + cap_radius, y + cap_radius), fill=BLACK)
    dot_r = 2.5 * u
    draw.ellipse((cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r), fill=BLACK)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def render_opaque_square(size: int) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), TILE)
    draw = ImageDraw.Draw(img)
    draw_kloda_symbol(draw, s / 2.0, s / 2.0, s * 0.86, RING, DOT)
    return img.resize((size, size), Image.Resampling.LANCZOS).convert("RGB")


def render_rounded_tile(
    size: int,
    tile_ratio: float = 1.0,
    radius_ratio: float = 0.225,
    shadow: bool = False,
) -> Image.Image:
    s = size * SS
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    tile_size = s * tile_ratio
    offset = (s - tile_size) / 2.0
    rx = tile_size * radius_ratio

    if shadow:
        shadow_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow_layer)
        sy = offset + s * 0.012
        sd.rounded_rectangle((offset, sy, offset + tile_size, sy + tile_size), radius=rx, fill=(0, 0, 0, 72))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=s * 0.018))
        canvas = Image.alpha_composite(canvas, shadow_layer)

    tile_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile_layer)
    td.rounded_rectangle((offset, offset, offset + tile_size, offset + tile_size), radius=rx, fill=TILE)
    draw_kloda_symbol(td, s / 2.0, s / 2.0, tile_size * 0.86, RING, DOT)

    canvas = Image.alpha_composite(canvas, tile_layer)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def render_circle_tile(size: int) -> Image.Image:
    s = size * SS
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((0, 0, s, s), fill=TILE)
    draw_kloda_symbol(draw, s / 2.0, s / 2.0, s * 0.86, RING, DOT)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def render_transparent_symbol(size: int, scale: float, ring_color, dot_color) -> Image.Image:
    s = size * SS
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw_kloda_symbol(draw, s / 2.0, s / 2.0, s * scale, ring_color, dot_color)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def save_webp(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="WEBP", lossless=True, quality=100)


def main() -> None:
    mobile_assets = ROOT / "apps/mobile/assets"
    ios_appicon = ROOT / "apps/mobile/ios/KlodaSecurePhotosSync/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
    android_res = ROOT / "apps/mobile/android/app/src/main/res"
    desktop_build = ROOT / "apps/desktop/build"
    desktop_public = ROOT / "apps/desktop/public"

    mobile_assets.mkdir(parents=True, exist_ok=True)
    desktop_build.mkdir(parents=True, exist_ok=True)
    desktop_public.mkdir(parents=True, exist_ok=True)

    # 1. iOS & Expo Master Icon (1024x1024 opaque RGB, no alpha)
    ios_icon = render_opaque_square(1024)
    ios_icon.save(mobile_assets / "icon.png", format="PNG")
    ios_appicon.parent.mkdir(parents=True, exist_ok=True)
    ios_icon.save(ios_appicon, format="PNG")

    # 2. Android Adaptive Master Foregrounds + Mipmap WebP assets
    adaptive_fg = render_transparent_symbol(1024, 0.62, RING, DOT)
    adaptive_fg.save(mobile_assets / "adaptive-icon.png", format="PNG")

    adaptive_mono = render_transparent_symbol(1024, 0.62, WHITE, WHITE)
    adaptive_mono.save(mobile_assets / "adaptive-icon-monochrome.png", format="PNG")

    mipmap_specs = [
        ("mipmap-mdpi", 48, 108),
        ("mipmap-hdpi", 72, 162),
        ("mipmap-xhdpi", 96, 216),
        ("mipmap-xxhdpi", 144, 324),
        ("mipmap-xxxhdpi", 192, 432),
    ]
    for folder, legacy_px, adaptive_px in mipmap_specs:
        d = android_res / folder
        save_webp(render_rounded_tile(legacy_px, tile_ratio=0.92, radius_ratio=0.225, shadow=False), d / "ic_launcher.webp")
        save_webp(render_circle_tile(legacy_px), d / "ic_launcher_round.webp")
        save_webp(render_transparent_symbol(adaptive_px, 0.62, RING, DOT), d / "ic_launcher_foreground.webp")
        save_webp(render_transparent_symbol(adaptive_px, 0.62, WHITE, WHITE), d / "ic_launcher_monochrome.webp")

    # 3. macOS Desktop App Icon (.icns via Pillow)
    macos_master = render_rounded_tile(1024, tile_ratio=824.0 / 1024.0, radius_ratio=0.225, shadow=True)
    macos_master.save(
        desktop_build / "icon.icns",
        format="ICNS",
        sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)],
    )

    # 4. Windows & Electron Runtime Icons
    win_master = render_rounded_tile(512, tile_ratio=0.92, radius_ratio=0.225, shadow=False)
    win_master.save(
        desktop_build / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    win_master.save(desktop_public / "app-icon.png", format="PNG")

    tray_icon = render_tray_template(44)
    tray_icon.save(desktop_public / "tray-logo.png", format="PNG")

    print("BRAND_ICONS_GENERATED")


if __name__ == "__main__":
    main()
