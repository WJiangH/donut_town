"""Split an approved atlas into wardrobe layers.

Legacy characters use reviewed polygons/rectangles. Newer rigs can use
color-and-frame-band rules in the same regions file. No source photo,
generative redraw, resizing, or frame realignment.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def recolor(layer, color):
    width, height = layer.size
    result = layer.copy()
    for y in range(height):
        for x in range(width):
            r, g, b, a = layer.getpixel((x, y))
            if not a:
                continue
            value = max(r, g, b)
            if value < 17:
                continue
            t = min(1, (value - 12) / 65)
            result.putpixel((x, y), tuple(round(channel * (.3 + .7 * t)) for channel in color) + (a,))
    return result


def write_manifest(spec, out, extra):
    manifest = json.loads((ROOT / 'characters' / f"{spec['characterId']}.json").read_text())
    existing_path = ROOT / 'characters' / 'wardrobe' / f"{spec['characterId']}.json"
    existing = json.loads(existing_path.read_text()) if existing_path.exists() else {}
    prefix = '/' + str(out.relative_to(ROOT)) + '/'
    manifest.update(
        schemaVersion=1,
        rig=spec['rig'],
        base=prefix + 'base.png',
        slots={
            'jacket': {'required': True, 'default': 'original', 'items': {k: prefix + 'jacket-' + k + '.png' for k in ['original', 'navy', 'olive']}},
            'shoes': {'required': True, 'default': 'original', 'items': {k: prefix + 'shoes-' + k + '.png' for k in ['original', 'cream', 'burgundy']}},
            'eyewear': {'required': False, 'default': 'none', 'items': {'none': None, 'smoke': prefix + 'eyewear-smoke.png'}},
        },
        layerOrder=['jacket', 'shoes', 'eyewear'],
        compatibility='This rig only; same-silhouette apparel variants. Required garment slots cover legacy cutouts.',
        **extra,
    )
    ui = spec.get('ui') or existing.get('ui')
    if ui:
        manifest['ui'] = ui
    existing_path.write_text(json.dumps(manifest, indent=2) + '\n')


def build_legacy(spec, source):
    width, height = source.size
    out = ROOT / 'assets' / 'residents' / spec['characterId'] / 'wardrobe-v1'
    out.mkdir(parents=True, exist_ok=True)
    mask = Image.new('L', source.size)
    draw = ImageDraw.Draw(mask)
    for points in spec['shoes']:
        draw.polygon([tuple(p) for p in points], fill=255)
    shoe_mask = mask
    jacket_mask = Image.new('L', source.size)
    draw = ImageDraw.Draw(jacket_mask)
    for x, y, w, h in spec['jackets']:
        draw.rectangle((x, y, x + w - 1, y + h - 1), fill=255)
    for x, y, w, h in spec['jacketExclusions']:
        draw.rectangle((x, y, x + w - 1, y + h - 1), fill=0)
    base = Image.new('RGBA', source.size)
    shoes = Image.new('RGBA', source.size)
    jacket = Image.new('RGBA', source.size)
    for y in range(height):
        for x in range(width):
            pixel = source.getpixel((x, y))
            r, g, b, a = pixel
            target = shoes if shoe_mask.getpixel((x, y)) else jacket if jacket_mask.getpixel((x, y)) and max(r, g, b) - min(r, g, b) < 28 and max(r, g, b) < 155 else base
            target.putpixel((x, y), pixel)
    lenses = Image.new('RGBA', source.size)
    draw = ImageDraw.Draw(lenses)
    for points in spec['lenses']:
        draw.polygon([tuple(p) for p in points], fill=(17, 29, 37, 255))
        x, y = points[0]
        draw.line((x + 3, y + 2, x + 8, y + 2), fill=(69, 91, 100, 255), width=2)
    assets = {
        'base': base,
        'shoes-original': shoes,
        'jacket-original': jacket,
        'shoes-cream': recolor(shoes, (211, 202, 176)),
        'shoes-burgundy': recolor(shoes, (117, 47, 53)),
        'jacket-navy': recolor(jacket, (42, 73, 108)),
        'jacket-olive': recolor(jacket, (80, 91, 54)),
        'eyewear-smoke': lenses,
    }
    for name, image in assets.items():
        image.save(out / (name + '.png'))
    combined = Image.alpha_composite(Image.alpha_composite(base, jacket), shoes)
    assert combined.tobytes() == source.tobytes(), 'Original layers must reconstruct source byte-for-byte'
    for name, original, allowed in [('shoes-cream', shoes, shoe_mask), ('shoes-burgundy', shoes, shoe_mask), ('jacket-navy', jacket, jacket_mask), ('jacket-olive', jacket, jacket_mask)]:
        assert assets[name].getchannel('A').tobytes() == original.getchannel('A').tobytes()
        for y in range(height):
            for x in range(width):
                if assets[name].getpixel((x, y)) != original.getpixel((x, y)):
                    assert allowed.getpixel((x, y))
    write_manifest(spec, out, {})
    print(f"PASS {spec['characterId']}: exact original reconstruction, 8 PNG layers written.")


def is_sage_shirt(pixel):
    r, g, b, a = pixel
    return a >= 128 and g >= r + 3 and g >= b and 100 <= g <= 210 and max(r, g, b) - min(r, g, b) >= 8


def is_skin(pixel):
    r, g, b, a = pixel
    return a >= 128 and r > g + 12 and r > b + 18 and g > b - 5


def build_color_band(spec, source):
    width, height = source.size
    out = ROOT / 'assets' / 'residents' / spec['characterId'] / 'wardrobe-v1'
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'characters' / f"{spec['characterId']}.json").read_text())
    shoe_band = spec['shoes']['band']
    shoe_mask = Image.new('L', source.size)
    jacket_mask = Image.new('L', source.size)
    lens_mask = Image.new('L', source.size)
    for index, (x, y, w, h) in enumerate(manifest['frames']):
        row = index // 3
        bottoms = {}
        for px in range(x, x + w):
            for py in range(y + h - 1, y - 1, -1):
                if source.getpixel((px, py))[3] >= 128:
                    bottoms[px] = py
                    break
        foot_top = y + int(h * 0.58)
        for px, bottom in bottoms.items():
            if bottom < foot_top:
                continue
            for py in range(max(foot_top, bottom - shoe_band + 1), bottom + 1):
                pixel = source.getpixel((px, py))
                if pixel[3] < 128 or is_skin(pixel) or is_sage_shirt(pixel):
                    continue
                shoe_mask.putpixel((px, py), 255)
        for py in range(y, y + h):
            for px in range(x, x + w):
                pixel = source.getpixel((px, py))
                if pixel[3] < 128:
                    continue
                if is_sage_shirt(pixel):
                    jacket_mask.putpixel((px, py), 255)
                if row < 2:
                    rel = (py - y) / h
                    lum = sum(pixel[:3]) / 3
                    if 0.22 <= rel <= 0.36 and lum <= 42 and max(pixel[:3]) - min(pixel[:3]) <= 16:
                        lens_mask.putpixel((px, py), 255)
    # Shoes win over shirt if a pixel is in both (ankles should stay shoes).
    jacket_pixels = jacket_mask.load()
    shoe_pixels = shoe_mask.load()
    for py in range(height):
        for px in range(width):
            if shoe_pixels[px, py] and jacket_pixels[px, py]:
                jacket_pixels[px, py] = 0
    base = Image.new('RGBA', source.size)
    shoes = Image.new('RGBA', source.size)
    jacket = Image.new('RGBA', source.size)
    for py in range(height):
        for px in range(width):
            pixel = source.getpixel((px, py))
            if shoe_mask.getpixel((px, py)):
                shoes.putpixel((px, py), pixel)
            elif jacket_mask.getpixel((px, py)):
                jacket.putpixel((px, py), pixel)
            else:
                base.putpixel((px, py), pixel)
    lenses = Image.new('RGBA', source.size)
    for py in range(height):
        for px in range(width):
            if lens_mask.getpixel((px, py)):
                lenses.putpixel((px, py), (17, 29, 37, 230))
    assets = {
        'base': base,
        'shoes-original': shoes,
        'jacket-original': jacket,
        'shoes-cream': recolor(shoes, (211, 202, 176)),
        'shoes-burgundy': recolor(shoes, (117, 47, 53)),
        'jacket-navy': recolor(jacket, (42, 73, 108)),
        'jacket-olive': recolor(jacket, (80, 91, 54)),
        'eyewear-smoke': lenses,
    }
    for name, image in assets.items():
        image.save(out / (name + '.png'))
    combined = Image.alpha_composite(Image.alpha_composite(base, jacket), shoes)
    assert combined.tobytes() == source.tobytes(), 'Original layers must reconstruct source byte-for-byte'
    write_manifest(spec, out, {})
    print(f"PASS {spec['characterId']}: exact original reconstruction, 8 PNG layers written.")


def main():
    character_id = sys.argv[1] if len(sys.argv) > 1 else 'r-7f3a2c'
    spec = json.loads((ROOT / 'characters' / 'wardrobe' / f'{character_id}.regions.json').read_text())
    source = Image.open(ROOT / spec['source']).convert('RGBA')
    if spec.get('split') == 'color-band':
        build_color_band(spec, source)
    else:
        build_legacy(spec, source)


if __name__ == '__main__':
    main()
