#!/usr/bin/env python3
"""Split an extracted grid atlas into one RGBA PNG per cell."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("atlas")
    parser.add_argument("--grid", nargs=2, type=int, metavar=("COLUMNS", "ROWS"), required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    columns, rows = args.grid
    if columns < 1 or rows < 1:
        raise SystemExit("columns and rows must be positive")
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(args.atlas) as image:
        sheet = image.convert("RGBA")
    cell_w = sheet.width // columns
    cell_h = sheet.height // rows
    if cell_w < 1 or cell_h < 1:
        raise SystemExit("Atlas is smaller than the requested grid")
    written = []
    index = 0
    for row in range(rows):
        for column in range(columns):
            left, top = column * cell_w, row * cell_h
            cell = sheet.crop((left, top, left + cell_w, top + cell_h))
            path = out_dir / f"{index}.png"
            cell.save(path)
            written.append(str(path))
            index += 1
    print(f"Wrote {len(written)} cells {cell_w}x{cell_h} to {out_dir}")


if __name__ == "__main__":
    main()
