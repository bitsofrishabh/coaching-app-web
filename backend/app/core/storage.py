import logging
import mimetypes
from pathlib import Path
from typing import Optional

import requests

from app.core.config import EMERGENT_KEY, ROOT_DIR, STORAGE_URL


logger = logging.getLogger(__name__)
LOCAL_STORAGE_ROOT = ROOT_DIR / "local_uploads"
MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "pdf": "application/pdf",
}

_storage_key: Optional[str] = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set, using local file storage fallback")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as exc:
        logger.error("Storage init failed: %s", exc)
        return None


def _local_object_path(path: str) -> Path:
    return LOCAL_STORAGE_ROOT / path


def _ensure_local_parent(path: str) -> Path:
    full_path = _local_object_path(path)
    full_path.parent.mkdir(parents=True, exist_ok=True)
    return full_path


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        local_path = _ensure_local_parent(path)
        local_path.write_bytes(data)
        return {"path": path, "size": len(data), "content_type": content_type, "storage": "local"}
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    local_path = _local_object_path(path)
    if local_path.exists():
        data = local_path.read_bytes()
        guessed_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
        return data, guessed_type
    key = init_storage()
    if not key:
        raise RuntimeError("Storage not available")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

