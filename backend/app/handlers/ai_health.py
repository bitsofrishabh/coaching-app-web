import os
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from fastapi import HTTPException

from services.ai.openai_client import OpenAIAPIError
from services.ai.health_analysis import generate_client_health_analysis


VisibleClientGetter = Callable[[str, dict, Optional[Dict[str, int]]], Awaitable[Optional[dict]]]
VisibleOwnerIdsGetter = Callable[[dict], List[str]]
AuditWriter = Callable[..., Awaitable[None]]
FileSerializer = Callable[[dict], Any]
StoredFileTextExtractor = Callable[[dict], str]


async def get_health_analysis_handler(
    *,
    db,
    client_id: str,
    user: dict,
    get_visible_client: VisibleClientGetter,
) -> dict:
    client_record = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client_record:
        raise HTTPException(status_code=404, detail="Client not found")

    analysis_doc = await db.client_ai_analyses.find_one(
        {"client_id": client_id, "analysis_type": "health-analysis"},
        {"_id": 0},
    )
    if not analysis_doc:
        raise HTTPException(status_code=404, detail="AI health analysis not found")

    return analysis_doc


async def generate_health_analysis_handler(
    *,
    db,
    client_id: str,
    user: dict,
    get_visible_client: VisibleClientGetter,
    visible_client_owner_ids: VisibleOwnerIdsGetter,
    extract_text_from_stored_file_record: StoredFileTextExtractor,
    serialize_file_record: FileSerializer,
    write_audit_log: AuditWriter,
) -> dict:
    client_record = await get_visible_client(client_id, user, {"_id": 0})
    if not client_record:
        raise HTTPException(status_code=404, detail="Client not found")

    source_records = await db.files.find(
        {
            "coach_id": {"$in": visible_client_owner_ids(user)},
            "client_id": client_id,
            "is_deleted": False,
            "category": {"$in": ["blood-report", "past-diet"]},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)

    latest_blood_report = next((record for record in source_records if record.get("category") == "blood-report"), None)
    latest_past_diet = next((record for record in source_records if record.get("category") == "past-diet"), None)

    if not latest_blood_report and not latest_past_diet:
        raise HTTPException(status_code=400, detail="Upload a blood report or past diet PDF before generating AI health analysis")

    try:
        blood_report_text = extract_text_from_stored_file_record(latest_blood_report) if latest_blood_report else ""
        past_diet_text = extract_text_from_stored_file_record(latest_past_diet) if latest_past_diet else ""
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read uploaded files: {exc}")

    if not (blood_report_text or "").strip() and not (past_diet_text or "").strip():
        raise HTTPException(status_code=400, detail="The uploaded files do not contain extractable text yet. Use text-based PDFs first.")

    try:
        analysis_payload = generate_client_health_analysis(
            client=client_record,
            blood_report_text=blood_report_text,
            past_diet_text=past_diet_text,
            model=os.environ.get("OPENAI_MODEL"),
        )
    except OpenAIAPIError as exc:
        detail = str(exc)
        status_code = 503 if "OPENAI_API_KEY" in detail else 502
        raise HTTPException(status_code=status_code, detail=detail)

    now = datetime.now(timezone.utc).isoformat()
    source_file_records = []
    for record in [latest_blood_report, latest_past_diet]:
        if not record:
            continue
        serialized_record = serialize_file_record(record)
        source_file_records.append(
            serialized_record.model_dump() if hasattr(serialized_record, "model_dump") else serialized_record.dict()
        )

    analysis_doc = {
        "client_id": client_id,
        "analysis_type": "health-analysis",
        **analysis_payload,
        "source_files": source_file_records,
        "source_file_ids": [record["id"] for record in [latest_blood_report, latest_past_diet] if record],
        "model": os.environ.get("OPENAI_MODEL", "gpt-4o"),
        "generated_at": now,
        "generated_by_name": user.get("name"),
        "generated_by_id": user.get("id"),
        "updated_at": now,
    }
    await db.client_ai_analyses.update_one(
        {"client_id": client_id, "analysis_type": "health-analysis"},
        {"$set": analysis_doc},
        upsert=True,
    )

    await write_audit_log(
        user=user,
        event_type="ai-health-analysis-generated",
        entity_type="ai-analysis",
        entity_id=client_id,
        client_id=client_id,
        summary=f"Generated AI health analysis for {client_record.get('name', 'client')}",
        metadata={
            "source_file_ids": analysis_doc["source_file_ids"],
            "model": analysis_doc["model"],
        },
    )

    return analysis_doc
