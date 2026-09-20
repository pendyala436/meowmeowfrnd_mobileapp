#!/usr/bin/env python3
"""Bump Android versionCode (+1) and versionName patch (x.y.Z+1) in app/build.gradle."""

from __future__ import annotations

import re
import sys
from pathlib import Path

GRADLE = Path(__file__).resolve().parents[1] / "android" / "app" / "build.gradle"


def main() -> int:
    text = GRADLE.read_text()

    code_m = re.search(r"versionCode\s+(\d+)", text)
    name_m = re.search(r'versionName\s+"([^"]+)"', text)
    if not code_m or not name_m:
        print("Could not find versionCode / versionName in", GRADLE, file=sys.stderr)
        return 1

    old_code = int(code_m.group(1))
    old_name = name_m.group(1)
    new_code = old_code + 1

    parts = old_name.split(".")
    if len(parts) >= 1 and parts[-1].isdigit():
        parts[-1] = str(int(parts[-1]) + 1)
        new_name = ".".join(parts)
    else:
        new_name = f"{old_name}.1"

    text = re.sub(r"versionCode\s+\d+", f"versionCode {new_code}", text, count=1)
    text = re.sub(r'versionName\s+"[^"]+"', f'versionName "{new_name}"', text, count=1)
    GRADLE.write_text(text)

    print(f"Bumped Android version: {old_name} ({old_code}) → {new_name} ({new_code})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
