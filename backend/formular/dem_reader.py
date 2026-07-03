"""Чтение Copernicus DEM GeoTIFF из локального каталога тайлов."""

from __future__ import annotations

import math
import re
from pathlib import Path

from django.conf import settings

_TILE_RE = re.compile(
    r'Copernicus_DSM_COG_\d+_([NS])(\d{2})_00_([EW])(\d{3})_00_DEM',
    re.IGNORECASE,
)


def _tile_key(lat_index: int, lon_index: int) -> tuple[int, int]:
    return lat_index, lon_index


def _parse_tile_indices(filename: str) -> tuple[int, int] | None:
    match = _TILE_RE.search(filename)
    if not match:
        return None
    ns, lat_s, ew, lon_s = match.groups()
    lat = int(lat_s) * (1 if ns.upper() == 'N' else -1)
    lon = int(lon_s) * (1 if ew.upper() == 'E' else -1)
    return _tile_key(lat, lon)


def _lat_lon_to_tile_indices(lat: float, lon: float) -> tuple[int, int]:
    return int(math.floor(lat)), int(math.floor(lon))


class DemTileIndex:
    """Индекс 1°×1° тайлов Copernicus DEM в каталоге."""

    def __init__(self, dem_dir: Path):
        self.dem_dir = Path(dem_dir)
        self._tiles: dict[tuple[int, int], Path] = {}
        self._datasets: dict[tuple[int, int], object] = {}
        if self.dem_dir.is_dir():
            for path in self.dem_dir.glob('*.tif'):
                key = _parse_tile_indices(path.name)
                if key:
                    self._tiles[key] = path

    @property
    def tile_count(self) -> int:
        return len(self._tiles)

    def has_coverage(self, lat: float, lon: float) -> bool:
        return _lat_lon_to_tile_indices(lat, lon) in self._tiles

    def _get_dataset(self, tile_key: tuple[int, int]):
        if tile_key in self._datasets:
            return self._datasets[tile_key]
        path = self._tiles.get(tile_key)
        if not path:
            return None
        import rasterio

        dataset = rasterio.open(path)
        self._datasets[tile_key] = dataset
        return dataset

    def sample(self, lat: float, lon: float) -> float | None:
        if not self._tiles:
            return None
        key = _lat_lon_to_tile_indices(lat, lon)
        dataset = self._get_dataset(key)
        if dataset is None:
            return None
        try:
            values = list(dataset.sample([(lon, lat)]))
            if not values:
                return None
            value = float(values[0][0])
            if math.isnan(value) or value < -500:
                return None
            return value
        except Exception:
            return None


def get_dem_index() -> DemTileIndex:
    dem_dir = Path(getattr(settings, 'DEM_DATA_DIR', ''))
    return DemTileIndex(dem_dir)
