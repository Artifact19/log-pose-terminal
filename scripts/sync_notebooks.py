#!/usr/bin/env python
"""Extract `#| export <module>` cells from notebooks into backend/app/ml_core/exported_<module>.py.

Usage:
  python scripts/sync_notebooks.py            # one-shot sync
  python scripts/sync_notebooks.py --check    # exit 1 if exports are stale (CI / startup)
  python scripts/sync_notebooks.py --watch    # poll notebooks, resync on change
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
import time
from pathlib import Path

import nbformat

ROOT = Path(__file__).resolve().parent.parent
NB_DIR = ROOT / "notebooks"
OUT_DIR = ROOT / "backend" / "app" / "ml_core"
MANIFEST = OUT_DIR / "exported_manifest.json"
EXPORT_RE = re.compile(r"^\s*#\|\s*export\s+([A-Za-z_][A-Za-z0-9_]*)\s*$")
VALID_MODULES = {"features", "model", "uncertainty"}

HEADER = '''"""AUTO-GENERATED from {nb} by scripts/sync_notebooks.py. DO NOT EDIT.
Source notebook sha256: {sha}
Edit the notebook, then run: python scripts/sync_notebooks.py
"""
# ruff: noqa
'''


def notebook_sha(path: Path) -> str:
    """Hash only code-cell sources of exported cells, so output/metadata churn doesn't invalidate."""
    nb = nbformat.read(path, as_version=4)
    h = hashlib.sha256()
    for cell in nb.cells:
        if cell.cell_type == "code" and EXPORT_RE.match(cell.source.splitlines()[0] if cell.source else ""):
            h.update(cell.source.encode("utf-8"))
            h.update(b"\x00")
    return h.hexdigest()


def extract(path: Path) -> dict[str, list[str]]:
    nb = nbformat.read(path, as_version=4)
    modules: dict[str, list[str]] = {}
    for idx, cell in enumerate(nb.cells):
        if cell.cell_type != "code" or not cell.source.strip():
            continue
        lines = cell.source.splitlines()
        m = EXPORT_RE.match(lines[0])
        if not m:
            continue
        mod = m.group(1)
        if mod not in VALID_MODULES:
            raise ValueError(f"{path.name} cell {idx}: unknown export module '{mod}'")
        body = "\n".join(lines[1:]).rstrip() + "\n"
        # Drop IPython magics so the exported file is plain Python.
        body = "\n".join(l for l in body.splitlines() if not l.lstrip().startswith(("%", "!"))) + "\n"
        try:
            ast.parse(body)
        except SyntaxError as e:
            raise SyntaxError(f"{path.name} cell {idx} is not valid Python: {e}") from e
        modules.setdefault(mod, []).append(f"# --- {path.name} :: cell {idx} ---\n{body}")
    return modules


def sync() -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"notebooks": {}, "modules": {}}
    per_module: dict[str, list[str]] = {}
    src_of: dict[str, str] = {}
    for nb_path in sorted(NB_DIR.glob("0*.ipynb")):
        sha = notebook_sha(nb_path)
        manifest["notebooks"][nb_path.name] = sha
        for mod, chunks in extract(nb_path).items():
            per_module.setdefault(mod, []).extend(chunks)
            src_of[mod] = nb_path.name
    missing = VALID_MODULES - set(per_module)
    if missing:
        raise RuntimeError(f"No export cells found for modules: {sorted(missing)}")
    for mod, chunks in per_module.items():
        nb_name = src_of[mod]
        text = HEADER.format(nb=nb_name, sha=manifest["notebooks"][nb_name]) + "\n\n".join(chunks)
        out = OUT_DIR / f"exported_{mod}.py"
        out.write_text(text, encoding="utf-8", newline="\n")
        manifest["modules"][mod] = {
            "file": out.name,
            "source_notebook": nb_name,
            "notebook_sha": manifest["notebooks"][nb_name],
            "file_sha": hashlib.sha256(out.read_bytes()).hexdigest(),
        }
    # Combined hash identifying the full methodology; stored on ModelVersion.notebook_hash
    combined = hashlib.sha256("".join(manifest["notebooks"][k] for k in sorted(manifest["notebooks"])).encode())
    manifest["combined_notebook_hash"] = combined.hexdigest()
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[sync] OK combined_hash={manifest['combined_notebook_hash'][:12]}")
    return manifest


def check() -> bool:
    """True if exported files are in sync with notebooks."""
    if not MANIFEST.exists():
        print("[sync] manifest missing")
        return False
    saved = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for nb_path in sorted(NB_DIR.glob("0*.ipynb")):
        if saved["notebooks"].get(nb_path.name) != notebook_sha(nb_path):
            print(f"[sync] STALE: {nb_path.name}")
            return False
    for mod, info in saved["modules"].items():
        f = OUT_DIR / info["file"]
        if not f.exists() or hashlib.sha256(f.read_bytes()).hexdigest() != info["file_sha"]:
            print(f"[sync] TAMPERED/MISSING: {info['file']}")
            return False
    return True


def watch(interval: float = 1.5) -> None:
    print("[sync] watching notebooks/ (Ctrl+C to stop)")
    last = {}
    while True:
        cur = {p.name: p.stat().st_mtime for p in NB_DIR.glob("0*.ipynb")}
        if cur != last:
            try:
                sync()
            except Exception as e:  # keep watching on a broken cell
                print(f"[sync] ERROR: {e}")
            last = cur
        time.sleep(interval)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--watch", action="store_true")
    a = ap.parse_args()
    if a.check:
        sys.exit(0 if check() else 1)
    if a.watch:
        watch()
    else:
        sync()
