#!/usr/bin/env python3
"""
generate-manifest.py
====================
Run this script from the celebration-site/ folder whenever you add
or remove media files in assets/moments/.

Usage:
  python3 generate-manifest.py

After running it, refresh the browser — the carousel will
automatically show your new files (in a random order each page load).

Supported file types: jpg  jpeg  png  webp  mp4
"""

import os
import json
import pathlib

FOLDER = pathlib.Path("assets/moments")
EXTS   = {".jpg", ".jpeg", ".png", ".webp", ".mp4"}

if not FOLDER.exists():
    print(f"❌  Folder not found: {FOLDER}")
    print("    Make sure you run this script from inside celebration-site/")
    raise SystemExit(1)

files = sorted(
    f.name
    for f in FOLDER.iterdir()
    if f.is_file() and f.suffix.lower() in EXTS and not f.name.startswith(".")
)

out = FOLDER / "manifest.json"
with open(out, "w", encoding="utf-8") as fp:
    json.dump(files, fp, indent=2, ensure_ascii=False)

print(f"✅  manifest.json updated — {len(files)} file(s) found")
for f in files:
    ext = pathlib.Path(f).suffix.lower()
    icon = "🎬" if ext == ".mp4" else "🖼 "
    print(f"   {icon}  {f}")
