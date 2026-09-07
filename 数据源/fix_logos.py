# -*- coding: utf-8 -*-
"""Fix wrong/missed team downloads and update logo_report.json."""
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
LOGO_DIR = os.path.join(ROOT, "素材库", "队伍logo")
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
_last = 0.0


def api(params):
    global _last
    wait = DELAY - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    params = dict(params, format="json")
    r = requests.get(API, params=params, headers=HEADERS, timeout=30)
    _last = time.time()
    r.raise_for_status()
    return r.json()


def download_file(file_name, out_path, width=400):
    d = api({"action": "query", "titles": "File:" + file_name,
             "prop": "imageinfo", "iiprop": "url", "iiurlwidth": str(width)})
    url = None
    for p in d.get("query", {}).get("pages", {}).values():
        info = (p.get("imageinfo") or [{}])[0]
        url = info.get("thumburl") or info.get("url")
        if url:
            break
    if not url:
        return None
    wait = DELAY - (time.time() - _last_ts())
    if wait > 0:
        time.sleep(wait)
    r = requests.get(url, headers=HEADERS, timeout=60)
    _touch()
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content))
    img.load()
    img.save(out_path)
    return img.size, img.mode in ("RGBA", "LA", "PA"), url


import builtins
_ts = [0.0]


def _last_ts():
    return _ts[0]


def _touch():
    _ts[0] = time.time()


# abbr -> (page_title, [candidate file names])
FIXES = {
    "M8": ("Gentle Mates", ["Gentle Mates 2024 lightmode.png", "Gentle Mates allmode.png"]),
    "2G": ("2GAME Esports", ["2GAME Esports 2024 allmode.png"]),
    "JL": ("Joblife", ["Joblife full lightmode.png"]),
    "FF": ("Fire Flux Esports", ["Fire Flux Esports lightmode full.png"]),
    "SGE": ("Eintracht Frankfurt", ["Eintracht Frankfurt allmode.png", "Eintracht frankfurt logo.png"]),
    "EP": ("Enterprise Esports", ["ENTERPRISE Esports 2023 allmode.png", "ENTERPRISE esports 2023 allmode.svg"]),
    "XIP": ("Xipto Esports", ["Xipto Esports 2025 allmode.png"]),
    "FXW": ("Fluxo W7M", ["Fluxo W7M Dec 2025 allmode.png"]),
    "BST": ("BESTIA", ["BESTIA full lightmode.png"]),
}

# wrong downloads to delete (misidentified)
WRONG = ["AT", "KRX"]

with open(os.path.join(ROOT, "logo_report.json"), encoding="utf-8") as f:
    report = json.load(f)

for abbr in WRONG:
    p = os.path.join(LOGO_DIR, f"{abbr}.png")
    if os.path.exists(p):
        os.remove(p)
        print(f"[DEL] {abbr}.png (was misidentified)")
    report["downloaded"].pop(abbr, None)
    if abbr not in report["failed_teams"]:
        report["failed_teams"].append(abbr)

# search Sripatum actual title
d = api({"action": "query", "list": "search", "srsearch": "Sripatum", "srlimit": "5"})
print("Sripatum search:", [h["title"] for h in d.get("query", {}).get("search", [])])

for abbr, (page, files) in FIXES.items():
    done = False
    for fn in files:
        try:
            res = download_file(fn, os.path.join(LOGO_DIR, f"{abbr}.png"))
        except Exception as e:
            print(f"[ERR] {abbr} {fn}: {e}")
            continue
        if res:
            size, alpha, url = res
            report["downloaded"][abbr] = {
                "page": "https://liquipedia.net/valorant/" + page.replace(" ", "_"),
                "image": fn, "size": size, "alpha": alpha,
            }
            if abbr in report["failed_teams"]:
                report["failed_teams"].remove(abbr)
            print(f"[DL] {abbr}.png <- {page} / {fn} {size} alpha={alpha}")
            done = True
            break
    if not done:
        print(f"[FAIL] {abbr}")

with open(os.path.join(ROOT, "logo_report.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("\ntotal downloaded:", len(report["downloaded"]), "failed:", report["failed_teams"])
