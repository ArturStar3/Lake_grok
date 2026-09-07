"""WGS 84 (EPSG:4326) decimal degrees ↔ degrees-minutes-seconds.

Matches InfoLake storage: lat ∈ [-90, 90], lng ∈ [-180, 180], 6 decimal places.
No datum shift (SK-42 / Gauss–Kruger is out of scope).
"""

from __future__ import annotations

import math
import re
from typing import Literal, Optional

DD_DECIMALS = 6
SECONDS_DECIMALS = 3

SAMPLE_LAT_DD = 55.751244
SAMPLE_LNG_DD = 37.618423
SAMPLE_LAT_DMS = '55°45\'04.478" N'
SAMPLE_LNG_DMS = '37°37\'06.323" E'
SAMPLE_LAT_DMS_RU = "55 45 04.478 с.ш."
SAMPLE_LNG_DMS_RU = "37 37 06.323 в.д."
DMS_PATTERN = 'Г°ММ\'СС.ссс" полушарие'
DMS_WRITE_HINTS = (
    f"Пишите так: {DMS_PATTERN}",
    f"Широта:  {SAMPLE_LAT_DMS}     или     {SAMPLE_LAT_DMS_RU}",
    f"Долгота: {SAMPLE_LNG_DMS}     или     {SAMPLE_LNG_DMS_RU}",
    "N/с.ш. = север, S/ю.ш. = юг, E/в.д. = восток, W/з.д. = запад",
    "Минуты и секунды — от 0 до 59; секунды можно с тысячными.",
)

Kind = Literal["lat", "lng"]

_HEMI = {
    "n": ("lat", 1),
    "s": ("lat", -1),
    "e": ("lng", 1),
    "w": ("lng", -1),
    "с": ("lat", 1),
    "ю": ("lat", -1),
    "в": ("lng", 1),
    "з": ("lng", -1),
}

_HEMI_RE = re.compile(
    r"""
    (?P<hemi>
        [nsewNSEWСсЮюВвЗз]
        |
        с\.?\s*ш\.?
        |
        ю\.?\s*ш\.?
        |
        в\.?\s*д\.?
        |
        з\.?\s*д\.?
    )
    """,
    re.VERBOSE,
)

_DMS_BODY_RE = re.compile(
    r"""
    (?P<deg>-?\d+(?:[.,]\d+)?)
    \s*(?:°|º|deg|гр\.?|d)?\s*
    (?:
        (?P<min>\d+(?:[.,]\d+)?)
        \s*(?:'|′|min|м\.?|m)?\s*
        (?:
            (?P<sec>\d+(?:[.,]\d+)?)
            \s*(?:"|″|sec|с\.?|s)?
        )?
    )?
    """,
    re.VERBOSE | re.IGNORECASE,
)


class CoordError(ValueError):
    pass


def _parse_float(text: str) -> float:
    return float(str(text).strip().replace(",", ".").replace(" ", "").replace("\u00a0", ""))


def round_dd(value: float) -> float:
    return round(float(value), DD_DECIMALS)


def format_dd(value: float) -> str:
    return f"{round_dd(value):.{DD_DECIMALS}f}"


def validate_dd(value: float, kind: Kind) -> float:
    number = round_dd(value)
    if not math.isfinite(number):
        raise CoordError("Координата не является числом")
    if kind == "lat" and not -90 <= number <= 90:
        raise CoordError("Широта должна быть от -90 до 90")
    if kind == "lng" and not -180 <= number <= 180:
        raise CoordError("Долгота должна быть от -180 до 180")
    return number


def _normalize_hemi(token: str) -> tuple[Optional[Kind], int]:
    raw = token.strip().lower().replace(" ", "")
    raw = raw.replace(".", "")
    if raw in ("сш", "с"):
        return "lat", 1
    if raw in ("юш", "ю"):
        return "lat", -1
    if raw in ("вд", "в"):
        return "lng", 1
    if raw in ("зд", "з"):
        return "lng", -1
    letter = raw[0]
    return _HEMI.get(letter, (None, 1))


