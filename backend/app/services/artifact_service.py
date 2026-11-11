from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from backend.app.config import settings

logger = logging.getLogger("artifact_service")


class ArtifactService:
    def __init__(self):
        self._supabase_client = None

    def _get_client(self):
        if self._supabase_client is not None:
            return self._supabase_client
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                from supabase import create_client
                self._supabase_client = create_client(
                    settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
                )
                return self._supabase_client
            except Exception as e:
                logger.warning(f"Could not initialize Supabase Storage client: {e}")
                return None
        return None

    def upload_artifact(self, ticker: str, version_tag: str, local_path: Path | str) -> str:
        """Uploads bundle.joblib to Supabase Storage at {TICKER}/{version_tag}/bundle.joblib.

        Returns the storage key (or local path if storage is unconfigured).
        """
        p = Path(local_path)
        storage_key = f"{ticker.upper()}/{version_tag}/bundle.joblib"
        client = self._get_client()

        if client and p.exists():
            try:
                with open(p, "rb") as f:
                    file_bytes = f.read()
                # Upsert into ARTIFACT_BUCKET
                client.storage.from_(settings.ARTIFACT_BUCKET).upload(
                    path=storage_key,
                    file=file_bytes,
                    file_options={"upsert": "true", "content-type": "application/octet-stream"},
                )
                logger.info(f"Uploaded model artifact to storage bucket '{settings.ARTIFACT_BUCKET}': {storage_key}")
                return storage_key
            except Exception as e:
                logger.warning(f"Supabase storage upload failed for {storage_key}: {e}. Keeping local path.")
                return str(p)

        return str(p)

    def ensure_local_artifact(
        self, ticker: str, version_tag: str, artifact_path: str
    ) -> Path:
        """Ensures that the artifact is accessible on the local filesystem.

        If artifact_path is a local path and exists, returns it. Otherwise,
        attempts to download from Supabase Storage into CACHE_DIR.
        """
        local_p = Path(artifact_path)
        if local_p.is_file():
            return local_p

        # Check local cache directory
        cache_dest = Path(settings.CACHE_DIR) / ticker.upper() / version_tag / "bundle.joblib"
        if cache_dest.is_file():
            return cache_dest

        # Attempt download from Supabase Storage
        storage_key = (
            artifact_path
            if "/" in artifact_path and not artifact_path.startswith(".")
            else f"{ticker.upper()}/{version_tag}/bundle.joblib"
        )

        client = self._get_client()
        if client:
            try:
                logger.info(f"Downloading model artifact from bucket '{settings.ARTIFACT_BUCKET}': {storage_key}")
                data = client.storage.from_(settings.ARTIFACT_BUCKET).download(storage_key)
                cache_dest.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_dest, "wb") as f:
                    f.write(data)
                return cache_dest
            except Exception as e:
                logger.warning(f"Failed to download artifact {storage_key} from Supabase: {e}")

        return local_p


artifact_service = ArtifactService()
