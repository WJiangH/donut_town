#!/usr/bin/env python3
"""Write the seven Town action ids onto an existing character manifest."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED = ("sitChair", "sitGrass", "garden", "lookout", "read", "coffee", "experiment")


def atlas(measured: dict, frames: list) -> dict:
    return {
        "url": measured["url"],
        "imageWidth": measured["imageWidth"],
        "imageHeight": measured["imageHeight"],
        "frameHeight": measured["frameHeight"],
        "frames": frames,
    }


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("Usage: apply-action-manifest.py characters/<id>.json static.json loops.json")
    path = Path(sys.argv[1])
    static = json.loads(Path(sys.argv[2]).read_text())
    loops = json.loads(Path(sys.argv[3]).read_text())
    if len(static["frames"]) < 5:
        raise SystemExit("static.json needs 5 frames: sitChair garden lookout read experiment")
    if len(loops["frames"]) < 4:
        raise SystemExit("loops.json needs 4 frames: coffeeRest coffeeSip lawnSit lawnLook")
    character = json.loads(path.read_text())
    sit_chair, garden, lookout, read, experiment = static["frames"][:5]
    coffee_rest, coffee_sip, lawn_sit, lawn_look = loops["frames"][:4]
    character["actions"] = {
        "sitChair": {**atlas(static, [sit_chair]), "facing": "down"},
        "sitGrass": {**atlas(loops, [lawn_sit, lawn_look]), "loop": [0, 0, 0, 0, 1, 1, 0], "frameMs": 280, "facing": "down"},
        "garden": {**atlas(static, [garden]), "facing": "down"},
        "lookout": {**atlas(static, [lookout]), "facing": "right"},
        "read": {**atlas(static, [read]), "facing": "down"},
        "coffee": {**atlas(loops, [coffee_rest, coffee_sip]), "loop": [0, 0, 0, 1, 1, 0], "frameMs": 240, "facing": "down"},
        "experiment": {**atlas(static, [experiment]), "facing": "up"},
    }
    missing = [name for name in REQUIRED if name not in character["actions"]]
    if missing:
        raise SystemExit(f"Missing actions: {missing}")
    path.write_text(json.dumps(character, indent=2) + "\n")
    print(f"Wrote {len(REQUIRED)} actions onto {path}")


if __name__ == "__main__":
    main()
