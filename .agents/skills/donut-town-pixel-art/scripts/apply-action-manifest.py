#!/usr/bin/env python3
"""Write Town action ids onto an existing character manifest."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED = (
    "sitChair", "sitGrass", "garden", "lookout", "read", "coffee", "experiment",
    "dance", "fish",
)


def atlas(measured: dict, frames: list) -> dict:
    return {
        "url": measured["url"],
        "imageWidth": measured["imageWidth"],
        "imageHeight": measured["imageHeight"],
        "frameHeight": measured["frameHeight"],
        "frames": frames,
    }


def write_v1(character: dict, static: dict, loops: dict) -> None:
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


def write_v2(character: dict, sheet: dict, flavor: dict | None) -> None:
    if len(sheet["frames"]) < 12:
        raise SystemExit("v2 sheet needs 12 frames: sitChair garden lookout read experiment fish coffeeRest coffeeSip lawnA lawnB danceA danceB")
    frames = sheet["frames"][:12]
    look_facing = (flavor or {}).get("lookoutFacing") or "right"
    if look_facing not in ("down", "right", "left", "up"):
        look_facing = "right"
    character["actions"] = {
        "sitChair": {**atlas(sheet, [frames[0]]), "facing": "down"},
        "garden": {**atlas(sheet, [frames[1]]), "facing": "down"},
        "lookout": {**atlas(sheet, [frames[2]]), "facing": look_facing},
        "read": {**atlas(sheet, [frames[3]]), "facing": "down"},
        "experiment": {**atlas(sheet, [frames[4]]), "facing": "up"},
        "fish": {**atlas(sheet, [frames[5]]), "facing": "right"},
        "coffee": {**atlas(sheet, [frames[6], frames[7]]), "loop": [0, 0, 0, 1, 1, 0], "frameMs": 240, "facing": "down"},
        "sitGrass": {**atlas(sheet, [frames[8], frames[9]]), "loop": [0, 0, 0, 0, 1, 1, 0], "frameMs": 280, "facing": "down"},
        "dance": {**atlas(sheet, [frames[10], frames[11]]), "loop": [0, 1, 0, 1], "frameMs": 200, "facing": "down"},
    }


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 3 and not args[1].startswith("-"):
        path = Path(args[0])
        character = json.loads(path.read_text())
        write_v1(character, json.loads(Path(args[1]).read_text()), json.loads(Path(args[2]).read_text()))
    elif len(args) >= 3 and args[1] == "--v2":
        path = Path(args[0])
        character = json.loads(path.read_text())
        flavor = None
        if "--flavor" in args:
            flavor = json.loads(Path(args[args.index("--flavor") + 1]).read_text())
        write_v2(character, json.loads(Path(args[2]).read_text()), flavor)
    else:
        raise SystemExit(
            "Usage: apply-action-manifest.py characters/<id>.json static.json loops.json\n"
            "   or: apply-action-manifest.py characters/<id>.json --v2 sheet.json [--flavor flavor.json]"
        )
    missing = [name for name in REQUIRED if name not in character.get("actions", {})]
    if args[1] != "--v2":
        missing = [name for name in REQUIRED[:7] if name not in character.get("actions", {})]
    if missing:
        raise SystemExit(f"Missing actions: {missing}")
    path.write_text(json.dumps(character, indent=2) + "\n")
    print(f"Wrote {len(character['actions'])} actions onto {path}")


if __name__ == "__main__":
    main()