def _split_hemi(text: str) -> tuple[str, Optional[str]]:
    stripped = text.strip()
    prefix = _HEMI_RE.match(stripped)
    if prefix:
        rest = stripped[prefix.end() :].lstrip(" \t,;:")
        return rest, prefix.group("hemi")
    suffix = None
    matches = list(_HEMI_RE.finditer(stripped))
    if matches:
        last = matches[-1]
        if last.end() == len(stripped) or stripped[last.end() :].strip(" \t,;.") == "":
            suffix = last.group("hemi")
            stripped = stripped[: last.start()].rstrip(" \t,;:")
    return stripped, suffix


def dd_to_dms_parts(value: float, kind: Kind) -> tuple[int, int, int, float, str]:
    number = validate_dd(value, kind)
    sign = 1 if number >= 0 else -1
    if kind == "lat":
        hemi = "N" if sign >= 0 else "S"
    else:
        hemi = "E" if sign >= 0 else "W"

    total_seconds = round(abs(number) * 3600, SECONDS_DECIMALS)
    degrees = int(total_seconds // 3600)
    remainder = total_seconds - degrees * 3600
    minutes = int(remainder // 60)
    seconds = round(remainder - minutes * 60, SECONDS_DECIMALS)

    if seconds >= 60:
        seconds = 0.0
        minutes += 1
    if minutes >= 60:
        minutes = 0
        degrees += 1
    return sign, degrees, minutes, seconds, hemi


def format_dms(value: float, kind: Kind) -> str:
    _sign, degrees, minutes, seconds, hemi = dd_to_dms_parts(value, kind)
    sec = f"{seconds:0{SECONDS_DECIMALS + 3}.{SECONDS_DECIMALS}f}"
    return f"{degrees}°{minutes:02d}'{sec}\" {hemi}"


def parse_dd(text: object, kind: Kind) -> float:
    if text is None:
        raise CoordError("Пустое значение")
    if isinstance(text, (int, float)) and not isinstance(text, bool):
        return validate_dd(float(text), kind)
    raw = str(text).strip()
    if not raw:
        raise CoordError("Пустое значение")
    if looks_like_dms(raw):
        return parse_dms(raw, kind)
    try:
        return validate_dd(_parse_float(raw), kind)
    except (TypeError, ValueError) as exc:
        raise CoordError("Не удалось прочитать десятичные градусы") from exc


def looks_like_dms(text: str) -> bool:
    sample = str(text)
    if re.search(r"[°º'′\"″]", sample):
        return True
    if _HEMI_RE.search(sample):
        return True
    parts = re.split(r"[\s/]+", sample.strip())
    return len(parts) >= 3 and re.match(r"^-?\d", parts[0] or "") is not None


def parse_dms(text: object, kind: Kind) -> float:
    if text is None:
        raise CoordError("Пустое значение DMS")
    if isinstance(text, (int, float)) and not isinstance(text, bool):
        return validate_dd(float(text), kind)

    raw = str(text).strip()
    if not raw:
        raise CoordError("Пустое значение DMS")

    body, hemi_token = _split_hemi(raw)
    body = body.replace("º", "°").strip()
    match = _DMS_BODY_RE.search(body)
    if not match:
        try:
            return validate_dd(_parse_float(body), kind)
        except (TypeError, ValueError) as exc:
            raise CoordError(f"Не удалось разобрать DMS: {raw}") from exc

    degrees = _parse_float(match.group("deg"))
    minutes = _parse_float(match.group("min") or 0)
    seconds = _parse_float(match.group("sec") or 0)

    if minutes < 0 or minutes >= 60:
        raise CoordError("Минуты должны быть от 0 до 59")
    if seconds < 0 or seconds >= 60:
        raise CoordError("Секунды должны быть от 0 до 59.999")

    sign = -1 if degrees < 0 else 1
    decimal = abs(degrees) + minutes / 60 + seconds / 3600

    if hemi_token:
        hemi_kind, hemi_sign = _normalize_hemi(hemi_token)
        if hemi_kind and hemi_kind != kind:
            raise CoordError("Полушарие не соответствует типу координаты")
        sign = hemi_sign

    return validate_dd(sign * decimal, kind)


def convert_value(text: object, kind: Kind, to_dms: bool) -> str:
    if to_dms:
        return format_dms(parse_dd(text, kind), kind)
    return format_dd(parse_dms(text, kind))
