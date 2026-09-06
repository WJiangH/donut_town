#!/usr/bin/env python3
"""Inspect alpha silhouettes and write source rectangles; never modifies a PNG."""
import argparse
import json
from pathlib import Path
from PIL import Image

def bands(counts, threshold=3, gap=8):
    spans = []
    for i, count in enumerate(counts):
        if count < threshold:
            continue
        if spans and i - spans[-1][1] <= gap:
            spans[-1][1] = i + 1
        else:
            spans.append([i, i + 1])
    return spans

def measure(path, url, draft=False):
    with Image.open(path) as image:
        if 'A' not in image.getbands():
            raise ValueError('PNG has no alpha; background extraction is required.')
        width, height = image.size
        alpha = image.getchannel('A')
        transparent_corners = not any(alpha.getpixel(point) for point in [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)])
        if not transparent_corners and not draft:
            raise ValueError('Outer corners must be transparent; use --draft only for explicitly non-production geometry inspection.')
        pixels = alpha.tobytes()
        rows = [pixels[y * width:(y + 1) * width] for y in range(height)]
        row_bands = bands([sum(a >= 128 for a in row) for row in rows])
        if len(row_bands) != 3:
            raise ValueError(f'Expected 3 separated silhouette rows, found {len(row_bands)}; inspect manually.')
        frames = []
        for top, bottom in row_bands:
            column_bands = bands([sum(rows[y][x] >= 128 for y in range(top, bottom)) for x in range(width)])
            if len(column_bands) != 3:
                raise ValueError(f'Expected 3 silhouettes in row {top}:{bottom}, found {len(column_bands)}; inspect manually.')
            for left, right in column_bands:
                box = alpha.crop((left, top, right, bottom)).point(lambda a: 255 if a >= 128 else 0).getbbox()
                l, t, r, b = box
                x0, y0 = max(0, left + l - 2), max(0, top + t - 2)
                x1, y1 = min(width, left + r + 2), min(height, top + b + 2)
                frames.append([x0, y0, x1-x0, y1-y0])
        result = dict(url=url, imageWidth=width, imageHeight=height,
                      frameHeight=max(frame[3] for frame in frames), frames=frames)
        if draft:
            result.update(productionReady=False, transparencyCornersPassed=transparent_corners, status="draft-geometry-only")
        return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('png')
    parser.add_argument('--url', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--draft', action='store_true', help='Measure an RGBA draft despite nonzero corner alpha; output is explicitly non-production.')
    args = parser.parse_args()
    result = measure(args.png, args.url, args.draft)
    Path(args.out).write_text(json.dumps(result, indent=2) + '\n')
    print(f"Measured 9 frame rectangles; {result['imageWidth']}x{result['imageHeight']}; common height {result['frameHeight']}. Visual review still required.")

if __name__ == '__main__':
    main()
