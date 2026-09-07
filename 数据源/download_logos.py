# -*- coding: utf-8 -*-
"""Download VCT team logos and region icons from Liquipedia (valorant wiki)."""
import io
import json
import os
import re
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
ICON_DIR = os.path.join(ROOT, "素材库", "赛区图标")
os.makedirs(LOGO_DIR, exist_ok=True)
os.makedirs(ICON_DIR, exist_ok=True)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Curated abbreviation -> Liquipedia page title guesses (valorant wiki)
TITLE_MAP = {
    "EDG": ["EDward Gaming"], "BLG": ["Bilibili Gaming"], "FPX": ["FunPlus Phoenix"],
    "TE": ["Trace Esports"], "WOL": ["Wolves Esports"], "TYL": ["TyLoo", "TYLOO"],
    "JDG": ["JD Gaming"], "NOVA": ["Nova Esports"], "AG": ["All Gamers"],
    "DRG": ["Dragon Ranger Gaming"], "TEC": ["Titan Esports Club"], "XLG": ["Xi Lai Gaming"],
    "C9": ["Cloud9"], "SEN": ["Sentinels"], "NRG": ["NRG", "NRG Esports"],
    "G2": ["G2 Esports"], "100T": ["100 Thieves"], "LEV": ["Leviatán", "Leviatan"],
    "LOUD": ["LOUD"], "MIBR": ["MIBR"], "KRÜ": ["KRÜ Esports", "KRU Esports"],
    "EG": ["Evil Geniuses"], "FUR": ["FURIA Esports", "FURIA"], "NV": ["Team Envy", "Envy"],
    "FNC": ["Fnatic"], "TH": ["Team Heretics"], "VIT": ["Team Vitality"],
    "KC": ["Karmine Corp"], "TL": ["Team Liquid"], "NAVI": ["Natus Vincere", "NAVI"],
    "BBL": ["BBL Esports"], "FUT": ["FUT Esports"], "GX": ["GIANTX"],
    "M8": ["Gentle Mates"], "ULF": ["ULF Esports"], "EF": ["Eternal Fire"],
    "PCF": ["PCIFIC Espor", "PCIFIC"],
    "PRX": ["Paper Rex"], "T1": ["T1"], "GEN": ["Gen.G", "Gen.G Esports"],
    "ZETA": ["ZETA DIVISION"], "DFM": ["DetonatioN FocusMe"], "RRQ": ["Rex Regum Qeon"],
    "GE": ["Global Esports"], "TS": ["Team Secret"], "NS": ["Nongshim RedForce"],
    "VL": ["Velocity Gaming", "Team Velocity"], "KRX": [], "FS": ["FULL SENSE"],
    "KBG": [], "AT": [], "2G": ["2Game Esports"], "M80": ["M80"],
    "BST": [], "FXW": [], "EP": [], "FF": [], "JL": [], "SGE": [],
    "ONG": [], "QTD": [], "SPE": [], "XIP": [],
}

_last_req = 0.0


def api_get(params):
    global _last_req
    wait = DELAY - (time.time() - _last_req)
    if wait > 0:
        time.sleep(wait)
    params = dict(params)
    params["format"] = "json"
    r = requests.get(API, params=params, headers=HEADERS, timeout=30)
    _last_req = time.time()
    r.raise_for_status()
    return r.json()


def get_wikitext(title):
    data = api_get({
        "action": "query", "prop": "revisions", "rvprop": "content",
        "rvslots": "main", "titles": title, "redirects": "1",
    })
    pages = data.get("query", {}).get("pages", {})
    for pid, page in pages.items():
        if pid == "-1" or "missing" in page:
            return None, None
        revs = page.get("revisions")
        if not revs:
            return None, None
        return page.get("title", title), revs[0]["slots"]["main"].get("*", "")
    return None, None


