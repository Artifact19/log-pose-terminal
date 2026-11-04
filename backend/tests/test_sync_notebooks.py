import json
import shutil
from pathlib import Path
import nbformat
import pytest
from scripts.sync_notebooks import sync, check, notebook_sha, MANIFEST, OUT_DIR, NB_DIR


def test_sync_produces_files_and_manifest():
    manifest = sync()
    assert MANIFEST.exists()
    assert (OUT_DIR / "exported_features.py").exists()
    assert (OUT_DIR / "exported_model.py").exists()
    assert (OUT_DIR / "exported_uncertainty.py").exists()
    assert check() is True


def test_tampering_fails_check():
    sync()
    f = OUT_DIR / "exported_features.py"
    orig = f.read_text(encoding="utf-8")
    try:
        f.write_text(orig + "\n# Tampered", encoding="utf-8")
        assert check() is False
    finally:
        f.write_text(orig, encoding="utf-8")
        sync()

