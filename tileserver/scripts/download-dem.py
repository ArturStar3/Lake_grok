#!/usr/bin/env python3
"""
Скачивание Copernicus DEM (GLO-30 / GLO-90) с публичного S3 для оффлайн-рельефа.

Использование:
  python scripts/download-dem.py --preset central-asia --resolution glo-90
  python scripts/download-dem.py --bbox 71,40,88,56 --resolution glo-30
  python scripts/download-dem.py --preset demo

Пресеты bbox (minLon,minLat,maxLon,maxLat):
  demo          — один тайл (Астана)
  central-asia  — Казахстан и соседи (как в pre-render-png.js)
  cis           — РФ юг / СНГ / Украина / Кавказ (широкий)
  ukraine       — Украина + приграничье
  caucasus      — Кавказ
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from pathlib import Path

PRESETS: dict[str, tuple[float, float, float, float]] = {
    "demo": (71.0, 51.0, 72.0, 52.0),
    "central-asia": (71.2, 40.8, 87.4, 55.6),
    "cis": (38.0, 40.0, 90.0, 60.0),
    "ukraine": (22.0, 44.0, 40.5, 52.5),
    "caucasus": (38.0, 38.0, 50.0, 44.0),
}

BUCKETS = {
    "glo-30": ("copernicus-dem-30m", "10"),
    "glo-90": ("copernicus-dem-90m", "30"),
}

# Средний размер тайла (байт) для оценки — по замерам N51 E071
TILE_SIZE_ESTIMATE = {
    "glo-30": 25_000_000,
    "glo-90": 3_000_000,
}


def parse_bbox(raw: str) -> tuple[float, float, float, float]:
    parts = [float(x.strip()) for x in raw.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox: minLon,minLat,maxLon,maxLat")
    min_lon, min_lat, max_lon, max_lat = parts
    if min_lon >= max_lon or min_lat >= max_lat:
        raise ValueError("Некорректный bbox")
    return min_lon, min_lat, max_lon, max_lat


def tile_name(lat: int, lon: int, arc_seconds: str) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return (
        f"Copernicus_DSM_COG_{arc_seconds}_{ns}{abs(lat):02d}_00_"
        f"{ew}{abs(lon):03d}_00_DEM"
    )


def iter_tiles(
    bbox: tuple[float, float, float, float],
) -> list[tuple[int, int]]:
    min_lon, min_lat, max_lon, max_lat = bbox
    lat_from = int(min_lat // 1) if min_lat >= 0 else int((min_lat - 1) // 1)
    lat_to = int((max_lat - 1e-9) // 1) if max_lat >= 0 else int(max_lat // 1)
    lon_from = int(min_lon // 1) if min_lon >= 0 else int((min_lon - 1) // 1)
    lon_to = int((max_lon - 1e-9) // 1) if max_lon >= 0 else int(max_lon // 1)

    tiles: list[tuple[int, int]] = []
    for lat in range(lat_from, lat_to + 1):
        for lon in range(lon_from, lon_to + 1):
            tiles.append((lat, lon))
    return tiles


def download_file(url: str, dest: Path, force: bool) -> str:
    if dest.exists() and not force:
        return "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "infolake-dem-downloader/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as out:
            while True:
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    except urllib.error.HTTPError as exc:
        if tmp.exists():
            tmp.unlink()
        if exc.code == 404:
            return "missing"
        raise
    tmp.replace(dest)
    return "ok"


def main() -> int:
    parser = argparse.ArgumentParser(description="Скачать Copernicus DEM по bbox")
    parser.add_argument("--preset", choices=sorted(PRESETS.keys()), help="Готовый регион")
    parser.add_argument("--bbox", help="minLon,minLat,maxLon,maxLat")
    parser.add_argument(
        "--resolution",
        choices=["glo-30", "glo-90"],
        default="glo-90",
        help="GLO-90 (~3 МБ/тайл) или GLO-30 (~25 МБ/тайл)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Каталог для GeoTIFF (по умолчанию data/dem/<resolution>/)",
    )
    parser.add_argument("--force", action="store_true", help="Перекачать существующие")
    parser.add_argument("--dry-run", action="store_true", help="Только список и оценка объёма")
    args = parser.parse_args()

    if args.bbox:
        bbox = parse_bbox(args.bbox)
    elif args.preset:
        bbox = PRESETS[args.preset]
    else:
        parser.error("Укажите --preset или --bbox")

    root = Path(__file__).resolve().parent.parent
    out_dir = args.out or (root / "data" / "dem" / args.resolution)
    bucket, arc_sec = BUCKETS[args.resolution]
    base_url = f"https://{bucket}.s3.amazonaws.com"

    tiles = iter_tiles(bbox)
    est_bytes = len(tiles) * TILE_SIZE_ESTIMATE[args.resolution]
    est_gb = est_bytes / (1024**3)

    print(f"Регион: {bbox}")
    print(f"Разрешение: {args.resolution} ({bucket})")
    print(f"Тайлов: {len(tiles)}")
    print(f"Оценка объёма: ~{est_gb:.2f} ГБ")
    print(f"Каталог: {out_dir}")

    if args.dry_run:
        for lat, lon in tiles[:5]:
            print(f"  пример: {tile_name(lat, lon, arc_sec)}")
        if len(tiles) > 5:
            print(f"  ... и ещё {len(tiles) - 5}")
        return 0

    ok = skip = missing = 0
    for i, (lat, lon) in enumerate(tiles, 1):
        name = tile_name(lat, lon, arc_sec)
        url = f"{base_url}/{name}/{name}.tif"
        dest = out_dir / f"{name}.tif"
        status = download_file(url, dest, args.force)
        if status == "ok":
            ok += 1
        elif status == "skip":
            skip += 1
        else:
            missing += 1
        if i % 10 == 0 or i == len(tiles):
            print(f"[{i}/{len(tiles)}] ok={ok} skip={skip} missing={missing}", flush=True)

    print(f"Готово: загружено {ok}, пропущено {skip}, нет на сервере {missing}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
