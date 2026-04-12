import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from fastapi import Depends, File, HTTPException, UploadFile

from app.core.config import SHARED_CLIENT_OWNER_ID, TRACKER_ACTIVITY_ORDER
from app.schemas.tracking import (
    ClientCommentCreate,
    ClientCommentResponse,
    ClientWeightSummaryEntry,
    ClientWeightSummaryResponse,
    TrackerActivityUpdateRequest,
    TrackerDayResponse,
    TrackerMonthResponse,
    WeightEntryCreate,
    WeightEntryResponse,
    WeightEntryUpsertRequest,
    WeightImportParseResponse,
    WeightImportSaveRequest,
    WeightImportSaveResponse,
    WeightImportTextRequest,
)


VisibleClientGetter = Callable[[str, dict, Optional[Dict[str, int]]], Awaitable[Optional[dict]]]
VisibleClientsQueryBuilder = Callable[[dict, Optional[Dict[str, Any]]], Dict[str, Any]]
WeightDateParser = Callable[[Any, Optional[int]], Optional[str]]
WeightImportParser = Callable[[str, str], WeightImportParseResponse]
WeightImportSanitizer = Callable[[List[dict], Optional[int]], List[Any]]
TrackerActivityExtractor = Callable[[Optional[List[dict]]], Dict[str, bool]]
TrackerActivityNormalizer = Callable[[Optional[str]], Optional[str]]


async def get_client_weight_summaries_handler(
    *,
    db,
    entries: int,
    user: dict,
    visible_clients_query: VisibleClientsQueryBuilder,
) -> List[ClientWeightSummaryResponse]:
    entries = max(2, min(entries, 30))
    client_rows = await db.clients.find(visible_clients_query(user), {"_id": 0, "id": 1}).to_list(1000)
    client_ids = [client["id"] for client in client_rows if client.get("id")]
    if not client_ids:
        return []

    grouped_entries: Dict[str, List[dict]] = {client_id: [] for client_id in client_ids}
    cursor = db.weight_entries.find(
        {"client_id": {"$in": client_ids}},
        {"_id": 0, "client_id": 1, "recorded_date": 1, "weight_kg": 1},
    ).sort([("client_id", 1), ("recorded_date", -1)])

    async for entry in cursor:
        client_id = entry.get("client_id")
        if not client_id or client_id not in grouped_entries:
            continue
        if len(grouped_entries[client_id]) >= entries:
            continue
        grouped_entries[client_id].append(
            {
                "recorded_date": entry.get("recorded_date"),
                "weight_kg": entry.get("weight_kg"),
            }
        )

    summaries = []
    for client_id in client_ids:
        client_entries = grouped_entries.get(client_id, [])
        latest_weight = client_entries[0]["weight_kg"] if client_entries else None
        oldest_weight = client_entries[-1]["weight_kg"] if len(client_entries) >= 2 else None
        delta_kg = (latest_weight - oldest_weight) if latest_weight is not None and oldest_weight is not None else None
        summaries.append(
            ClientWeightSummaryResponse(
                client_id=client_id,
                delta_kg=delta_kg,
                latest_weight_kg=latest_weight,
                oldest_weight_kg=oldest_weight,
                entries=[ClientWeightSummaryEntry(**entry) for entry in client_entries],
            )
        )
    return summaries


async def get_client_comments_handler(
    *,
    db,
    client_id: str,
    limit: int,
    user: dict,
    get_visible_client: VisibleClientGetter,
) -> List[ClientCommentResponse]:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    comments = await db.client_comments.find({"client_id": client_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [ClientCommentResponse(**comment) for comment in comments]


async def add_client_comment_handler(
    *,
    db,
    client_id: str,
    data: ClientCommentCreate,
    user: dict,
    get_visible_client: VisibleClientGetter,
) -> ClientCommentResponse:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    content = (data.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    now = datetime.now(timezone.utc).isoformat()
    comment_doc = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "coach_id": user["id"],
        "author_id": user["id"],
        "author_name": user.get("name") or "Coach",
        "author_role": user.get("role"),
        "content": content,
        "created_at": now,
    }
    await db.client_comments.insert_one(comment_doc)
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"recent_comment": content, "updated_at": now}},
    )
    return ClientCommentResponse(**comment_doc)


async def get_weight_entries_handler(
    *,
    db,
    client_id: str,
    limit: int,
    user: dict,
    get_visible_client: VisibleClientGetter,
) -> List[WeightEntryResponse]:
    client = await get_visible_client(client_id, user)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    entries = await db.weight_entries.find({"client_id": client_id}, {"_id": 0}).sort("recorded_date", -1).limit(limit).to_list(limit)
    return [WeightEntryResponse(**entry) for entry in entries]


