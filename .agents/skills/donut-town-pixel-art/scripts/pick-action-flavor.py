#!/usr/bin/env python3
"""Pick a stable, per-resident pose flavor so action art does not all match."""
from __future__ import annotations

import hashlib
import json
import sys

SIT_CHAIR = [
    "formal upright, knees together, hands folded in the lap",
    "one ankle crossed over the opposite knee, hands on the raised shin",
    "lean back slightly, one arm draped to the side as if on an armrest",
    "perch forward, both elbows on the knees",
    "casual slouch, hands resting on the thighs",
    "sit slightly sideways, legs angled left, looking at the camera",
    "knees together, one hand on the cheek, thinking",
    "legs stretched out, ankles crossed, relaxed",
]
SIT_GRASS = [
    "cross-legged tailor sit, hands on knees, face the camera",
    "hug both knees to the chest",
    "lie on the stomach, chin in both hands, no book",
    "lie on the stomach reading a small open book (prone reader)",
    "lie on one side, propped on an elbow",
    "long-sit with legs out, leaning on one hand behind",
    "kneel-sit on the heels, hands on the thighs",
    "sprawl back, weight on both hands behind the hips",
]
SIT_GRASS_LOOP = [
    "same pose, then a small glance to the side",
    "same pose, then shift weight onto the other arm",
    "same pose, then turn a page or tap the book",
    "same pose, then look up and smile",
]
READ = [
    "sit and hold an open book at chest height",
    "sit cross-legged with the book in the lap",
    "lie on the stomach with the book on the ground in front",
    "stand holding an open book, head tilted down",
    "one hand holds the book, the other turns a page",
    "book held close to the face, absorbed",
]
GARDEN = [
    "kneel on one knee with a small trowel",
    "crouch, both hands reaching toward the ground, no dirt pile",
    "stand holding a small watering can",
    "kneel and inspect a tiny potted sprout",
    "crouch, wipe the forehead, trowel in the other hand",
]
LOOKOUT = [
    ("right", "right-facing side view, hands clasped behind the back"),
    ("right", "right-facing, one hand shading the eyes"),
    ("down", "3/4 toward camera, pointing into the distance"),
    ("right", "hands on hips, looking right"),
    ("down", "lean forward as if on a rail, no rail drawn"),
]
COFFEE = [
    "one hand holds a white cup at the waist, then sips",
    "two-handed mug at the chest, then sips",
    "raise the cup like a small toast, then sips",
    "casual one-hand hold at hip height, then sips",
    "cup near the chin while thinking, then sips",
]
EXPERIMENT = [
    "back view, small flask in the right hand",
    "3/4-back, swirling a flask",
    "back view, holding a flask up to inspect it",
    "3/4-back, tiny dropper over a flask",
]
DANCE = [
    "side-step: weight left then right, both arms out",
    "gentle sway, one arm raised",
    "small hop with a cheerful fist pump",
    "disco point: one arm up and one down, then swap",
    "shy groove: shoulders and a small step, hands near the waist",
]
FISH = [
    "stand 3/4-right, fishing rod extended to the right, no water",
    "sit on the ground with a fishing rod across the lap",
    "stand, rod resting on the shoulder, waiting",
    "lean back slightly, both hands on the rod as if a fish tugged",
]


def pick(resident_id: str, options: list, salt: str):
    digest = hashlib.sha256(f"{resident_id}:{salt}".encode()).digest()
    return options[digest[0] % len(options)]


def flavor_for(resident_id: str) -> dict:
    look_facing, look_style = pick(resident_id, LOOKOUT, "lookout")
    sit_grass = pick(resident_id, SIT_GRASS, "sitGrass")
    return {
        "id": resident_id,
        "sitChair": pick(resident_id, SIT_CHAIR, "sitChair"),
        "sitGrass": sit_grass,
        "sitGrassLoop": pick(resident_id, SIT_GRASS_LOOP, "sitGrassLoop"),
        "garden": pick(resident_id, GARDEN, "garden"),
        "lookout": look_style,
        "lookoutFacing": look_facing,
        "read": pick(resident_id, READ, "read"),
        "coffee": pick(resident_id, COFFEE, "coffee"),
        "experiment": pick(resident_id, EXPERIMENT, "experiment"),
        "dance": pick(resident_id, DANCE, "dance"),
        "fish": pick(resident_id, FISH, "fish"),
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: pick-action-flavor.py <r-id>")
    print(json.dumps(flavor_for(sys.argv[1]), indent=2))


if __name__ == "__main__":
    main()
