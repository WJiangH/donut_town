#!/usr/bin/env python3
"""Crop the down-neutral walk frame for an action-pose identity lock."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("atlas")
    parser.add_argument("manifest")
    parser.add_argument("--out", required=True)
    parser.add_argument("--index", type=int, default=1, help="Walk frame index; default is down-neutral.")
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text())
    frames = manifest["frames"]
    if args.index < 0 or args.index >= len(frames):
        raise SystemExit(f"Frame index {args.index} is outside 0..{len(frames) - 1}")
    x, y, width, height = frames[args.index]
    with Image.open(args.atlas) as image:
        crop = image.convert("RGBA").crop((x, y, x + width, y + height))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out)
    print(f"Wrote identity crop {crop.width}x{crop.height} from frame {args.index} to {out}")


if __name__ == "__main__":
    main()