async def add_weight_entry_handler(
    *,
    db,
    client_id: str,
    data: WeightEntryCreate,
    user: dict,
    get_visible_client: VisibleClientGetter,
) -> WeightEntryResponse:
    client = await get_visible_client(client_id, user)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    entry_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    entry_doc = {
        "id": entry_id,
        "client_id": client_id,
        "weight_kg": data.weight_kg,
        "recorded_date": data.recorded_date or now[:10],
        "notes": data.notes,
        "created_at": now,
    }
    await db.weight_entries.insert_one(entry_doc)
    await db.clients.update_one({"id": client_id}, {"$set": {"current_weight_kg": data.weight_kg, "updated_at": now}})
    return WeightEntryResponse(**entry_doc)


async def upsert_weight_entry_by_date_handler(
    *,
    db,
    client_id: str,
    data: WeightEntryUpsertRequest,
    user: dict,
    get_visible_client: VisibleClientGetter,
    parse_weight_date: WeightDateParser,
) -> WeightEntryResponse:
    client = await get_visible_client(client_id, user)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    recorded_date = parse_weight_date(data.recorded_date)
    if not recorded_date:
        raise HTTPException(status_code=400, detail="Invalid recorded_date")

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.weight_entries.find_one({"client_id": client_id, "recorded_date": recorded_date}, {"_id": 0})

    if existing:
        update_payload = {
            "weight_kg": data.weight_kg,
            "notes": data.notes if data.notes is not None else existing.get("notes"),
        }
        await db.weight_entries.update_one(
            {"id": existing["id"], "client_id": client_id},
            {"$set": update_payload},
        )
        entry_doc = {**existing, **update_payload}
    else:
        entry_doc = {
            "id": str(uuid.uuid4()),
            "client_id": client_id,
            "weight_kg": data.weight_kg,
            "recorded_date": recorded_date,
            "notes": data.notes,
            "created_at": now,
        }
        await db.weight_entries.insert_one(entry_doc)

    latest_entry = await db.weight_entries.find({"client_id": client_id}, {"_id": 0, "weight_kg": 1}).sort("recorded_date", -1).to_list(1)
    latest_weight = latest_entry[0].get("weight_kg") if latest_entry else data.weight_kg
    await db.clients.update_one({"id": client_id}, {"$set": {"current_weight_kg": latest_weight, "updated_at": now}})
    return WeightEntryResponse(**entry_doc)


async def parse_weight_upload_handler(
    *,
    client_id: str,
    file: UploadFile,
    user: dict,
    get_visible_client: VisibleClientGetter,
    extract_text_from_weight_upload,
    parse_weight_import_payload: WeightImportParser,
) -> WeightImportParseResponse:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    filename = file.filename or "weight-upload"
    extracted_text = extract_text_from_weight_upload(file_bytes, filename, file.content_type)
    return parse_weight_import_payload(extracted_text, filename)


async def parse_weight_text_handler(
    *,
    client_id: str,
    payload: WeightImportTextRequest,
    user: dict,
    get_visible_client: VisibleClientGetter,
    parse_weight_import_payload: WeightImportParser,
) -> WeightImportParseResponse:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    raw_text = (payload.raw_text or "").strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Paste weight data before parsing")

    return parse_weight_import_payload(raw_text, "pasted-weight-data.txt")


async def save_bulk_weight_entries_handler(
    *,
    db,
    client_id: str,
    payload: WeightImportSaveRequest,
    user: dict,
    get_visible_client: VisibleClientGetter,
    sanitize_weight_import_entries: WeightImportSanitizer,
) -> WeightImportSaveResponse:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    entries = sanitize_weight_import_entries([entry.model_dump() for entry in payload.entries])
    if not entries:
        raise HTTPException(status_code=400, detail="At least one valid weight entry is required")

    saved_entries = 0
    updated_entries = 0
    now = datetime.now(timezone.utc).isoformat()

    for entry in entries:
        existing = await db.weight_entries.find_one(
            {"client_id": client_id, "recorded_date": entry.recorded_date},
            {"_id": 0, "id": 1},
        )
        if existing:
            update_payload = {
                "weight_kg": entry.weight_kg,
                "notes": entry.notes,
            }
            if entry.mapped_fields:
                update_payload["mapped_fields"] = entry.mapped_fields
            await db.weight_entries.update_one(
                {"id": existing["id"], "client_id": client_id},
                {"$set": update_payload},
            )
            updated_entries += 1
            continue

        entry_doc = {
            "id": str(uuid.uuid4()),
            "client_id": client_id,
            "weight_kg": entry.weight_kg,
            "recorded_date": entry.recorded_date,
            "notes": entry.notes,
            "mapped_fields": entry.mapped_fields or {},
            "created_at": now,
        }
        await db.weight_entries.insert_one(entry_doc)
        saved_entries += 1

    latest_entry = max(entries, key=lambda item: item.recorded_date)
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"current_weight_kg": latest_entry.weight_kg, "updated_at": now}},
    )

    return WeightImportSaveResponse(
        saved_entries=saved_entries,
        updated_entries=updated_entries,
        latest_weight_kg=latest_entry.weight_kg,
    )


