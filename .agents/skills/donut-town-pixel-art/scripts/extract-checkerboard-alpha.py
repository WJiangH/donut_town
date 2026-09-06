#!/usr/bin/env python3
"""Turn a baked preview background into a genuine RGBA PNG.

Image tools often return opaque JPEG with either a gray checkerboard or a
near-white backdrop. Flood from the border through that backdrop only, and
stop at chromatic pixels and dark outlines so white clothes and shoes stay.
Inspect the result before shipping.
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


def near_gray(pixel: tuple[int, int, int], spread: int = 14) -> bool:
    return max(pixel) - min(pixel) <= spread


def luminance(pixel: tuple[int, int, int]) -> float:
    return sum(pixel) / 3


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return (sum((x - y) ** 2 for x, y in zip(a, b))) ** 0.5


def border_pixels(width: int, height: int):
    for x in range(width):
        yield x, 0
        yield x, height - 1
    for y in range(1, height - 1):
        yield 0, y
        yield width - 1, y


def mean_color(pixels: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    count = len(pixels)
    return tuple(round(sum(channel) / count) for channel in zip(*pixels))


def detect_mode(rgb: Image.Image) -> str:
    pixels = rgb.load()
    width, height = rgb.size
    samples = [pixels[x, y] for x, y in border_pixels(width, height) if near_gray(pixels[x, y], 20)]
    if len(samples) < 32:
        raise ValueError("Border is not a flat or checkerboard backdrop.")
    dark = [pixel for pixel in samples if luminance(pixel) < 140]
    light = [pixel for pixel in samples if luminance(pixel) >= 140]
    if dark and light and len(dark) > 20 and len(light) > 20:
        return "checker"
    return "light"


def is_light_backdrop(pixel: tuple[int, int, int]) -> bool:
    return near_gray(pixel, 12) and luminance(pixel) >= 226


def grid_seeds(width: int, height: int, columns: int, rows: int):
    for row in range(rows + 1):
        y = min(height - 1, round(row * height / rows))
        for x in range(width):
            yield x, y
    for column in range(columns + 1):
        x = min(width - 1, round(column * width / columns))
        for y in range(height):
            yield x, y


def extract_light(rgb: Image.Image, columns: int = 1, rows: int = 1) -> Image.Image:
    width, height = rgb.size
    pixels = rgb.load()
    background = Image.new("1", (width, height), 0)
    marked = background.load()
    queue = deque()
    seeds = list(border_pixels(width, height))
    if columns > 1 or rows > 1:
        seeds.extend(grid_seeds(width, height, columns, rows))
    for x, y in seeds:
        if is_light_backdrop(pixels[x, y]) and marked[x, y] == 0:
            marked[x, y] = 1
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and marked[nx, ny] == 0 and is_light_backdrop(pixels[nx, ny]):
                marked[nx, ny] = 1
                queue.append((nx, ny))
    return matte_from_background(rgb, background)


def extract_checker(rgb: Image.Image) -> Image.Image:
    width, height = rgb.size
    pixels = rgb.load()
    samples = [pixels[x, y] for x, y in border_pixels(width, height) if near_gray(pixels[x, y], 18)]
    dark = mean_color([pixel for pixel in samples if luminance(pixel) < 120])
    light = mean_color([pixel for pixel in samples if luminance(pixel) >= 120])

    def is_checker(pixel: tuple[int, int, int]) -> bool:
        if not near_gray(pixel, 14):
            return False
        return color_distance(pixel, dark) <= 22 or color_distance(pixel, light) <= 22

    background = Image.new("1", (width, height), 0)
    marked = background.load()
    queue = deque()
    for x, y in border_pixels(width, height):
        if is_checker(pixels[x, y]):
            marked[x, y] = 1
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and marked[nx, ny] == 0 and is_checker(pixels[nx, ny]):
                marked[nx, ny] = 1
                queue.append((nx, ny))
    return matte_from_background(rgb, background)


def matte_from_background(rgb: Image.Image, background: Image.Image) -> Image.Image:
    width, height = rgb.size
    pixels = rgb.load()
    marked = background.load()
    # Drop one-pixel backdrop specks that leaked through outline gaps, but do
    # not open the silhouette. A leftover interior hole stays with the character.
    keep = Image.new("L", (width, height), 0)
    keep_px = keep.load()
    for y in range(height):
        for x in range(width):
            if marked[x, y] == 0:
                keep_px[x, y] = 255
    # Erode the light JPEG fringe, then restore the silhouette interior.
    keep = keep.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(3))
    keep_px = keep.load()
    # Peel the baked near-white JPEG halo. Stop at dark outlines and chromatic clothes.
    for _ in range(3):
        remove = []
        for y in range(height):
            for x in range(width):
                if keep_px[x, y] == 0:
                    continue
                pixel = pixels[x, y]
                if not (near_gray(pixel, 18) and luminance(pixel) >= 200):
                    continue
                if any(
                    not (0 <= nx < width and 0 <= ny < height) or keep_px[nx, ny] == 0
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                ):
                    remove.append((x, y))
        if not remove:
            break
        for x, y in remove:
            keep_px[x, y] = 0
    out = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    dest = out.load()
    for y in range(height):
        for x in range(width):
            if keep_px[x, y]:
                dest[x, y] = (*pixels[x, y], 255)
    return out


def extract(source: Image.Image, columns: int = 1, rows: int = 1) -> Image.Image:
    rgb = source.convert("RGB")
    mode = detect_mode(rgb)
    return extract_light(rgb, columns, rows) if mode == "light" else extract_checker(rgb)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--out", required=True)
    parser.add_argument("--grid", nargs=2, type=int, metavar=("COLUMNS", "ROWS"), default=[1, 1])
    args = parser.parse_args()
    source = Image.open(args.source)
    result = extract(source, *args.grid)
    corners = [result.getpixel(point)[3] for point in ((0, 0), (result.width - 1, 0), (0, result.height - 1), (result.width - 1, result.height - 1))]
    if any(corners):
        raise SystemExit(f"Extraction left opaque corners: {corners}")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    result.save(args.out)
    opaque = sum(1 for value in result.getchannel("A").getdata() if value)
    print(f"Wrote RGBA {result.width}x{result.height} to {args.out}; opaque={opaque}; corners={corners}. Visual review still required.")


if __name__ == "__main__":
    main()
