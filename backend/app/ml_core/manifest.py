"""Shared helper to verify notebook hashes and sync status."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
import nbformat

EXPORT_RE = re.compile(r"^\s*#\|\s*export\s+([A-Za-z_][A-Za-z0-9_]*)\s*$")


def get_notebook_sha(path: Path) -> str:
    nb = nbformat.read(path, as_version=4)
    h = hashlib.sha256()
    for cell in nb.cells:
        if cell.cell_type == "code" and EXPORT_RE.match(cell.source.splitlines()[0] if cell.source else ""):
            h.update(cell.source.encode("utf-8"))
            h.update(b"\x00")
    return h.hexdigest()


def check_sync(root_dir: Path) -> tuple[bool, str]:
    nb_dir = root_dir / "notebooks"
    out_dir = root_dir / "backend" / "app" / "ml_core"
    manifest_path = out_dir / "exported_manifest.json"

    if not manifest_path.exists():
        return False, "exported_manifest.json missing"

    try:
        saved = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as e:
        return False, f"corrupt manifest: {e}"

    for nb_path in sorted(nb_dir.glob("0*.ipynb")):
        expected_sha = saved.get("notebooks", {}).get(nb_path.name)
        actual_sha = get_notebook_sha(nb_path)
        if expected_sha != actual_sha:
            return False, f"Notebook {nb_path.name} is out of sync"

    for mod, info in saved.get("modules", {}).items():
        f = out_dir / info["file"]
        if not f.exists():
            return False, f"Exported file {info['file']} is missing"
        actual_f_sha = hashlib.sha256(f.read_bytes()).hexdigest()
        if actual_f_sha != info["file_sha"]:
            return False, f"Exported file {info['file']} content checksum mismatch"

    return True, "in sync"

