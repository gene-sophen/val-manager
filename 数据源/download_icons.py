# -*- coding: utf-8 -*-
"""Download VCT region league icons from Liquipedia."""
import io
import json
import os
import sys
import time

import requests
from PIL import Image

API = "https://liquipedia.net/valorant/api.php"
HEADERS = {
    "User-Agent": "val-manager-assets/1.0 (contact: local-dev)",
    "Accept-Encoding": "gzip",
}
DELAY = 1.2
ROOT = os.path.dirname(os.path.abspath(__file__))
ICON_DIR = os.path.join(ROOT, "素材库", "赛区图标")
os.makedirs(ICON_DIR, exist_ok=True)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

CANDIDATES = {
    "CN": ["VCT China allmode.png"],
    "AMER": ["VCT 2025 Americas League allmode.png", "VCT 2023 Americas League allmode.png"],
    "EMEA": ["VCT 2025 EMEA League allmode.png", "VCT 2024 EMEA League allmode.png",
             "VCT 2024 EMEA League lightmode.png"],
    "PAC": ["VCT 2025 Pacific League allmode.png", "VCT 2023 Pacific League allmode.png"],
}

_last = 0.0


def req(params_or_url, is_api=True):
    global _last
    wait = DELAY - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    if is_api:
        r = requests.get(API, params=params_or_url, headers=HEADERS, timeout=30)
    else:
        r = requests.get(params_or_url, headers=HEADERS, timeout=60)
    _last = time.time()
    r.raise_for_status()
    return r


report = {}
for region, names in CANDIDATES.items():
    titles = "|".join("File:" + n for n in names)
    r = req({"action": "query", "titles": titles, "prop": "imageinfo",
             "iiprop": "url", "iiurlwidth": "600", "format": "json"})
    url = None
    used = None
    for page in r.json().get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        url = info.get("thumburl") or info.get("url")
        used = page.get("title")
        if url:
            break
    if not url:
        print(f"[MISS] {region}")
        report[region] = None
        continue
    resp = req(url, is_api=False)
    img = Image.open(io.BytesIO(resp.content))
    img.load()
    path = os.path.join(ICON_DIR, f"{region}.png")
    img.save(path)
    report[region] = {"file": used, "url": url, "size": img.size,
                      "alpha": img.mode in ("RGBA", "LA", "PA")}
    print(f"[DL] {region}.png <- {used} {img.size} alpha={report[region]['alpha']}")

with open(os.path.join(ROOT, "icon_report.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
