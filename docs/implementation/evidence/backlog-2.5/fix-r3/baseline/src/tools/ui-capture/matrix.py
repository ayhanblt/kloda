"""UI capture inventory: parse, validate, select and fingerprint matrix.json.

This module is pure data handling. It opens no device, simulator or network;
the only IO is reading the matrix and the files listed in it for fingerprints.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath

SUPPORTED_VERSION = 1
READY = "ready"
STATUSES = ("ready", "interaction_required", "state_unavailable", "blocked", "deferred_external")
DRIVERS = {
    "desktop-renderer": {"kind": "synthetic-renderer", "runnable": True},
    "ios-native-entry": {"kind": "native-component-fixture", "runnable": True},
    "android-legacy": {"kind": "historical-pointer", "runnable": False},
}
VARIANT_FIELDS = (("locales", "locale"), ("themes", "theme"), ("sizes", "size"))
ROW_REQUIRED = ("id", "platform", "family", "screen", "driver", "status", "ref", "dependencies", "localeKeys")
TOP_REQUIRED = ("version", "variants", "common", "localeFiles", "driverSources", "rows")
MISSING = "MISSING"


class MatrixError(ValueError):
    """The matrix file or a selection request is invalid."""


@dataclass(frozen=True)
class Cell:
    row: str
    locale: str
    theme: str
    size: str
    driver: str
    status: str
    reason: str | None

    @property
    def id(self) -> str:
        return f"{self.row}/{self.locale}/{self.theme}/{self.size}"


def _check_relative(path: str, where: str) -> None:
    if not isinstance(path, str) or not path:
        raise MatrixError(f"{where}: path must be a non-empty string")
    posix, windows = PurePosixPath(path), PureWindowsPath(path)
    if posix.is_absolute() or windows.is_absolute() or windows.drive:
        raise MatrixError(f"{where}: path must be repo-relative, got absolute {path!r}")
    if ".." in posix.parts or ".." in windows.parts:
        raise MatrixError(f"{where}: path must not contain '..': {path!r}")


def _check_status(status: object, reason: object, where: str) -> None:
    if status not in STATUSES:
        raise MatrixError(f"{where}: unknown status {status!r}")
    if status != READY and not (isinstance(reason, str) and reason.strip()):
        raise MatrixError(f"{where}: status {status!r} requires a non-empty reason")


def _check_unique(values: object, allowed: list[str], where: str) -> None:
    if not isinstance(values, list) or not values:
        raise MatrixError(f"{where}: must be a non-empty list")
    seen: set[str] = set()
    for value in values:
        if value not in allowed:
            raise MatrixError(f"{where}: {value!r} is not in variants {allowed}")
        if value in seen:
            raise MatrixError(f"{where}: duplicate value {value!r}")
        seen.add(value)


def _validate_variants(matrix: dict) -> None:
    variants = matrix["variants"]
    for plural, _ in VARIANT_FIELDS:
        values = variants.get(plural) if isinstance(variants, dict) else None
        if not isinstance(values, list) or not values or len(set(values)) != len(values):
            raise MatrixError(f"variants.{plural}: must be a non-empty list without duplicates")


def _validate_overrides(row: dict, matrix: dict) -> None:
    for index, override in enumerate(row.get("cellOverrides", [])):
        where = f"row {row['id']!r} cellOverrides[{index}]"
        keys = [singular for _, singular in VARIANT_FIELDS if singular in override]
        if not keys:
            raise MatrixError(f"{where}: needs at least one of locale/theme/size")
        for plural, singular in VARIANT_FIELDS:
            if singular in override and override[singular] not in matrix["variants"][plural]:
                raise MatrixError(f"{where}: {singular} {override[singular]!r} not in variants")
        _check_status(override.get("status"), override.get("reason"), where)


def _validate_row(row: dict, matrix: dict, ids: set[str], screens: set[tuple[str, str]]) -> None:
    if not isinstance(row, dict):
        raise MatrixError("rows must be objects")
    for field in ROW_REQUIRED:
        if field not in row:
            raise MatrixError(f"row {row.get('id', '?')!r}: missing required field {field!r}")
    where = f"row {row['id']!r}"
    if row["id"] in ids:
        raise MatrixError(f"duplicate row id {row['id']!r}")
    ids.add(row["id"])
    if row["driver"] not in DRIVERS:
        raise MatrixError(f"{where}: unknown driver {row['driver']!r}")
    if (row["driver"], row["screen"]) in screens:
        raise MatrixError(f"{where}: screen {row['screen']!r} is not unique for driver {row['driver']!r}")
    screens.add((row["driver"], row["screen"]))
    if row["platform"] not in matrix["common"] or row["platform"] not in matrix["localeFiles"]:
        raise MatrixError(f"{where}: platform {row['platform']!r} missing from common/localeFiles")
    _check_status(row["status"], row.get("reason"), where)
    for dep in row["dependencies"]:
        _check_relative(dep, f"{where} dependency")
    for plural, _ in VARIANT_FIELDS:
        if plural in row:
            _check_unique(row[plural], matrix["variants"][plural], f"{where} {plural}")
    _validate_overrides(row, matrix)


def _validate_driver_sources(sources: object) -> None:
    if not isinstance(sources, dict) or set(sources) != set(DRIVERS):
        raise MatrixError(f"driverSources must have exactly the drivers {sorted(DRIVERS)}")
    for driver, files in sources.items():
        if not isinstance(files, list):
            raise MatrixError(f"driverSources.{driver}: must be a list")
        for rel in files:
            _check_relative(rel, f"driverSources.{driver}")


def load(path: Path) -> dict:
    try:
        matrix = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MatrixError(f"cannot read matrix {path}: {error}") from error
    if not isinstance(matrix, dict):
        raise MatrixError("matrix must be a JSON object")
    for field in TOP_REQUIRED:
        if field not in matrix:
            raise MatrixError(f"matrix is missing required field {field!r}")
    if matrix["version"] != SUPPORTED_VERSION:
        raise MatrixError(f"unsupported matrix version {matrix['version']!r}; expected {SUPPORTED_VERSION}")
    _validate_variants(matrix)
    for platform, files in matrix["common"].items():
        for rel in files:
            _check_relative(rel, f"common.{platform}")
    for platform, pattern in matrix["localeFiles"].items():
        _check_relative(pattern, f"localeFiles.{platform}")
    _validate_driver_sources(matrix["driverSources"])
    ids: set[str] = set()
    screens: set[tuple[str, str]] = set()
    for row in matrix["rows"]:
        _validate_row(row, matrix, ids, screens)
    return matrix


def _override_for(row: dict, locale: str, theme: str, size: str) -> dict | None:
    actual = {"locale": locale, "theme": theme, "size": size}
    for override in row.get("cellOverrides", []):
        if all(actual[key] == override[key] for _, key in VARIANT_FIELDS if key in override):
            return override
    return None


def _row_cells(row: dict, matrix: dict) -> list[Cell]:
    lists = [row.get(plural, matrix["variants"][plural]) for plural, _ in VARIANT_FIELDS]
    result = []
    for locale in lists[0]:
        for theme in lists[1]:
            for size in lists[2]:
                source = _override_for(row, locale, theme, size) or row
                result.append(Cell(row["id"], locale, theme, size, row["driver"], source["status"], source.get("reason")))
    return result


def cells(matrix: dict) -> list[Cell]:
    return [cell for row in matrix["rows"] for cell in _row_cells(row, matrix)]


def select(matrix: dict, *, screen: str | None = None, locale: str | None = None, theme: str | None = None,
           size: str | None = None, driver: str | None = None) -> list[Cell]:
    rows = {row["id"]: row for row in matrix["rows"]}
    known_screens = {row["screen"] for row in rows.values()} | set(rows)
    if screen is not None and screen not in known_screens:
        raise MatrixError(f"unknown screen {screen!r}")
    if driver is not None and driver not in DRIVERS:
        raise MatrixError(f"unknown driver {driver!r}")
    for plural, singular in VARIANT_FIELDS:
        value = {"locale": locale, "theme": theme, "size": size}[singular]
        if value is not None and value not in matrix["variants"][plural]:
            raise MatrixError(f"unknown {singular} {value!r}")
    chosen = []
    for cell in cells(matrix):
        row = rows[cell.row]
        if screen is not None and screen not in (row["id"], row["screen"]):
            continue
        if driver is not None and cell.driver != driver:
            continue
        if any(want is not None and want != have for want, have in ((locale, cell.locale), (theme, cell.theme), (size, cell.size))):
            continue
        chosen.append(cell)
    if not chosen:
        raise MatrixError("selection is empty: no cell matches the given filters")
    return chosen


def _count(items: list[Cell]) -> dict[str, int]:
    counts = {status: 0 for status in STATUSES}
    for item in items:
        counts[item.status] += 1
    return counts


def _overrides(row: dict, row_cells: list[Cell]) -> list[dict]:
    """Cells whose status or reason differs from the row-level values."""
    return [{"cell": cell.id, "status": cell.status, "reason": cell.reason} for cell in row_cells
            if (cell.status, cell.reason) != (row["status"], row.get("reason"))]


def listing(matrix: dict) -> dict:
    rows = []
    for row in matrix["rows"]:
        kind = DRIVERS[row["driver"]]
        row_cells = _row_cells(row, matrix)
        rows.append({
            "id": row["id"], "platform": row["platform"], "family": row["family"], "screen": row["screen"],
            "driver": row["driver"], "driverKind": kind["kind"], "runnable": kind["runnable"],
            "status": row["status"], "reason": row.get("reason"), "ref": row["ref"],
            "evidence": row.get("evidence", []), "cells": _count(row_cells), "overrides": _overrides(row, row_cells),
        })
    everything = cells(matrix)
    return {"variants": matrix["variants"], "rows": rows, "totals": _count(everything), "totalCells": len(everything)}


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _file_hash(path: Path) -> str:
    try:
        return _sha256_bytes(path.read_bytes())
    except OSError:
        return MISSING


def _locale_keys(pattern: str, prefixes: list[str], locale: str, repo: Path) -> tuple[dict, bool]:
    rel = pattern.replace("{locale}", locale)
    entry = {"path": rel, "prefixes": sorted(prefixes), "sha256": MISSING}
    try:
        data = json.loads((repo / rel).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return entry, False
    subset, complete = {}, True
    for prefix in entry["prefixes"]:
        node = data
        for part in prefix.split("."):
            if not isinstance(node, dict) or part not in node:
                node = MISSING
                complete = False
                break
            node = node[part]
        subset[prefix] = node
    entry["sha256"] = _sha256_bytes(_canonical(subset))
    return entry, complete


def fingerprint(matrix: dict, row_id: str, locale: str, repo: Path) -> dict:
    row = next((item for item in matrix["rows"] if item["id"] == row_id), None)
    if row is None:
        raise MatrixError(f"unknown row {row_id!r}")
    if locale not in matrix["variants"]["locales"]:
        raise MatrixError(f"unknown locale {locale!r}")
    repo = Path(repo)
    paths = sorted(set(matrix["common"][row["platform"]]) | set(row["dependencies"])
                   | set(matrix["driverSources"][row["driver"]]))
    files = {rel: _file_hash(repo / rel) for rel in paths}
    keys, complete = _locale_keys(matrix["localeFiles"][row["platform"]], row["localeKeys"], locale, repo)
    known = complete and MISSING not in files.values()
    body = {"files": files, "localeKeys": keys, "row": _sha256_bytes(_canonical(row))}
    return {**body, "status": "known" if known else "unknown", "digest": _sha256_bytes(_canonical(body))}


def reuse_decision(previous: dict | None, current: dict) -> dict:
    """Reuse only when both fingerprints are known and identical; UNKNOWN is never fresh."""
    changed = _changed_keys(previous, current) if previous else []
    if previous is None:
        return {"decision": "recapture", "changed": changed}
    if previous.get("status") == "unknown" or current.get("status") == "unknown":
        return {"decision": "unknown", "changed": changed}
    if previous.get("digest") == current.get("digest"):
        return {"decision": "reuse", "changed": []}
    return {"decision": "recapture", "changed": changed}


def _changed_keys(previous: dict, current: dict) -> list[str]:
    old, new = previous.get("files", {}), current.get("files", {})
    changed = {rel for rel in set(old) | set(new) if old.get(rel) != new.get(rel)}
    for key in ("localeKeys", "row"):
        if previous.get(key) != current.get(key):
            changed.add(key)
    return sorted(changed)