def search_team(abbr):
    """Search for a team page; return (title, wikitext) of first hit with a team infobox."""
    for query in (f'intitle:"{abbr}"', f"{abbr} esports"):
        data = api_get({"action": "query", "list": "search", "srsearch": query, "srlimit": "8"})
        hits = data.get("query", {}).get("search", [])
        for hit in hits:
            title, text = get_wikitext(hit["title"])
            if text and "{{Infobox team" in text:
                return title, text
    return None, None


def extract_image(wikitext):
    m = re.search(r"\|\s*image\s*=\s*([^\n|}]+)", wikitext)
    if not m:
        return None
    name = m.group(1).strip()
    if not name or name.lower().startswith(("unknown", "default")):
        return None
    return name


def get_image_urls(file_names, width=400):
    """Batch-resolve File: titles -> thumb URLs. Returns {file_name: url}."""
    result = {}
    titles = ["File:" + n for n in file_names]
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        data = api_get({
            "action": "query", "titles": "|".join(batch),
            "prop": "imageinfo", "iiprop": "url", "iiurlwidth": str(width),
        })
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            info = (page.get("imageinfo") or [{}])[0]
            url = info.get("thumburl") or info.get("url")
            if title.startswith("File:") and url:
                result[title[5:]] = url
    return result


def download(url, path):
    global _last_req
    wait = DELAY - (time.time() - _last_req)
    if wait > 0:
        time.sleep(wait)
    r = requests.get(url, headers=HEADERS, timeout=60)
    _last_req = time.time()
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content))
    img.load()
    has_alpha = img.mode in ("RGBA", "LA", "PA")
    img.save(path)
    return img.size, has_alpha


def main():
    with open(os.path.join(ROOT, "数据源", "team_regions.json"), encoding="utf-8") as f:
        regions = json.load(f)

    abbrs = []
    for key, teams in regions.items():
        if key.startswith("_"):
            continue
        abbrs.extend(teams)

    # Phase 1: resolve each team to (page_title, image_file)
    resolved = {}   # abbr -> (page_title, image_file)
    failed = []
    for abbr in abbrs:
        found = False
        for cand in TITLE_MAP.get(abbr, []):
            title, text = get_wikitext(cand)
            if text and "{{Infobox team" in text:
                img = extract_image(text)
                if img:
                    resolved[abbr] = (title, img)
                    found = True
                    break
        if not found:
            title, text = search_team(abbr)
            if text:
                img = extract_image(text)
                if img:
                    resolved[abbr] = (title, img)
                    found = True
        if not found:
            failed.append(abbr)
            print(f"[MISS] {abbr}")
        else:
            print(f"[OK]   {abbr} -> {resolved[abbr][0]} : {resolved[abbr][1]}")

    # Phase 2: batch resolve image URLs
    img_map = {abbr: img for abbr, (_, img) in resolved.items()}
    urls = get_image_urls(sorted(set(img_map.values())))
    url_by_abbr = {abbr: urls.get(img) for abbr, img in img_map.items()}

    # Phase 3: download
    report = {"downloaded": {}, "failed_teams": failed, "no_image_url": []}
    for abbr, url in url_by_abbr.items():
        if not url:
            report["no_image_url"].append(abbr)
            print(f"[NOURL] {abbr}")
            continue
        path = os.path.join(LOGO_DIR, f"{abbr}.png")
        try:
            size, alpha = download(url, path)
            page_title = resolved[abbr][0]
            page_url = "https://liquipedia.net/valorant/" + page_title.replace(" ", "_")
            report["downloaded"][abbr] = {
                "page": page_url, "image": resolved[abbr][1],
                "size": size, "alpha": alpha,
            }
            print(f"[DL]   {abbr}.png {size} alpha={alpha}")
        except Exception as e:
            print(f"[ERR]  {abbr}: {e}")
            report["no_image_url"].append(abbr)

    with open(os.path.join(ROOT, "logo_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nDownloaded {len(report['downloaded'])}/{len(abbrs)}; failed: {failed}; no-url: {report['no_image_url']}")


if __name__ == "__main__":
    main()