async def get_client_monthly_tracker_handler(
    *,
    db,
    client_id: str,
    month: Optional[str],
    user: dict,
    get_visible_client: VisibleClientGetter,
    extract_tracker_activities: TrackerActivityExtractor,
) -> TrackerMonthResponse:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    month_value = month or datetime.now(timezone.utc).strftime("%Y-%m")
    import re
    if not re.fullmatch(r"\d{4}-\d{2}", month_value):
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")

    checkins = await db.daily_checkins.find(
        {"client_id": client_id, "date": {"$regex": f"^{month_value}"}},
        {"_id": 0, "date": 1, "meals": 1},
    ).sort("date", 1).to_list(100)

    return TrackerMonthResponse(
        entries=[
            TrackerDayResponse(
                date=checkin.get("date"),
                activities=extract_tracker_activities(checkin.get("meals")),
            )
            for checkin in checkins
            if checkin.get("date")
        ]
    )


async def upsert_client_tracker_activity_handler(
    *,
    db,
    client_id: str,
    data: TrackerActivityUpdateRequest,
    user: dict,
    get_visible_client: VisibleClientGetter,
    parse_weight_date: WeightDateParser,
    normalize_tracker_activity_name: TrackerActivityNormalizer,
) -> Dict[str, Any]:
    client = await get_visible_client(client_id, user, {"_id": 0, "id": 1, "coach_id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    tracker_date = parse_weight_date(data.date)
    if not tracker_date:
        raise HTTPException(status_code=400, detail="Invalid date")

    activity_name = normalize_tracker_activity_name(data.activity_name)
    if not activity_name:
        raise HTTPException(status_code=400, detail="Unsupported activity_name")

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.daily_checkins.find_one({"client_id": client_id, "date": tracker_date}, {"_id": 0})

    meal_map: Dict[str, dict] = {}
    extra_meals: List[dict] = []
    for meal in (existing or {}).get("meals", []):
        normalized_name = normalize_tracker_activity_name(meal.get("meal_name"))
        if normalized_name:
            meal_map[normalized_name] = {**meal, "meal_name": normalized_name}
        else:
            extra_meals.append(meal)

    meal_map[activity_name] = {"meal_name": activity_name, "completed": data.completed}
    tracker_meals = [meal_map[key] for key in TRACKER_ACTIVITY_ORDER if key in meal_map]
    adherence_score = (
        sum(1 for key in TRACKER_ACTIVITY_ORDER if meal_map.get(key, {}).get("completed")) / len(TRACKER_ACTIVITY_ORDER)
    ) * 100

    checkin_doc = {
        "client_id": client_id,
        "coach_id": client.get("coach_id") or SHARED_CLIENT_OWNER_ID,
        "date": tracker_date,
        "meals": tracker_meals + extra_meals,
        "water_glasses": (existing or {}).get("water_glasses", 0),
        "mood": (existing or {}).get("mood"),
        "notes": (existing or {}).get("notes"),
        "adherence_score": adherence_score,
        "updated_at": now,
    }

    if existing:
        await db.daily_checkins.update_one({"id": existing["id"]}, {"$set": checkin_doc})
    else:
        checkin_doc["id"] = str(uuid.uuid4())
        checkin_doc["created_at"] = now
        await db.daily_checkins.insert_one(checkin_doc)

    all_checkins = await db.daily_checkins.find({"client_id": client_id}, {"_id": 0, "adherence_score": 1}).to_list(200)
    if all_checkins:
        avg_adherence = sum(checkin.get("adherence_score", 0) for checkin in all_checkins) / len(all_checkins)
        await db.clients.update_one(
            {"id": client_id},
            {"$set": {"adherence_rate": avg_adherence, "updated_at": now}},
        )

    return {
        "date": tracker_date,
        "activity_name": activity_name,
        "completed": data.completed,
        "adherence_score": adherence_score,
    }
