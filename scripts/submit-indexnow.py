#!/usr/bin/env python3
"""Submit public sitemap URLs to IndexNow (Bing-compatible).

Usage (from repo root, after deploy):
  python3 scripts/submit-indexnow.py
  python3 scripts/submit-indexnow.py --origin https://www.meow-meow.co.in
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

KEY = "1f6b2c55d15941fb8791312d77d3f0d8"
DEFAULT_ORIGIN = "https://www.meow-meow.co.in"
PATHS = ["/", "/auth", "/install", "/about", "/how-it-works", "/faq"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Submit URLs to IndexNow")
    parser.add_argument("--origin", default=DEFAULT_ORIGIN, help="Site origin (no trailing slash)")
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    host = origin.split("://", 1)[-1]
    urls = [f"{origin}/" if p == "/" else f"{origin}{p}" for p in PATHS]
    key_location = f"{origin}/{KEY}.txt"
    payload = {
        "host": host,
        "key": KEY,
        "keyLocation": key_location,
        "urlList": urls,
    }
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            status = res.getcode()
            print(f"IndexNow OK HTTP {status} — submitted {len(urls)} URL(s)")
            for u in urls:
                print(f"  - {u}")
            return 0
    except urllib.error.HTTPError as e:
        # 422 = already submitted recently — treat as success for deploy scripts
        if e.code in (200, 202, 422):
            print(f"IndexNow accepted HTTP {e.code}")
            return 0
        body = e.read().decode("utf-8", errors="replace")
        print(f"IndexNow failed HTTP {e.code}: {body}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"IndexNow error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
