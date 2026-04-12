import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from fastapi import HTTPException, Response, UploadFile

from app.core.config import APP_NAME, SHARED_CLIENT_OWNER_ID
from app.core.storage import MIME_TYPES, get_object, put_object


VisibleClientGetter = Callable[[str, dict, Optional[Dict[str, int]]], Awaitable[Optional[dict]]]
VisibleOwnerIdsGetter = Callable[[dict], List[str]]


async def upload_file_handler(
    *,
    db,
    file: UploadFile,
    client_id: Optional[str],
    category: str,
    user: dict,
    get_visible_client: VisibleClientGetter,
) -> Dict[str, Any]:
    owner_id = user["id"]
    if client_id:
        client_record = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
        if not client_record:
            raise HTTPException(status_code=404, detail="Client not found")
        owner_id = SHARED_CLIENT_OWNER_ID

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    path = f"{APP_NAME}/uploads/{owner_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")

    result = put_object(path, data, content_type)

    file_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    file_doc = {
        "id": file_id,
        "coach_id": owner_id,
        "client_id": client_id,
        "category": category,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now,
    }
    await db.files.insert_one(file_doc)

    return {"id": file_id, "path": result["path"], "filename": file.filename}


async def list_files_handler(
    *,
    db,
    client_id: Optional[str],
    category: Optional[str],
    limit: int,
    user: dict,
    get_visible_client: VisibleClientGetter,
    visible_client_owner_ids: VisibleOwnerIdsGetter,
) -> List[dict]:
    if client_id:
        client_record = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
        if not client_record:
            raise HTTPException(status_code=404, detail="Client not found")

    query: Dict[str, Any] = {
        "coach_id": {"$in": visible_client_owner_ids(user)},
        "is_deleted": False,
    }
    if client_id:
        query["client_id"] = client_id
    if category:
        query["category"] = category

    return await db.files.find(
        query,
        {"_id": 0, "id": 1, "client_id": 1, "category": 1, "original_filename": 1, "content_type": 1, "size": 1, "created_at": 1},
    ).sort("created_at", -1).limit(limit).to_list(limit)


async def get_file_handler(
    *,
    db,
    file_id: str,
    user: dict,
    visible_client_owner_ids: VisibleOwnerIdsGetter,
) -> Response:
    record = await db.files.find_one(
        {"id": file_id, "coach_id": {"$in": visible_client_owner_ids(user)}, "is_deleted": False},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    data, content_type = get_object(record["storage_path"])
    return Response(content=data, media_type=record.get("content_type", content_type))

