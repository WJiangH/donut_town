#!/usr/bin/env python3
"""Pack extracted RGBA sprites into a grid atlas and write measured frames."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def silhouette_box(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    return alpha.getbbox()


def fit_sprite(sprite: Image.Image, cell_w: int, cell_h: int, pad: int = 8) -> Image.Image:
    box = silhouette_box(sprite)
    if box is None:
        raise SystemExit("A source sprite is fully transparent")
    cropped = sprite.crop(box)
    max_w = max(1, cell_w - pad * 2)
    max_h = max(1, cell_h - pad * 2)
    scale = min(1.0, max_w / cropped.width, max_h / cropped.height)
    if scale < 1.0:
        cropped = cropped.resize(
            (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
            Image.Resampling.NEAREST,
        )
    return cropped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sprites", nargs="+")
    parser.add_argument("--out", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--cols", type=int, required=True)
    parser.add_argument("--cell", nargs=2, type=int, metavar=("WIDTH", "HEIGHT"), required=True)
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()
    if args.cols < 1:
        raise SystemExit("cols must be positive")
    cell_w, cell_h = args.cell
    count = len(args.sprites)
    rows = (count + args.cols - 1) // args.cols
    canvas = Image.new("RGBA", (args.cols * cell_w, rows * cell_h), (0, 0, 0, 0))
    frames = []
    for index, path in enumerate(args.sprites):
        sprite = Image.open(path).convert("RGBA")
        fitted = fit_sprite(sprite, cell_w, cell_h)
        column, row = index % args.cols, index // args.cols
        x = column * cell_w + (cell_w - fitted.width) // 2
        y = row * cell_h + cell_h - fitted.height - 6
        canvas.paste(fitted, (x, y), fitted)
        box = silhouette_box(canvas.crop((column * cell_w, row * cell_h, (column + 1) * cell_w, (row + 1) * cell_h)))
        if box is None:
            raise SystemExit(f"No silhouette after packing {path}")
        left, top, right, bottom = box
        pad = 2
        frames.append([
            max(0, column * cell_w + left - pad),
            max(0, row * cell_h + top - pad),
            min(cell_w, right - left + pad * 2),
            min(cell_h, bottom - top + pad * 2),
        ])
    corners = [canvas.getpixel(point)[3] for point in ((0, 0), (canvas.width - 1, 0), (0, canvas.height - 1), (canvas.width - 1, canvas.height - 1))]
    if any(corners):
        raise SystemExit(f"Packed atlas left opaque corners: {corners}")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    manifest = {
        "url": args.url,
        "imageWidth": canvas.width,
        "imageHeight": canvas.height,
        "frameHeight": max(frame[3] for frame in frames),
        "frames": frames,
    }
    Path(args.manifest).write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {canvas.width}x{canvas.height} {out}; {len(frames)} frames; corners={corners}")


if __name__ == "__main__":
    main()
