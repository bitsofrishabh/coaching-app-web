from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Query, Header, Response, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import asyncio
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import io
import re
import csv
import json
import hashlib
import jwt
import bcrypt
import requests
from app.core.config import (
    ADMIN_ROLES,
    APP_NAME,
    JWT_ALGORITHM,
    JWT_EXPIRATION_HOURS,
    JWT_SECRET,
    LEGACY_ROLE_COACH,
    ROLE_ADMIN,
    ROLE_CLIENT,
    ROLE_DIETITIAN,
    ROLE_SUPER_ADMIN,
    SHARED_CLIENT_OWNER_ID,
    STAFF_ROLES,
    SUPER_ADMIN_ROLES,
    TRACKER_ACTIVITY_ALIASES,
    TRACKER_ACTIVITY_ORDER,
    client,
    db,
    mongo_url,
)
from app.core.storage import get_object, init_storage, put_object
from app.core.nutrition import (
    calculate_maintenance_calories,
    get_estimated_protein_target_g,
    get_recommended_daily_deficit,
    get_target_daily_calories,
)
from app.handlers.ai_health import generate_health_analysis_handler, get_health_analysis_handler
from app.handlers.files import get_file_handler, list_files_handler, upload_file_handler
from app.handlers.tracking import (
    add_client_comment_handler,
    add_weight_entry_handler,
    get_client_comments_handler,
    get_client_monthly_tracker_handler,
    get_client_weight_summaries_handler,
    get_weight_entries_handler,
    parse_weight_text_handler,
    parse_weight_upload_handler,
    save_bulk_weight_entries_handler,
    upsert_client_tracker_activity_handler,
    upsert_weight_entry_by_date_handler,
)
from app.schemas.tracking import (
    ClientCommentCreate,
    ClientCommentResponse,
    ClientWeightSummaryResponse,
    TrackerActivityUpdateRequest,
    TrackerMonthResponse,
    WeightEntryCreate,
    WeightImportEntry,
    WeightEntryResponse,
    WeightEntryUpsertRequest,
    WeightImportParseResponse,
    WeightImportSaveRequest,
    WeightImportSaveResponse,
    WeightImportTextRequest,
)
from services.ai.openai_client import OpenAIAPIError, get_default_model
from services.ai.diet_plan_ai import generate_diet_plan_analysis, generate_diet_plan_suggestions
from services.ai.client_business_ai import classify_client_operations_query, generate_client_business_analysis

# Create the main app
app = FastAPI(title="DietTracker Pro API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

# Auth Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "coach"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class StaffMemberCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str = ROLE_DIETITIAN


class StaffMemberUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class StaffMemberResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    status: str
    user_id: Optional[str] = None
    assigned_client_ids: List[str] = Field(default_factory=list)
    assigned_client_count: int = 0
    created_at: str
    updated_at: str


class StaffAssignClientsRequest(BaseModel):
    client_ids: List[str] = Field(default_factory=list)

# Client Models
class ClientCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    diet_preference: Optional[str] = None
    primary_coach_id: Optional[str] = None
    primary_coach: Optional[str] = None
    height_cm: Optional[float] = None
    initial_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    status: str = "active"
    notes: Optional[str] = None
    about_client: Optional[str] = None
    health_issues: Optional[str] = None
    recent_comment: Optional[str] = None
    diet_start_date: Optional[str] = None
    diet_end_date: Optional[str] = None
    diet_duration: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None
    program_duration: Optional[str] = None
    pause_days: Optional[int] = None
    last_follow_up_date: Optional[str] = None
    upcoming_follow_up_date: Optional[str] = None
    sleep_quality: Optional[str] = None
    sleep_hours: Optional[str] = None
    morning_freshness: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    avoid_foods: List[str] = Field(default_factory=list)
    preferred_foods: List[str] = Field(default_factory=list)
    disliked_foods: List[str] = Field(default_factory=list)
    medical_food_restrictions: List[str] = Field(default_factory=list)

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    diet_preference: Optional[str] = None
    primary_coach_id: Optional[str] = None
    primary_coach: Optional[str] = None
    height_cm: Optional[float] = None
    initial_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    about_client: Optional[str] = None
    health_issues: Optional[str] = None
    recent_comment: Optional[str] = None
    diet_start_date: Optional[str] = None
    diet_end_date: Optional[str] = None
    diet_duration: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None
    program_duration: Optional[str] = None
    pause_days: Optional[int] = None
    last_follow_up_date: Optional[str] = None
    upcoming_follow_up_date: Optional[str] = None
    sleep_quality: Optional[str] = None
    sleep_hours: Optional[str] = None
    morning_freshness: Optional[str] = None
    allergies: Optional[List[str]] = None
    avoid_foods: Optional[List[str]] = None
    preferred_foods: Optional[List[str]] = None
    disliked_foods: Optional[List[str]] = None
    medical_food_restrictions: Optional[List[str]] = None

class ClientResponse(BaseModel):
    id: str
    coach_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    diet_preference: Optional[str] = None
    primary_coach_id: Optional[str] = None
    primary_coach: Optional[str] = None
    height_cm: Optional[float] = None
    initial_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    status: str
    notes: Optional[str] = None
    about_client: Optional[str] = None
    health_issues: Optional[str] = None
    recent_comment: Optional[str] = None
    diet_start_date: Optional[str] = None
    diet_end_date: Optional[str] = None
    diet_duration: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None
    program_duration: Optional[str] = None
    pause_days: Optional[int] = None
    last_follow_up_date: Optional[str] = None
    upcoming_follow_up_date: Optional[str] = None
    sleep_quality: Optional[str] = None
    sleep_hours: Optional[str] = None
    morning_freshness: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    avoid_foods: List[str] = Field(default_factory=list)
    preferred_foods: List[str] = Field(default_factory=list)
    disliked_foods: List[str] = Field(default_factory=list)
    medical_food_restrictions: List[str] = Field(default_factory=list)
    adherence_rate: Optional[float] = None
    created_at: str
    updated_at: str


LEAD_STATUSES = {
    "new",
    "call-booked",
    "consultation-done",
    "follow-up",
    "plan-next-month",
    "converted",
    "lost",
}

LEGACY_LEAD_STATUS_MAP = {
    "contacted": "call-booked",
    "consultation-booked": "consultation-done",
}


class LeadCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    source: Optional[str] = None
    status: str = "new"
    notes: Optional[str] = None
    last_contacted_date: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    last_contacted_date: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    coach_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    source: Optional[str] = None
    status: str
    notes: Optional[str] = None
    last_contacted_date: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    assigned_to: Optional[str] = None
    converted_client_id: Optional[str] = None
    created_at: str
    updated_at: str

# Weight Entry Models
class FileRecordResponse(BaseModel):
    id: str
    client_id: Optional[str] = None
    category: str
    original_filename: str
    content_type: Optional[str] = None
    size: Optional[int] = None
    created_at: str


class AIInsightItemResponse(BaseModel):
    label: str
    severity: str
    reason: str


class ClientAIHealthAnalysisResponse(BaseModel):
    client_id: str
    overall_summary: str
    clinical_risks: List[AIInsightItemResponse] = Field(default_factory=list)
    nutrition_gaps: List[AIInsightItemResponse] = Field(default_factory=list)
    diet_pattern_observations: List[str] = Field(default_factory=list)
    recommended_adjustments: List[str] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    confidence_notes: List[str] = Field(default_factory=list)
    source_files: List[FileRecordResponse] = Field(default_factory=list)
    model: str
    generated_at: str
    generated_by_name: Optional[str] = None


class ClientAIBusinessAnalysisRequest(BaseModel):
    prompt: Optional[str] = None
    status_filters: List[str] = Field(default_factory=list)
    search: Optional[str] = None
    limit: int = 100


class ClientAIPriorityClientResponse(BaseModel):
    client_id: str
    name: str
    priority: str
    reason: str
    next_action: str


class ClientAIBusinessAnalysisResponse(BaseModel):
    analysis_id: str
    model: str
    generated_at: str
    client_count: int
    executive_summary: str
    priority_clients: List[ClientAIPriorityClientResponse] = Field(default_factory=list)
    cohort_observations: List[str] = Field(default_factory=list)
    retention_risks: List[str] = Field(default_factory=list)
    growth_opportunities: List[str] = Field(default_factory=list)
    recommended_operations: List[str] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    confidence_notes: List[str] = Field(default_factory=list)


class ClientAIQueryRequest(BaseModel):
    prompt: str
    status_filters: List[str] = Field(default_factory=list)
    search: Optional[str] = None
    limit: int = 200


class ClientAIQueryResultBlock(BaseModel):
    type: str
    title: str
    columns: List[str] = Field(default_factory=list)
    rows: List[List[Any]] = Field(default_factory=list)
    items: List[Dict[str, Any]] = Field(default_factory=list)


class ClientAIQueryResponse(BaseModel):
    query_id: str
    intent: str
    answer_text: str
    result_blocks: List[ClientAIQueryResultBlock] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    confidence_notes: List[str] = Field(default_factory=list)


class ClientAIQueryHistoryItemResponse(ClientAIQueryResponse):
    prompt: str
    filters: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class DietPlanAIConflictCheckRequest(BaseModel):
    client_id: str
    day_wise_plan: List[Dict[str, Any]] = Field(default_factory=list)
    summary_slots: Dict[str, str] = Field(default_factory=dict)


class DietPlanConflictItemResponse(BaseModel):
    day: Optional[int] = None
    slot: str
    item: str
    conflict_type: str
    matched_client_field: str
    reason: str
    suggested_replacement: str


class DietPlanAIConflictCheckResponse(BaseModel):
    conflict_id: str
    summary: str
    conflicts: List[DietPlanConflictItemResponse] = Field(default_factory=list)
    safe_notes: List[str] = Field(default_factory=list)
    confidence_notes: List[str] = Field(default_factory=list)


class PendingTaskResponse(BaseModel):
    id: str
    task_type: str
    title: str
    client_id: str
    client_name: str
    comment: Optional[str] = None
    due_date: str
    days_left: int
    status: Optional[str] = None
    follow_up_id: Optional[str] = None
    created_by_name: Optional[str] = None


class PendingTasksFeedResponse(BaseModel):
    window_days: int
    program_window_days: int = 7
    total_count: int
    diet_expiry_count: int
    follow_up_count: int
    program_expiry_count: int = 0
    manual_task_count: int = 0
    tasks: List[PendingTaskResponse]


class ManualTaskCreate(BaseModel):
    client_id: str
    comment: str
    due_date: str


class ManualTaskResponse(BaseModel):
    id: str
    coach_id: str
    client_id: str
    client_name: str
    comment: str
    due_date: str
    status: str
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str


class AuditLogResponse(BaseModel):
    id: str
    coach_id: str
    actor_id: Optional[str] = None
    actor_name: str
    actor_email: Optional[str] = None
    event_type: str
    entity_type: str
    event_label: Optional[str] = None
    entity_id: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    summary: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str

# Diet Plan Models
class MealItem(BaseModel):
    name: str
    quantity: Optional[str] = None
    calories: Optional[int] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None

class MealSlot(BaseModel):
    time: str
    name: str
    items: List[MealItem] = []

DIET_PLAN_TYPE_CLIENT = "client_plan"
DIET_PLAN_TYPE_TEMPLATE = "master_template"
DIET_PLAN_TYPES = {DIET_PLAN_TYPE_CLIENT, DIET_PLAN_TYPE_TEMPLATE}
DIET_EXPORT_LAYOUT_TABLE = "table"
DIET_EXPORT_LAYOUT_DOCUMENT = "document"
DIET_EXPORT_LAYOUTS = {DIET_EXPORT_LAYOUT_TABLE, DIET_EXPORT_LAYOUT_DOCUMENT}

class DietPlanCreate(BaseModel):
    client_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    daily_calories: Optional[int] = None
    meals: List[MealSlot] = []
    plan_days: Optional[int] = None
    day_wise_plan: Optional[List[dict]] = None
    summary_slots: Optional[Dict[str, str]] = None
    visible_columns: Optional[List[str]] = None
    footer_note: Optional[str] = None
    instructions: Optional[str] = None
    is_active: bool = True
    plan_type: str = DIET_PLAN_TYPE_CLIENT
    source_template_id: Optional[str] = None
    export_layout: str = DIET_EXPORT_LAYOUT_TABLE

class DietPlanUpdate(BaseModel):
    client_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    daily_calories: Optional[int] = None
    meals: Optional[List[MealSlot]] = None
    plan_days: Optional[int] = None
    day_wise_plan: Optional[List[dict]] = None
    summary_slots: Optional[Dict[str, str]] = None
    visible_columns: Optional[List[str]] = None
    footer_note: Optional[str] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None
    plan_type: Optional[str] = None
    source_template_id: Optional[str] = None
    export_layout: Optional[str] = None

class DietPlanResponse(BaseModel):
    id: str
    client_id: Optional[str] = None
    coach_id: str
    name: str
    description: Optional[str] = None
    daily_calories: Optional[int] = None
    meals: List[MealSlot] = []
    plan_days: Optional[int] = None
    day_wise_plan: Optional[List[dict]] = None
    summary_slots: Optional[Dict[str, str]] = None
    visible_columns: Optional[List[str]] = None
    footer_note: Optional[str] = None
    instructions: Optional[str] = None
    is_active: bool
    plan_type: str = DIET_PLAN_TYPE_CLIENT
    source_template_id: Optional[str] = None
    export_layout: str = DIET_EXPORT_LAYOUT_TABLE
    version: int
    created_at: str
    updated_at: str


class DietPlanAIAnalyzeRequest(BaseModel):
    client_id: str
    plan_days: int
    day_wise_plan: List[Dict[str, Any]] = []
    summary_slots: Dict[str, str] = Field(default_factory=dict)
    source_filename: Optional[str] = None


class DietPlanAISuggestRequest(BaseModel):
    client_id: str
    plan_days: int
    day_wise_plan: List[Dict[str, Any]] = []
    summary_slots: Dict[str, str] = Field(default_factory=dict)
    analysis_id: Optional[str] = None
    action_key: Optional[str] = None
    custom_prompt: Optional[str] = None
    day: Optional[int] = None
    slot: Optional[str] = None
    source_filename: Optional[str] = None

# Follow-up Models
class FollowUpCreate(BaseModel):
    client_id: str
    scheduled_date: str
    scheduled_time: Optional[str] = None
    type: str = "check-in"
    notes: Optional[str] = None

class FollowUpUpdate(BaseModel):
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[str] = None

class FollowUpResponse(BaseModel):
    id: str
    client_id: str
    coach_id: str
    scheduled_date: str
    scheduled_time: Optional[str] = None
    type: str
    status: str
    notes: Optional[str] = None
    completed_at: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str

# Transaction Models
class TransactionCreate(BaseModel):
    type: str  # income, expense
    category: str
    amount: float
    description: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    program_duration: Optional[str] = None
    source: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_date: Optional[str] = None
    imported_from: Optional[str] = None

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    program_duration: Optional[str] = None
    source: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_date: Optional[str] = None
    imported_from: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    coach_id: str
    type: str
    category: str
    amount: float
    description: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    program_duration: Optional[str] = None
    source: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_date: str
    imported_from: Optional[str] = None
    created_at: str


class TransactionImportFileResult(BaseModel):
    filename: str
    imported_count: int
    skipped_count: int


class TransactionImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    file_results: List[TransactionImportFileResult] = Field(default_factory=list)

DIET_SLOT_KEYS = [
    "morning_drink",
    "breakfast",
    "mid_morning",
    "lunch",
    "evening_snack",
    "dinner",
    "night_drink",
    "bedtime",
]

DEFAULT_VISIBLE_COLUMNS = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner"]

SLOT_ALIAS_PATTERNS = {
    "morning_drink": [
        r"daily\s+morning\s+drink",
        r"morning\s+detox\s+drink",
        r"morning\s+drink",
        r"early\s+morning",
    ],
    "breakfast": [r"breakfast"],
    "mid_morning": [r"mid\s*[- ]?\s*morning"],
    "lunch": [r"lunch"],
    "evening_snack": [r"evening\s*snack", r"evening", r"snack"],
    "dinner": [r"dinner"],
    "night_drink": [r"daily\s+night\s+drink", r"night\s+drink"],
    "bedtime": [r"bedtime"],
}

_slot_group_to_key = {}
_slot_group_patterns = []
for _slot_key, _patterns in SLOT_ALIAS_PATTERNS.items():
    for _idx, _pattern in enumerate(_patterns):
        _group_name = f"{_slot_key}_{_idx}"
        _slot_group_to_key[_group_name] = _slot_key
        _slot_group_patterns.append(f"(?P<{_group_name}>{_pattern})")

SLOT_LABEL_REGEX = re.compile(
    rf"(?i)\b(?:{'|'.join(_slot_group_patterns)})\b\s*[:\-]?\s*"
)
DAY_MARKER_REGEX = re.compile(r"(?i)\bday\s*[-:]?\s*(\d{1,2})\b")
TEMPLATE_TITLE_REGEX = re.compile(r"(?i)(?:\b\d{1,2}\s*[- ]?\s*day\b.*diet\s*plan|\bdiet\s*plan\b)")
NON_VEG_REGEX = re.compile(r"(?i)\b(chicken|egg|fish|mutton|meat|prawn)\b")


def _slot_key_from_match(match: re.Match) -> Optional[str]:
    for group_name, slot_key in _slot_group_to_key.items():
        if match.group(group_name):
            return slot_key
    return None


def _clean_text(text: str) -> str:
    text = (text or "").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def _flatten_text(text: str) -> str:
    text = _clean_text(text)
    if not text:
        return ""
    flattened = " | ".join(part.strip() for part in text.split("\n") if part.strip())
    flattened = re.sub(r"\s+", " ", flattened)
    return flattened.strip(" |")


def _parse_datetime_or_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.strip()
    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError:
        pass
    try:
        return datetime.strptime(normalized[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _normalize_follow_up_time(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip()
    if not normalized:
        return None
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", normalized):
        raise HTTPException(status_code=400, detail="scheduled_time must be in HH:MM format")
    return normalized


def _blank_day(day_number: int) -> Dict[str, Any]:
    return {"day": day_number, **{slot_key: "" for slot_key in DIET_SLOT_KEYS}}


def _extract_slot_values(text: str) -> Dict[str, str]:
    values = {slot_key: "" for slot_key in DIET_SLOT_KEYS}
    flattened = _flatten_text(text)
    if not flattened:
        return values

    matches = list(SLOT_LABEL_REGEX.finditer(flattened))
    if not matches:
        return values

    for index, match in enumerate(matches):
        slot_key = _slot_key_from_match(match)
        if not slot_key:
            continue
        value_start = match.end()
        value_end = matches[index + 1].start() if index + 1 < len(matches) else len(flattened)
        raw_value = flattened[value_start:value_end]
        raw_value = re.sub(r"^\s*[|,:\-]+\s*", "", raw_value)
        raw_value = re.sub(r"\s*\|\s*$", "", raw_value)
        raw_value = raw_value.strip(" |,-")
        if not raw_value:
            continue
        if values[slot_key]:
            if raw_value.lower() not in values[slot_key].lower():
                values[slot_key] = f"{values[slot_key]} | {raw_value}"
        else:
            values[slot_key] = raw_value
    return values


def _parse_day_wise_plan(template_text: str) -> List[Dict[str, Any]]:
    flattened = _flatten_text(template_text)
    if not flattened:
        return []

    day_matches = list(DAY_MARKER_REGEX.finditer(flattened))
    if not day_matches:
        return []

    by_day = {}
    for index, match in enumerate(day_matches):
        day_number = int(match.group(1))
        if day_number < 1:
            continue
        segment_start = match.end()
        segment_end = day_matches[index + 1].start() if index + 1 < len(day_matches) else len(flattened)
        day_segment = flattened[segment_start:segment_end]
        slot_values = _extract_slot_values(day_segment)
        if day_number not in by_day:
            by_day[day_number] = _blank_day(day_number)
        for slot_key in DIET_SLOT_KEYS:
            if slot_values.get(slot_key):
                by_day[day_number][slot_key] = slot_values[slot_key]

    return [by_day[day] for day in sorted(by_day.keys())]


def _common_slot_value(day_wise_plan: List[Dict[str, Any]], slot_key: str) -> str:
    values = [str(day.get(slot_key, "")).strip() for day in day_wise_plan if str(day.get(slot_key, "")).strip()]
    if not values:
        return ""
    first = values[0]
    if all(value.lower() == first.lower() for value in values):
        return first
    return ""


def _build_summary_slots(prefix_slots: Dict[str, str], day_wise_plan: List[Dict[str, Any]]) -> Dict[str, str]:
    summary = {
        "morning_drink": str(prefix_slots.get("morning_drink", "")).strip(),
        "night_drink": str(prefix_slots.get("night_drink", "")).strip(),
        "morning_snack": "",
        "evening_snack": "",
        "bedtime": str(prefix_slots.get("bedtime", "")).strip(),
    }

    if not summary["morning_drink"]:
        summary["morning_drink"] = _common_slot_value(day_wise_plan, "morning_drink")
    if not summary["night_drink"]:
        summary["night_drink"] = _common_slot_value(day_wise_plan, "night_drink")
    if not summary["bedtime"]:
        summary["bedtime"] = _common_slot_value(day_wise_plan, "bedtime")

    prefix_mid = str(prefix_slots.get("mid_morning", "")).strip()
    prefix_evening = str(prefix_slots.get("evening_snack", "")).strip()

    if prefix_mid:
        summary["morning_snack"] = prefix_mid
    else:
        common_mid = _common_slot_value(day_wise_plan, "mid_morning")
        if common_mid:
            summary["morning_snack"] = common_mid
        elif any(str(day.get("mid_morning", "")).strip() for day in day_wise_plan):
            summary["morning_snack"] = "Varies by day"

    if prefix_evening:
        summary["evening_snack"] = prefix_evening
    else:
        common_evening = _common_slot_value(day_wise_plan, "evening_snack")
        if common_evening:
            summary["evening_snack"] = common_evening
        elif any(str(day.get("evening_snack", "")).strip() for day in day_wise_plan):
            summary["evening_snack"] = "Varies by day"

    return summary


def _finalize_summary_slots(initial_summary: Dict[str, str], day_wise_plan: List[Dict[str, Any]]) -> Dict[str, str]:
    summary = {
        "morning_drink": str(initial_summary.get("morning_drink", "")).strip(),
        "night_drink": str(initial_summary.get("night_drink", "")).strip(),
        "morning_snack": str(initial_summary.get("morning_snack", "")).strip(),
        "evening_snack": str(initial_summary.get("evening_snack", "")).strip(),
        "bedtime": str(initial_summary.get("bedtime", "")).strip(),
    }

    if not summary["morning_drink"]:
        summary["morning_drink"] = _common_slot_value(day_wise_plan, "morning_drink")
    if not summary["night_drink"]:
        summary["night_drink"] = _common_slot_value(day_wise_plan, "night_drink")
    if not summary["bedtime"]:
        summary["bedtime"] = _common_slot_value(day_wise_plan, "bedtime")

    if not summary["morning_snack"]:
        common_mid = _common_slot_value(day_wise_plan, "mid_morning")
        if common_mid:
            summary["morning_snack"] = common_mid
        elif any(str(day.get("mid_morning", "")).strip() for day in day_wise_plan):
            summary["morning_snack"] = "Varies by day"

    if not summary["evening_snack"]:
        common_evening = _common_slot_value(day_wise_plan, "evening_snack")
        if common_evening:
            summary["evening_snack"] = common_evening
        elif any(str(day.get("evening_snack", "")).strip() for day in day_wise_plan):
            summary["evening_snack"] = "Varies by day"

    return summary


def _normalize_day_wise_plan(day_wise_plan: List[Dict[str, Any]], duration_days: int) -> List[Dict[str, Any]]:
    if duration_days <= 0:
        return []

    by_day = {}
    for entry in day_wise_plan or []:
        try:
            day_number = int(entry.get("day"))
        except Exception:
            continue
        if day_number < 1:
            continue
        if day_number not in by_day:
            by_day[day_number] = _blank_day(day_number)
        for slot_key in DIET_SLOT_KEYS:
            value = str(entry.get(slot_key, "") or "").strip()
            if value:
                by_day[day_number][slot_key] = value

    normalized = []
    for day_number in range(1, duration_days + 1):
        normalized.append(by_day.get(day_number, _blank_day(day_number)))
    return normalized


def _normalize_diet_plan_doc(plan_doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not plan_doc:
        return None
    normalized = {**plan_doc}
    plan_type = normalized.get("plan_type")
    if plan_type not in DIET_PLAN_TYPES:
        plan_type = DIET_PLAN_TYPE_CLIENT if normalized.get("client_id") else DIET_PLAN_TYPE_TEMPLATE
    normalized["plan_type"] = plan_type
    normalized["client_id"] = normalized.get("client_id")
    normalized["source_template_id"] = normalized.get("source_template_id")
    export_layout = normalized.get("export_layout")
    if export_layout not in DIET_EXPORT_LAYOUTS:
        export_layout = DIET_EXPORT_LAYOUT_TABLE
    normalized["export_layout"] = export_layout
    return normalized


def _build_diet_plan_fingerprint(
    *,
    client_id: str,
    plan_days: int,
    day_wise_plan: List[Dict[str, Any]],
    summary_slots: Dict[str, str],
) -> str:
    payload = {
        "client_id": client_id,
        "plan_days": int(plan_days or 0),
        "day_wise_plan": _normalize_day_wise_plan(day_wise_plan or [], int(plan_days or 0)),
        "summary_slots": _finalize_summary_slots(summary_slots or {}, day_wise_plan or []),
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _build_diet_ai_client_context(client_record: Dict[str, Any]) -> Dict[str, Any]:
    maintenance_calories = calculate_maintenance_calories(client_record)
    recommended_daily_deficit = get_recommended_daily_deficit(client_record)
    target_daily_calories = get_target_daily_calories(client_record)
    estimated_protein_target_g = get_estimated_protein_target_g(client_record)
    return {
        "maintenance_calories": maintenance_calories,
        "recommended_daily_deficit": recommended_daily_deficit,
        "target_daily_calories": target_daily_calories,
        "estimated_protein_target_g": estimated_protein_target_g,
        "diet_preference": client_record.get("diet_preference") or None,
        "health_issues_summary": client_record.get("health_issues") or client_record.get("notes") or None,
        "calculation_policy": {
            "maintenance_calories": "healthy_target_weight_or_current_weight_x_24_kcal",
            "recommended_daily_deficit": "goal_weight_and_current_weight_based_safe_deficit",
            "estimated_protein_target_g": "1.6_g_per_kg_using_goal_weight_else_current_weight",
        },
    }


def _split_template_blocks(page_texts: List[str]) -> List[str]:
    blocks = []
    current = []

    for page_text in page_texts:
        cleaned_page = _clean_text(page_text)
        if not cleaned_page:
            continue
        starts_new_block = bool(TEMPLATE_TITLE_REGEX.search(cleaned_page) and DAY_MARKER_REGEX.search(cleaned_page))
        if starts_new_block and current:
            blocks.append("\n".join(current))
            current = [cleaned_page]
        else:
            current.append(cleaned_page)

    if current:
        blocks.append("\n".join(current))
    return blocks


def _extract_template_title(text: str, fallback: str) -> str:
    for line in _clean_text(text).split("\n"):
        if TEMPLATE_TITLE_REGEX.search(line):
            return line.strip()[:140]
    return fallback


def _diet_preference_score(diet_preference: Optional[str], template_text: str) -> int:
    if not diet_preference:
        return 0
    preference = diet_preference.lower()
    has_non_veg = bool(NON_VEG_REGEX.search(template_text or ""))

    if "non" in preference or "egg" in preference:
        return 1 if has_non_veg else 0
    if "veg" in preference or "jain" in preference or "vegan" in preference:
        return 1 if not has_non_veg else 0
    return 0


def _extract_prefix_slots(template_text: str) -> Dict[str, str]:
    flattened = _flatten_text(template_text)
    first_day = DAY_MARKER_REGEX.search(flattened)
    prefix = flattened[:first_day.start()] if first_day else flattened
    return _extract_slot_values(prefix)


WEIGHT_DATE_ALIASES = [
    "date",
    "recorded date",
    "recorded_date",
    "log date",
    "weigh-in date",
    "weight date",
    "entry date",
]

WEIGHT_VALUE_ALIASES = [
    "weight",
    "weight kg",
    "weight_kg",
    "kg",
    "wt",
    "current weight",
]

WEIGHT_NOTE_ALIASES = [
    "notes",
    "note",
    "remarks",
    "remark",
    "comments",
    "comment",
    "details",
]

WEIGHT_DATE_REGEX = re.compile(
    r"(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})"
)
WEIGHT_PARTIAL_DATE_REGEX = re.compile(
    r"(\d{1,2}\s*[-/]\s*[A-Za-z]{3,9}|\d{1,2}\s+[A-Za-z]{3,9}|[A-Za-z]{3,9}\s*[-/]\s*\d{1,2}|[A-Za-z]{3,9}\s+\d{1,2})",
    re.IGNORECASE,
)
WEIGHT_VALUE_REGEX = re.compile(r"(?<!\d)(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|kgs)?\b", re.IGNORECASE)


def _normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").strip().lower()).strip()


def _match_header_alias(fieldnames: List[str], aliases: List[str]) -> Optional[str]:
    normalized_lookup = {header: _normalize_header(header) for header in fieldnames}
    normalized_aliases = {_normalize_header(alias) for alias in aliases}
    for header, normalized in normalized_lookup.items():
        if normalized in normalized_aliases:
            return header
    return None


def _parse_weight_date(value: Any, default_year: Optional[int] = None) -> Optional[str]:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    parsed_direct = _parse_datetime_or_date(text)
    if parsed_direct:
        return parsed_direct.date().isoformat()

    matched = WEIGHT_DATE_REGEX.search(text)
    if matched and matched.group(1) != text:
        return _parse_weight_date(matched.group(1), default_year=default_year)

    formats = [
        "%d/%m/%Y",
        "%d/%m/%y",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%d-%m-%Y",
        "%d-%m-%y",
        "%Y/%m/%d",
        "%d %b %Y",
        "%d %B %Y",
        "%b %d %Y",
        "%B %d %Y",
        "%b %d, %Y",
        "%B %d, %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue

    normalized = re.sub(r"\s*-\s*", "-", text)
    partial_formats = [
        "%d-%B",
        "%d-%b",
        "%d %B",
        "%d %b",
        "%B-%d",
        "%b-%d",
        "%B %d",
        "%b %d",
    ]
    if default_year:
        for fmt in partial_formats:
            for candidate in {text, normalized}:
                try:
                    parsed = datetime.strptime(candidate, fmt)
                    return parsed.replace(year=default_year).date().isoformat()
                except ValueError:
                    continue
    return None


def _parse_weight_value(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    match = WEIGHT_VALUE_REGEX.search(text.replace(",", ""))
    if not match:
        return None
    try:
        weight = float(match.group(1))
    except ValueError:
        return None
    if weight < 20 or weight > 500:
        return None
    return round(weight, 2)


def _sanitize_weight_import_entries(entries: List[dict], default_year: Optional[int] = None) -> List[WeightImportEntry]:
    sanitized: List[WeightImportEntry] = []
    for entry in entries:
        recorded_date = _parse_weight_date(entry.get("recorded_date") or entry.get("date"), default_year=default_year)
        weight_kg = _parse_weight_value(entry.get("weight_kg") or entry.get("weight"))
        if not recorded_date or weight_kg is None:
            continue
        mapped_fields = entry.get("mapped_fields") or {}
        if not isinstance(mapped_fields, dict):
            mapped_fields = {}
        sanitized.append(
            WeightImportEntry(
                recorded_date=recorded_date,
                weight_kg=weight_kg,
                notes=str(entry.get("notes") or "").strip() or None,
                mapped_fields={
                    str(key): str(value).strip()
                    for key, value in mapped_fields.items()
                    if str(value).strip()
                },
            )
        )
    sanitized.sort(key=lambda item: item.recorded_date)
    return sanitized


def _parse_weight_csv_entries(text: str) -> List[dict]:
    if not text.strip():
        return []

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except Exception:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        return []

    fieldnames = [field for field in reader.fieldnames if field]
    date_field = _match_header_alias(fieldnames, WEIGHT_DATE_ALIASES)
    weight_field = _match_header_alias(fieldnames, WEIGHT_VALUE_ALIASES)
    note_field = _match_header_alias(fieldnames, WEIGHT_NOTE_ALIASES)
    if not date_field or not weight_field:
        return []

    entries = []
    for row in reader:
        mapped_fields = {
            key: str(value).strip()
            for key, value in (row or {}).items()
            if key not in {date_field, weight_field, note_field} and str(value or "").strip()
        }
        entries.append({
            "recorded_date": row.get(date_field),
            "weight_kg": row.get(weight_field),
            "notes": row.get(note_field),
            "mapped_fields": mapped_fields,
        })
    return entries


def _parse_weight_json_entries(text: str) -> List[dict]:
    if not text.strip():
        return []

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return []

    items = payload if isinstance(payload, list) else payload.get("entries", []) if isinstance(payload, dict) else []
    if not isinstance(items, list):
        return []

    entries = []
    for item in items:
        if not isinstance(item, dict):
            continue
        mapped_fields = {
            str(key): str(value).strip()
            for key, value in item.items()
            if key not in {"date", "recorded_date", "weight", "weight_kg", "notes", "remarks"} and str(value).strip()
        }
        entries.append({
            "recorded_date": item.get("recorded_date") or item.get("date"),
            "weight_kg": item.get("weight_kg") or item.get("weight"),
            "notes": item.get("notes") or item.get("remarks"),
            "mapped_fields": mapped_fields,
        })
    return entries


def _detect_weight_log_default_year(text: str) -> Optional[int]:
    lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
    prioritized_lines = sorted(lines, key=lambda line: 0 if "start date" in line.lower() else 1)
    for line in prioritized_lines:
        match = WEIGHT_DATE_REGEX.search(line)
        if not match:
            continue
        parsed_date = _parse_weight_date(match.group(1))
        if parsed_date:
            return int(parsed_date[:4])
    return None


def _parse_weight_text_entries(text: str, default_year: Optional[int] = None) -> List[dict]:
    resolved_year = default_year or _detect_weight_log_default_year(text) or datetime.now(timezone.utc).year
    entries = []
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line or len(line) < 6:
            continue
        if line.lower().startswith(("date", "weight", "notes", "remark")):
            continue

        date_match = WEIGHT_DATE_REGEX.search(line)
        partial_match = WEIGHT_PARTIAL_DATE_REGEX.search(line) if not date_match else None
        if not date_match and not partial_match:
            continue
        date_text = date_match.group(1) if date_match else partial_match.group(1)
        recorded_date = _parse_weight_date(date_text, default_year=resolved_year)
        if not recorded_date:
            continue

        match_start = date_match.start() if date_match else partial_match.start()
        match_end = date_match.end() if date_match else partial_match.end()
        remaining = f"{line[:match_start]} {line[match_end:]}".strip(" |,-:")
        weight_match = WEIGHT_VALUE_REGEX.search(remaining)
        if not weight_match:
            continue

        weight_kg = _parse_weight_value(weight_match.group(1))
        if weight_kg is None:
            continue

        notes = f"{remaining[:weight_match.start()]} {remaining[weight_match.end():]}".strip(" |,-:")
        entries.append({
            "recorded_date": recorded_date,
            "weight_kg": weight_kg,
            "notes": notes or None,
            "mapped_fields": {},
        })
    return entries


def _strip_json_fence(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned


def _attempt_ai_weight_parse(text: str, filename: str) -> Optional[Dict[str, Any]]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or not (text or "").strip():
        return None

    prompt = (
        "Extract structured client weight log entries from the provided content. "
        "Return JSON only in the shape "
        "{\"entries\": [{\"recorded_date\": \"YYYY-MM-DD\", \"weight_kg\": 78.5, \"notes\": \"\", "
        "\"mapped_fields\": {\"field\": \"value\"}}], \"parse_warnings\": [\"...\"]}. "
        "Only include entries where both a valid date and weight are present. "
        "Preserve any extra columns or useful values inside mapped_fields."
    )

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": os.environ.get("OPENAI_WEIGHT_PARSE_MODEL", os.environ.get("OPENAI_MODEL", "gpt-4o")),
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": f"Filename: {filename}\n\nContent:\n{text[:15000]}"},
                ],
            },
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = json.loads(_strip_json_fence(content))
        if isinstance(parsed, dict):
            return parsed
    except Exception as exc:
        logger.warning("AI weight parsing fallback failed: %s", exc)
    return None


def _extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
    except Exception:
        try:
            from PyPDF2 import PdfReader  # type: ignore
        except Exception:
            raise HTTPException(status_code=503, detail="PDF parser dependency not available. Install pypdf==6.7.5")

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    page_text = "\n".join((_clean_text(page.extract_text() or "")) for page in reader.pages)
    return page_text.strip()


def _extract_text_from_file_bytes(file_bytes: bytes, filename: str, content_type: Optional[str]) -> str:
    lower_name = (filename or "").lower()
    if lower_name.endswith(".pdf") or (content_type or "").startswith("application/pdf"):
        return _extract_text_from_pdf_bytes(file_bytes)

    try:
        return file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="ignore")


def _extract_text_from_weight_upload(file_bytes: bytes, filename: str, content_type: Optional[str]) -> str:
    return _extract_text_from_file_bytes(file_bytes, filename, content_type)


def _serialize_file_record(file_record: dict) -> FileRecordResponse:
    return FileRecordResponse(
        id=file_record["id"],
        client_id=file_record.get("client_id"),
        category=file_record.get("category", "general"),
        original_filename=file_record.get("original_filename", "file"),
        content_type=file_record.get("content_type"),
        size=file_record.get("size"),
        created_at=file_record.get("created_at", ""),
    )


def _extract_text_from_stored_file_record(file_record: dict) -> str:
    data, content_type = get_object(file_record["storage_path"])
    return _extract_text_from_file_bytes(
        data,
        file_record.get("original_filename") or "",
        file_record.get("content_type") or content_type,
    )


def _parse_weight_import_payload(raw_text: str, source_name: str) -> WeightImportParseResponse:
    extracted_text = raw_text or ""
    default_year = _detect_weight_log_default_year(extracted_text)
    parse_warnings: List[str] = []
    parser_mode = "heuristic"
    lower_name = (source_name or "").lower()

    if lower_name.endswith(".csv"):
        raw_entries = _parse_weight_csv_entries(extracted_text)
    elif lower_name.endswith(".json"):
        raw_entries = _parse_weight_json_entries(extracted_text)
    else:
        ai_result = _attempt_ai_weight_parse(extracted_text, source_name)
        if ai_result:
            raw_entries = ai_result.get("entries") or []
            parse_warnings.extend(ai_result.get("parse_warnings") or [])
            parser_mode = "ai"
        else:
            raw_entries = _parse_weight_csv_entries(extracted_text)
            if not raw_entries:
                raw_entries = _parse_weight_json_entries(extracted_text)
            if not raw_entries:
                raw_entries = _parse_weight_text_entries(extracted_text, default_year=default_year)

    entries = _sanitize_weight_import_entries(raw_entries, default_year=default_year)
    if not entries:
        raise HTTPException(
            status_code=400,
            detail="Could not parse any weight entries. Use date: weight lines like `09-March: 84.95` or provide CSV/JSON-style text.",
        )

    duplicate_dates = set()
    seen_dates = set()
    for entry in entries:
        if entry.recorded_date in seen_dates:
            duplicate_dates.add(entry.recorded_date)
        seen_dates.add(entry.recorded_date)
    if duplicate_dates:
        parse_warnings.append(f"Duplicate dates detected in pasted data: {', '.join(sorted(duplicate_dates))}. Latest saved row will win.")

    return WeightImportParseResponse(
        entries=entries,
        parse_warnings=parse_warnings,
        parser_mode=parser_mode,
    )


async def _sync_client_follow_up_dates(client_id: str) -> None:
    follow_ups = await db.follow_ups.find(
        {"client_id": client_id},
        {"_id": 0, "scheduled_date": 1, "status": 1},
    ).to_list(500)

    today = datetime.now(timezone.utc).date()
    parsed_rows = []
    for follow_up in follow_ups:
        parsed_date = _parse_weight_date(follow_up.get("scheduled_date"))
        if not parsed_date:
            continue
        parsed_rows.append((parsed_date, follow_up))

    upcoming_dates = [
        date_value for date_value, follow_up in parsed_rows
        if follow_up.get("status") == "scheduled" and date_value >= today.isoformat()
    ]
    latest_dates = [
        date_value for date_value, follow_up in parsed_rows
        if follow_up.get("status") == "completed" or date_value <= today.isoformat()
    ]

    await db.clients.update_one(
        {"id": client_id},
        {
            "$set": {
                "upcoming_follow_up_date": min(upcoming_dates) if upcoming_dates else None,
                "last_follow_up_date": max(latest_dates) if latest_dates else None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


def _normalize_tracker_activity_name(value: Optional[str]) -> Optional[str]:
    normalized = re.sub(r"[^a-z]+", " ", str(value or "").strip().lower()).strip()
    if not normalized:
        return None
    return TRACKER_ACTIVITY_ALIASES.get(normalized)


def _extract_tracker_activities(meals: Optional[List[dict]]) -> Dict[str, bool]:
    activities: Dict[str, bool] = {}
    for meal in meals or []:
        key = _normalize_tracker_activity_name(meal.get("meal_name"))
        if not key:
            continue
        activities[key] = bool(meal.get("completed"))
    return activities


async def _build_pending_tasks_feed(user: dict, window_days: int = 3) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    today = now.date()
    cutoff = today + timedelta(days=window_days)
    program_window_days = 7
    program_cutoff = today + timedelta(days=program_window_days)
    today_iso = today.isoformat()
    cutoff_iso = cutoff.isoformat()
    program_cutoff_iso = program_cutoff.isoformat()

    visible_clients = await db.clients.find(
        _visible_clients_query(user),
        {"_id": 0, "id": 1, "name": 1, "diet_end_date": 1, "program_end_date": 1, "status": 1},
    ).to_list(2000)
    client_map = {client["id"]: client for client in visible_clients if client.get("id")}
    visible_client_ids = list(client_map.keys())

    diet_tasks: List[Dict[str, Any]] = []
    for client_row in visible_clients:
        diet_end_date = client_row.get("diet_end_date")
        client_status = (client_row.get("status") or "active").lower()
        if client_status not in {"active"}:
            continue
        if not diet_end_date or not (today_iso <= diet_end_date <= cutoff_iso):
            continue
        parsed_due_date = _parse_datetime_or_date(diet_end_date)
        if not parsed_due_date:
            continue
        diet_tasks.append(
            {
                "id": f"diet-expiry:{client_row['id']}:{diet_end_date}",
                "task_type": "diet-expiry",
                "title": "Diet plan expiring soon",
                "client_id": client_row["id"],
                "client_name": client_row.get("name", "Client"),
                "comment": "Diet plan expiring soon",
                "due_date": diet_end_date,
                "days_left": max(0, (parsed_due_date.date() - today).days),
                "status": client_row.get("status", "active"),
                "follow_up_id": None,
                "created_by_name": None,
            }
        )

    program_tasks: List[Dict[str, Any]] = []
    for client_row in visible_clients:
        program_end_date = client_row.get("program_end_date")
        client_status = (client_row.get("status") or "active").lower()
        if client_status not in {"active"}:
            continue
        if not program_end_date or not (today_iso <= program_end_date <= program_cutoff_iso):
            continue
        parsed_due_date = _parse_datetime_or_date(program_end_date)
        if not parsed_due_date:
            continue
        program_tasks.append(
            {
                "id": f"program-expiry:{client_row['id']}:{program_end_date}",
                "task_type": "program-expiry",
                "title": "Program end due soon",
                "client_id": client_row["id"],
                "client_name": client_row.get("name", "Client"),
                "comment": f"Program ends on {program_end_date}",
                "due_date": program_end_date,
                "days_left": max(0, (parsed_due_date.date() - today).days),
                "status": client_row.get("status", "active"),
                "follow_up_id": None,
                "created_by_name": None,
            }
        )

    follow_up_tasks: List[Dict[str, Any]] = []
    if visible_client_ids:
        follow_ups = await db.follow_ups.find(
            {
                "client_id": {"$in": visible_client_ids},
                "status": "scheduled",
                "scheduled_date": {"$gte": today_iso, "$lte": cutoff_iso},
            },
            {"_id": 0, "id": 1, "client_id": 1, "scheduled_date": 1, "status": 1, "type": 1},
        ).sort("scheduled_date", 1).to_list(2000)

        for follow_up in follow_ups:
            parsed_due_date = _parse_datetime_or_date(follow_up.get("scheduled_date"))
            client_row = client_map.get(follow_up.get("client_id"))
            if not parsed_due_date or not client_row:
                continue
            follow_up_tasks.append(
                {
                    "id": f"follow-up:{follow_up['id']}",
                    "task_type": "follow-up",
                    "title": "Follow-up call due soon",
                    "client_id": client_row["id"],
                    "client_name": client_row.get("name", "Client"),
                    "comment": "Follow-up call due soon",
                    "due_date": follow_up.get("scheduled_date"),
                    "days_left": max(0, (parsed_due_date.date() - today).days),
                    "status": follow_up.get("status", "scheduled"),
                    "follow_up_id": follow_up.get("id"),
                    "created_by_name": None,
                }
            )

    manual_tasks: List[Dict[str, Any]] = []
    if visible_client_ids:
        manual_task_rows = await db.manual_tasks.find(
            _visible_shared_owner_query(
                user,
                {
                    "client_id": {"$in": visible_client_ids},
                    "status": "open",
                    "due_date": {"$gte": today_iso, "$lte": cutoff_iso},
                },
            ),
            {
                "_id": 0,
                "id": 1,
                "client_id": 1,
                "due_date": 1,
                "status": 1,
                "comment": 1,
                "created_by_name": 1,
            },
        ).sort("due_date", 1).to_list(2000)

        for task in manual_task_rows:
            parsed_due_date = _parse_datetime_or_date(task.get("due_date"))
            client_row = client_map.get(task.get("client_id"))
            if not parsed_due_date or not client_row:
                continue
            manual_tasks.append(
                {
                    "id": f"manual-task:{task['id']}",
                    "task_type": "manual",
                    "title": "Manual task",
                    "client_id": client_row["id"],
                    "client_name": client_row.get("name", "Client"),
                    "comment": task.get("comment") or "Manual task",
                    "due_date": task.get("due_date"),
                    "days_left": max(0, (parsed_due_date.date() - today).days),
                    "status": task.get("status", "open"),
                    "follow_up_id": None,
                    "created_by_name": task.get("created_by_name"),
                }
            )

    all_tasks = sorted(
        diet_tasks + program_tasks + follow_up_tasks + manual_tasks,
        key=lambda item: (item.get("due_date") or "", item.get("task_type") or "", item.get("client_name") or ""),
    )

    return {
        "window_days": window_days,
        "program_window_days": program_window_days,
        "total_count": len(all_tasks),
        "diet_expiry_count": len(diet_tasks),
        "follow_up_count": len(follow_up_tasks),
        "program_expiry_count": len(program_tasks),
        "manual_task_count": len(manual_tasks),
        "tasks": all_tasks,
    }

# ============ AUTH HELPERS ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def normalize_staff_role(role: Optional[str]) -> str:
    raw_role = str(role or "").strip().lower()
    if raw_role in {ROLE_SUPER_ADMIN, LEGACY_ROLE_COACH}:
        return ROLE_SUPER_ADMIN
    if raw_role == ROLE_ADMIN:
        return ROLE_ADMIN
    if raw_role == ROLE_DIETITIAN:
        return ROLE_DIETITIAN
    if raw_role == ROLE_CLIENT:
        return ROLE_CLIENT
    return ROLE_DIETITIAN


def is_super_admin(user: dict) -> bool:
    return normalize_staff_role(user.get("role")) == ROLE_SUPER_ADMIN


def is_admin_user(user: dict) -> bool:
    return normalize_staff_role(user.get("role")) in {ROLE_SUPER_ADMIN, ROLE_ADMIN}


def is_staff_user(user: dict) -> bool:
    return normalize_staff_role(user.get("role")) in {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_DIETITIAN}


def ensure_super_admin(user: dict) -> None:
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Only super admins can perform this action")


def ensure_admin_user(user: dict) -> None:
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Only admins can access this section")


async def _get_staff_member_by_email(email: str) -> Optional[dict]:
    return await db.staff_members.find_one({"email": str(email).strip().lower()}, {"_id": 0})


async def _build_staff_response(staff_doc: dict) -> StaffMemberResponse:
    assigned_client_ids = staff_doc.get("assigned_client_ids") or []
    if staff_doc.get("id"):
        assigned_client_ids = await db.clients.distinct("id", {"primary_coach_id": staff_doc["id"]})
    return StaffMemberResponse(
        **{
            **staff_doc,
            "role": normalize_staff_role(staff_doc.get("role")),
            "assigned_client_ids": assigned_client_ids,
            "assigned_client_count": len(assigned_client_ids),
        }
    )


async def _sync_staff_directory_from_users() -> None:
    now = datetime.now(timezone.utc).isoformat()
    users = await db.users.find(
        {"role": {"$in": [ROLE_SUPER_ADMIN, LEGACY_ROLE_COACH, ROLE_ADMIN, ROLE_DIETITIAN]}},
        {"_id": 0},
    ).to_list(1000)

    for user in users:
        email = str(user.get("email") or "").strip().lower()
        if not email:
            continue

        normalized_role = normalize_staff_role(user.get("role"))
        existing_staff = await db.staff_members.find_one({"email": email}, {"_id": 0})
        if existing_staff:
            resolved_role = normalize_staff_role(existing_staff.get("role") or user.get("role"))
            updates = {
                "name": user.get("name") or existing_staff.get("name") or email,
                "role": resolved_role,
                "user_id": user.get("id"),
                "updated_at": now,
            }
            if not existing_staff.get("status"):
                updates["status"] = "active"
            await db.staff_members.update_one({"id": existing_staff["id"]}, {"$set": updates})
            await db.users.update_one(
                {"id": user.get("id")},
                {"$set": {"role": resolved_role, "updated_at": now}},
            )
            continue

        await db.staff_members.insert_one(
            {
                "id": str(uuid.uuid4()),
                "name": user.get("name") or email,
                "email": email,
                "phone": None,
                "role": normalized_role,
                "status": "active",
                "user_id": user.get("id"),
                "assigned_client_ids": [],
                "created_at": user.get("created_at") or now,
                "updated_at": now,
            }
        )

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": normalize_staff_role(role),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        staff_member = await _get_staff_member_by_email(user.get("email", ""))
        resolved_role = normalize_staff_role((staff_member or {}).get("role") or user.get("role"))
        user["role"] = resolved_role
        if resolved_role in {ROLE_ADMIN, ROLE_DIETITIAN}:
            if not staff_member or staff_member.get("status") != "active":
                raise HTTPException(status_code=403, detail="Unauthorized account")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _visible_client_owner_ids(user: dict) -> List[str]:
    user_id = str(user.get("id") or "").strip()
    return [owner_id for owner_id in [SHARED_CLIENT_OWNER_ID, user_id] if owner_id]


def _visible_shared_owner_query(user: dict, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    query: Dict[str, Any] = {"coach_id": {"$in": _visible_client_owner_ids(user)}}
    if extra:
        query.update(extra)
    return query


def _visible_clients_query(user: dict, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return _visible_shared_owner_query(user, extra)


async def _get_visible_client(client_id: str, user: dict, projection: Optional[Dict[str, int]] = None) -> Optional[dict]:
    return await db.clients.find_one(_visible_clients_query(user, {"id": client_id}), projection or {"_id": 0})


def _humanize_audit_field_name(field_name: str) -> str:
    return str(field_name or "").replace("_", " ").strip().title()


def _format_audit_value_scalar(key: Optional[str], value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, float):
        if key == "amount":
            return f"₹{value:,.2f}"
        return f"{value:.2f}".rstrip("0").rstrip(".")
    if isinstance(value, int):
        if key == "amount":
            return f"₹{value:,}"
        return str(value)
    if isinstance(value, list):
        formatted = [_format_audit_value_scalar(key, item) for item in value]
        return ", ".join(item for item in formatted if item)
    return str(value)


def _format_audit_snapshot(snapshot: Optional[Dict[str, Any]]) -> Optional[str]:
    if not snapshot:
        return None

    lines: List[str] = []
    for key, value in snapshot.items():
        formatted_value = _format_audit_value_scalar(key, value)
        if not formatted_value:
            continue
        lines.append(f"{_humanize_audit_field_name(key)}: {formatted_value}")
    return "\n".join(lines) if lines else None


def _derive_audit_event_label(event_type: str, entity_type: str, metadata: Optional[Dict[str, Any]]) -> str:
    if entity_type == "transaction":
        return "Transaction"
    if entity_type == "follow-up":
        return "Follow-up"
    if entity_type != "client":
        return _humanize_audit_field_name(entity_type)

    changes = metadata.get("changes") if metadata else None
    changed_fields = {change.get("field") for change in changes or [] if change.get("field")}
    if not changed_fields:
        return "Client"

    if changed_fields.issubset({"diet_start_date", "diet_end_date"}):
        return "Diet"
    if changed_fields.issubset({"last_follow_up_date", "upcoming_follow_up_date"}):
        return "Follow-up"
    if changed_fields.issubset({"program_start_date", "program_end_date"}):
        return "Program"
    return "Client"


def _derive_audit_value_columns(
    *,
    event_type: str,
    entity_type: str,
    metadata: Optional[Dict[str, Any]],
) -> tuple[Optional[str], Optional[str]]:
    payload = metadata or {}

    if event_type == "client-date-updated":
        old_lines = []
        new_lines = []
        for change in payload.get("changes", []):
            field_label = _humanize_audit_field_name(change.get("field"))
            old_lines.append(f"{field_label}: {_format_audit_value_scalar(change.get('field'), change.get('from')) or '—'}")
            new_lines.append(f"{field_label}: {_format_audit_value_scalar(change.get('field'), change.get('to')) or '—'}")
        return ("\n".join(old_lines) or None, "\n".join(new_lines) or None)

    if isinstance(payload.get("from"), dict) or isinstance(payload.get("to"), dict):
        return (
            _format_audit_snapshot(payload.get("from")),
            _format_audit_snapshot(payload.get("to")),
        )

    if event_type.endswith("created"):
        return (None, _format_audit_snapshot(payload))

    if event_type.endswith("deleted"):
        return (_format_audit_snapshot(payload), None)

    if event_type == "transaction-imported":
        return (
            None,
            _format_audit_snapshot(
                {
                    "imported_count": payload.get("imported_count"),
                    "skipped_count": payload.get("skipped_count"),
                }
            ),
        )

    if entity_type in {"follow-up", "transaction", "client"}:
        return (None, _format_audit_snapshot(payload))

    return (None, None)


async def _write_audit_log(
    *,
    user: dict,
    event_type: str,
    entity_type: str,
    entity_id: Optional[str],
    summary: str,
    client_id: Optional[str] = None,
    client_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    event_label: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    derived_old_value, derived_new_value = _derive_audit_value_columns(
        event_type=event_type,
        entity_type=entity_type,
        metadata=metadata,
    )
    log_doc = {
        "id": str(uuid.uuid4()),
        "coach_id": SHARED_CLIENT_OWNER_ID,
        "actor_id": user.get("id"),
        "actor_name": user.get("name") or "Coach",
        "actor_email": user.get("email"),
        "event_type": event_type,
        "entity_type": entity_type,
        "event_label": event_label or _derive_audit_event_label(event_type, entity_type, metadata),
        "entity_id": entity_id,
        "client_id": client_id,
        "client_name": client_name,
        "summary": summary,
        "old_value": old_value if old_value is not None else derived_old_value,
        "new_value": new_value if new_value is not None else derived_new_value,
        "metadata": metadata or {},
        "created_at": now,
    }
    await db.audit_logs.insert_one(log_doc)

# ============ AUTH ROUTES ============
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    email = str(data.email).strip().lower()
    normalized_requested_role = normalize_staff_role(data.role)
    users_count = await db.users.count_documents({})
    staff_member = await _get_staff_member_by_email(email)

    if users_count == 0 and normalized_requested_role == ROLE_SUPER_ADMIN:
        assigned_role = ROLE_SUPER_ADMIN
    else:
        if not staff_member or staff_member.get("status") != "active":
            raise HTTPException(status_code=403, detail="Unauthorized email. Please contact the super admin.")
        assigned_role = normalize_staff_role(staff_member.get("role"))

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": assigned_role,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)

    if staff_member:
        await db.staff_members.update_one(
            {"id": staff_member["id"]},
            {
                "$set": {
                    "name": data.name,
                    "role": assigned_role,
                    "status": "active",
                    "user_id": user_id,
                    "updated_at": now,
                }
            },
        )
    else:
        await db.staff_members.insert_one(
            {
                "id": str(uuid.uuid4()),
                "name": data.name,
                "email": email,
                "phone": None,
                "role": assigned_role,
                "status": "active",
                "user_id": user_id,
                "assigned_client_ids": [],
                "created_at": now,
                "updated_at": now,
            }
        )

    token = create_token(user_id, email, assigned_role)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=email, name=data.name, role=normalize_staff_role(assigned_role), created_at=now)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    email = str(data.email).strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    staff_member = await _get_staff_member_by_email(email)
    normalized_role = normalize_staff_role((staff_member or {}).get("role") or user.get("role"))
    if normalized_role in {ROLE_ADMIN, ROLE_DIETITIAN}:
        if not staff_member or staff_member.get("status") != "active":
            raise HTTPException(status_code=403, detail="Unauthorized account")

    token = create_token(user["id"], user["email"], normalized_role)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], role=normalized_role, created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], role=normalize_staff_role(user["role"]), created_at=user["created_at"])


@api_router.get("/staff", response_model=List[StaffMemberResponse])
async def get_staff_members(user: dict = Depends(get_current_user)):
    ensure_super_admin(user)
    staff_rows = await db.staff_members.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [await _build_staff_response(row) for row in staff_rows]


@api_router.post("/staff", response_model=StaffMemberResponse)
async def create_staff_member(data: StaffMemberCreate, user: dict = Depends(get_current_user)):
    ensure_super_admin(user)
    email = str(data.email).strip().lower()
    existing_staff = await _get_staff_member_by_email(email)
    if existing_staff and existing_staff.get("status") != "inactive":
        raise HTTPException(status_code=400, detail="Staff member already exists for this email")

    normalized_role = normalize_staff_role(data.role)
    if normalized_role not in {ROLE_ADMIN, ROLE_DIETITIAN}:
        raise HTTPException(status_code=400, detail="Staff role must be admin or dietitian")

    existing_user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
    now = datetime.now(timezone.utc).isoformat()
    staff_doc = {
        "id": existing_staff.get("id") if existing_staff else str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": email,
        "phone": (data.phone or "").strip() or None,
        "role": normalized_role,
        "status": "active",
        "user_id": (existing_user or {}).get("id"),
        "assigned_client_ids": existing_staff.get("assigned_client_ids", []) if existing_staff else [],
        "created_at": existing_staff.get("created_at", now) if existing_staff else now,
        "updated_at": now,
    }

    await db.staff_members.update_one({"email": email}, {"$set": staff_doc}, upsert=True)
    if existing_user:
        await db.users.update_one({"id": existing_user["id"]}, {"$set": {"role": normalized_role, "updated_at": now}})
    return await _build_staff_response(staff_doc)


@api_router.put("/staff/{staff_id}", response_model=StaffMemberResponse)
async def update_staff_member(staff_id: str, data: StaffMemberUpdate, user: dict = Depends(get_current_user)):
    ensure_super_admin(user)
    staff_row = await db.staff_members.find_one({"id": staff_id}, {"_id": 0})
    if not staff_row:
        raise HTTPException(status_code=404, detail="Staff member not found")

    update_data = data.model_dump(exclude_unset=True)
    if "role" in update_data:
        normalized_role = normalize_staff_role(update_data["role"])
        if normalized_role not in {ROLE_ADMIN, ROLE_DIETITIAN}:
            raise HTTPException(status_code=400, detail="Staff role must be admin or dietitian")
        update_data["role"] = normalized_role
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()
    if "phone" in update_data:
        update_data["phone"] = (update_data["phone"] or "").strip() or None

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated_row = {**staff_row, **update_data}
    await db.staff_members.update_one({"id": staff_id}, {"$set": update_data})
    if staff_row.get("user_id") and ("role" in update_data or "name" in update_data):
        user_updates = {"updated_at": update_data["updated_at"]}
        if "role" in update_data:
            user_updates["role"] = update_data["role"]
        if "name" in update_data:
            user_updates["name"] = update_data["name"]
        await db.users.update_one({"id": staff_row["user_id"]}, {"$set": user_updates})
    return await _build_staff_response(updated_row)


@api_router.delete("/staff/{staff_id}")
async def delete_staff_member(staff_id: str, user: dict = Depends(get_current_user)):
    ensure_super_admin(user)
    staff_row = await db.staff_members.find_one({"id": staff_id}, {"_id": 0})
    if not staff_row:
        raise HTTPException(status_code=404, detail="Staff member not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.staff_members.update_one(
        {"id": staff_id},
        {"$set": {"status": "inactive", "updated_at": now}},
    )
    await db.clients.update_many(
        {"primary_coach_id": staff_id},
        {"$set": {"primary_coach_id": None, "primary_coach": None, "updated_at": now}},
    )
    if staff_row.get("user_id"):
        await db.users.update_one({"id": staff_row["user_id"]}, {"$set": {"updated_at": now}})
    return {"message": "Staff member removed"}


@api_router.put("/staff/{staff_id}/assign-clients", response_model=StaffMemberResponse)
async def assign_clients_to_staff(staff_id: str, data: StaffAssignClientsRequest, user: dict = Depends(get_current_user)):
    ensure_super_admin(user)
    staff_row = await db.staff_members.find_one({"id": staff_id, "status": "active"}, {"_id": 0})
    if not staff_row:
        raise HTTPException(status_code=404, detail="Staff member not found")

    visible_clients = await db.clients.find(_visible_clients_query(user), {"_id": 0, "id": 1}).to_list(5000)
    visible_client_ids = {client["id"] for client in visible_clients if client.get("id")}
    requested_client_ids = [client_id for client_id in data.client_ids if client_id in visible_client_ids]

    previous_client_ids = set(staff_row.get("assigned_client_ids") or [])
    next_client_ids = set(requested_client_ids)

    if previous_client_ids - next_client_ids:
        await db.clients.update_many(
            {"id": {"$in": list(previous_client_ids - next_client_ids)}, "primary_coach_id": staff_id},
            {"$set": {"primary_coach_id": None, "primary_coach": None, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    if next_client_ids:
        await db.clients.update_many(
            {"id": {"$in": list(next_client_ids)}},
            {"$set": {"primary_coach_id": staff_id, "primary_coach": staff_row.get("name"), "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    updated_at = datetime.now(timezone.utc).isoformat()
    await db.staff_members.update_one(
        {"id": staff_id},
        {"$set": {"assigned_client_ids": list(next_client_ids), "updated_at": updated_at}},
    )
    updated_row = {**staff_row, "assigned_client_ids": list(next_client_ids), "updated_at": updated_at}
    return await _build_staff_response(updated_row)

# ============ CLIENT ROUTES ============
@api_router.get("/clients", response_model=List[ClientResponse])
async def get_clients(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    query = _visible_clients_query(user)
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    clients = await db.clients.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return [ClientResponse(**c) for c in clients]

@api_router.get("/clients/stats")
async def get_client_stats(user: dict = Depends(get_current_user)):
    total = await db.clients.count_documents(_visible_clients_query(user))
    active = await db.clients.count_documents(_visible_clients_query(user, {"status": "active"}))
    on_hold = await db.clients.count_documents(_visible_clients_query(user, {"status": "on-hold"}))
    completed = await db.clients.count_documents(_visible_clients_query(user, {"status": "completed"}))
    return {"total": total, "active": active, "on_hold": on_hold, "completed": completed}


APP_LOCAL_TIMEZONE = ZoneInfo("Asia/Kolkata")
CLIENT_PROFILE_SEARCH_FIELDS = [
    "allergies",
    "avoid_foods",
    "preferred_foods",
    "disliked_foods",
    "medical_food_restrictions",
    "health_issues",
    "diet_preference",
    "status",
    "location",
    "primary_coach",
]
CLIENT_FOOD_LIST_FIELDS = [
    "allergies",
    "avoid_foods",
    "disliked_foods",
    "medical_food_restrictions",
]
FOOD_REPLACEMENT_SUGGESTIONS = {
    "peanut": "roasted chana",
    "peanuts": "roasted chana",
    "milk": "unsweetened soy milk or lactose-free curd if suitable",
    "curd": "lactose-free curd or coconut curd if suitable",
    "paneer": "tofu or boiled chana",
    "egg": "paneer/tofu bhurji or sprouts",
    "eggs": "paneer/tofu bhurji or sprouts",
    "wheat": "jowar roti or rice-based option",
    "gluten": "rice, jowar, bajra, or quinoa option",
    "soy": "paneer, chana, dal, or curd if suitable",
    "almond": "pumpkin seeds or roasted chana",
    "almonds": "pumpkin seeds or roasted chana",
}


def _today_local_date():
    return datetime.now(APP_LOCAL_TIMEZONE).date()


def _parse_iso_date(value: Any):
    text = str(value or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def _coerce_text_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        parts = value
    else:
        parts = re.split(r"[,;\n|]+", str(value))
    cleaned = []
    for item in parts:
        text = str(item or "").strip()
        if text:
            cleaned.append(text)
    return cleaned


def _normalize_match_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _normalize_food_key(value: Any) -> str:
    text = _normalize_match_text(value)
    tokens = []
    for token in text.split():
        if len(token) > 3 and token.endswith("s"):
            token = token[:-1]
        tokens.append(token)
    return " ".join(tokens)


def _extract_numbers_from_prompt(prompt: str) -> List[float]:
    return [float(match) for match in re.findall(r"\d+(?:\.\d+)?", prompt or "")]


def _fallback_classify_client_query(prompt: str) -> Dict[str, Any]:
    text = (prompt or "").lower()
    numbers = _extract_numbers_from_prompt(text)
    window_days = 7
    threshold_kg = 1
    if re.search(r"\d+\s*-\s*(\d+)\s*days?", text):
        window_days = int(re.search(r"\d+\s*-\s*(\d+)\s*days?", text).group(1))
    elif re.search(r"last\s+(\d+)\s+days?|next\s+(\d+)\s+days?|in\s+(\d+)\s+days?", text):
        match = re.search(r"last\s+(\d+)\s+days?|next\s+(\d+)\s+days?|in\s+(\d+)\s+days?", text)
        window_days = int(next(group for group in match.groups() if group))
    elif numbers:
        window_days = int(numbers[-1])
    if re.search(r"(\d+(?:\.\d+)?)\s*kgs?|\bkg\b", text):
        threshold_kg = float(re.search(r"(\d+(?:\.\d+)?)\s*kgs?|\bkg\b", text).group(1) or 1)

    if any(term in text for term in ["lost", "loss", "lose", "reduced", "down"]):
        return {"intent": "weight_change", "direction": "loss", "threshold_kg": threshold_kg, "window_days": window_days, "profile_terms": [], "answer_focus": prompt}
    if any(term in text for term in ["gained", "gain", "increased", "up "]):
        return {"intent": "weight_change", "direction": "gain", "threshold_kg": threshold_kg, "window_days": window_days, "profile_terms": [], "answer_focus": prompt}
    if "program" in text and any(term in text for term in ["end", "ending", "expire", "expiring"]):
        return {"intent": "program_expiry", "direction": "none", "threshold_kg": 0, "window_days": window_days, "profile_terms": [], "answer_focus": prompt}
    if "diet" in text and any(term in text for term in ["end", "ending", "expire", "expiring"]):
        return {"intent": "diet_expiry", "direction": "none", "threshold_kg": 0, "window_days": window_days, "profile_terms": [], "answer_focus": prompt}
    if any(term in text for term in ["follow up", "follow-up", "followup"]):
        return {"intent": "follow_up_due", "direction": "none", "threshold_kg": 0, "window_days": window_days, "profile_terms": [], "answer_focus": prompt}
    if any(term in text for term in ["allergy", "allergic", "avoid", "food", "preference", "health issue", "medical"]):
        terms = [word for word in re.findall(r"[a-zA-Z][a-zA-Z0-9-]{2,}", prompt or "") if word.lower() not in {"which", "client", "clients", "have", "with", "food", "allergy", "allergic", "avoid"}]
        return {"intent": "client_profile_search", "direction": "none", "threshold_kg": 0, "window_days": window_days, "profile_terms": terms, "answer_focus": prompt}
    return {"intent": "business_summary", "direction": "none", "threshold_kg": 0, "window_days": window_days, "profile_terms": [], "answer_focus": prompt}


def _classify_client_query(prompt: str) -> Dict[str, Any]:
    fallback = _fallback_classify_client_query(prompt)
    try:
        classified = classify_client_operations_query(prompt=prompt)
        merged = {**fallback, **{key: value for key, value in classified.items() if value not in [None, "", []]}}
        if float(merged.get("threshold_kg") or 0) <= 0:
            merged["threshold_kg"] = fallback.get("threshold_kg") or 1
        if int(merged.get("window_days") or 0) <= 0:
            merged["window_days"] = fallback.get("window_days") or 7
        return merged
    except Exception as exc:
        logger.warning("AI query classification fallback used: %s", exc)
        return fallback


async def _load_clients_for_ai_query(data: ClientAIQueryRequest, user: dict) -> List[dict]:
    limit = max(1, min(int(data.limit or 200), 500))
    query = _visible_clients_query(user)
    status_filters = [status for status in (data.status_filters or []) if status]
    if status_filters:
        query["status"] = {"$in": status_filters}
    if data.search:
        query["$or"] = [
            {"name": {"$regex": data.search, "$options": "i"}},
            {"email": {"$regex": data.search, "$options": "i"}},
            {"phone": {"$regex": data.search, "$options": "i"}},
        ]
    return await db.clients.find(query, {"_id": 0}).sort("name", 1).limit(limit).to_list(limit)


def _table_block(title: str, columns: List[str], rows: List[List[Any]]) -> Dict[str, Any]:
    return {"type": "table", "title": title, "columns": columns, "rows": rows, "items": []}


async def _resolve_weight_change_query(clients: List[dict], params: Dict[str, Any]) -> Dict[str, Any]:
    client_ids = [client["id"] for client in clients if client.get("id")]
    client_by_id = {client["id"]: client for client in clients if client.get("id")}
    today = _today_local_date()
    window_days = max(1, int(params.get("window_days") or 10))
    start_date = today - timedelta(days=window_days)
    direction = params.get("direction") or "loss"
    threshold = float(params.get("threshold_kg") or 1)
    entries = await db.weight_entries.find(
        {"client_id": {"$in": client_ids}, "recorded_date": {"$gte": start_date.isoformat(), "$lte": today.isoformat()}},
        {"_id": 0, "client_id": 1, "recorded_date": 1, "weight_kg": 1},
    ).sort([("client_id", 1), ("recorded_date", 1)]).to_list(5000)

    grouped: Dict[str, List[dict]] = {}
    for entry in entries:
        if isinstance(entry.get("weight_kg"), (int, float)):
            grouped.setdefault(entry["client_id"], []).append(entry)

    rows = []
    insufficient = 0
    for client_id, client in client_by_id.items():
        client_entries = grouped.get(client_id, [])
        if len(client_entries) < 2:
            insufficient += 1
            continue
        earliest = client_entries[0]
        latest = client_entries[-1]
        change = float(latest["weight_kg"]) - float(earliest["weight_kg"])
        matched = False
        if direction == "loss":
            matched = change <= -threshold
            display_delta = abs(change)
            title = f"Clients with >={threshold:g} kg loss"
            delta_label = "Weight Lost"
        elif direction == "gain":
            matched = change >= threshold
            display_delta = change
            title = f"Clients with >={threshold:g} kg gain"
            delta_label = "Weight Gained"
        else:
            matched = abs(change) >= threshold
            display_delta = change
            title = f"Clients with >={threshold:g} kg change"
            delta_label = "Weight Change"
        if matched:
            rows.append([
                client.get("name"),
                f"{display_delta:.1f} kg",
                f"{earliest['weight_kg']} kg",
                f"{latest['weight_kg']} kg",
                f"{earliest['recorded_date']} to {latest['recorded_date']}",
            ])

    answer = f"{len(rows)} client{'s' if len(rows) != 1 else ''} matched the {direction} query in the last {window_days} days."
    return {
        "intent": "weight_change",
        "answer_text": answer,
        "result_blocks": [_table_block(title, ["Client", delta_label, "From", "To", "Date Range"], rows)],
        "recommended_actions": ["Review clients with no recent weight logs and ask for updated weight entries."] if insufficient else [],
        "follow_up_questions": [],
        "confidence_notes": [f"{insufficient} visible client(s) had fewer than 2 weight logs in the selected window and were excluded."] if insufficient else [],
    }


def _resolve_date_window_query(clients: List[dict], params: Dict[str, Any], *, intent: str, field: str, title: str) -> Dict[str, Any]:
    today = _today_local_date()
    window_days = max(0, int(params.get("window_days") or 7))
    end_date = today + timedelta(days=window_days)
    rows = []
    missing = 0
    for client in clients:
        target = _parse_iso_date(client.get(field))
        if not target:
            missing += 1
            continue
        if today <= target <= end_date:
            rows.append([
                client.get("name"),
                target.isoformat(),
                (target - today).days,
                client.get("status") or "—",
            ])
    rows.sort(key=lambda row: (row[1], row[0] or ""))
    answer = f"{len(rows)} client{'s' if len(rows) != 1 else ''} found from {today.isoformat()} to {end_date.isoformat()}."
    return {
        "intent": intent,
        "answer_text": answer,
        "result_blocks": [_table_block(title, ["Client", "Date", "Days Left", "Status"], rows)],
        "recommended_actions": ["Prepare renewals, plan updates, or follow-up messages for clients closest to expiry."] if rows else [],
        "follow_up_questions": [],
        "confidence_notes": [f"{missing} visible client(s) had no {title.lower()} date and were excluded."] if missing else [],
    }


def _resolve_profile_search_query(clients: List[dict], params: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    terms = [_normalize_match_text(term) for term in (params.get("profile_terms") or []) if _normalize_match_text(term)]
    if not terms:
        terms = [word for word in _normalize_match_text(prompt).split() if len(word) >= 4]
    rows = []
    for client in clients:
        matched_fields = []
        matched_values = []
        for field in CLIENT_PROFILE_SEARCH_FIELDS:
            value = client.get(field)
            values = _coerce_text_list(value) if isinstance(value, list) else [value]
            haystack = _normalize_match_text(" ".join(str(item or "") for item in values))
            if not terms or any(term in haystack for term in terms):
                if haystack:
                    matched_fields.append(field.replace("_", " ").title())
                    matched_values.extend([str(item) for item in values if item])
        if matched_fields:
            rows.append([client.get("name"), ", ".join(sorted(set(matched_fields))), "; ".join(matched_values[:6])])

    answer = f"{len(rows)} client{'s' if len(rows) != 1 else ''} matched the profile search."
    return {
        "intent": "client_profile_search",
        "answer_text": answer,
        "result_blocks": [_table_block("Client profile matches", ["Client", "Matched Fields", "Matched Values"], rows)],
        "recommended_actions": ["Open the client profile before changing diet recommendations."] if rows else [],
        "follow_up_questions": [],
        "confidence_notes": [] if terms else ["No specific search terms were detected, so all non-empty profile food/health fields were listed."],
    }


def _resolve_business_summary_query(clients: List[dict], prompt: str) -> Dict[str, Any]:
    status_counts: Dict[str, int] = {}
    expiring_soon = 0
    today = _today_local_date()
    for client in clients:
        status = client.get("status") or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
        diet_end = _parse_iso_date(client.get("diet_end_date"))
        if diet_end and today <= diet_end <= today + timedelta(days=7):
            expiring_soon += 1
    rows = [[status, count] for status, count in sorted(status_counts.items())]
    return {
        "intent": "business_summary",
        "answer_text": f"{len(clients)} visible clients analyzed. {expiring_soon} diet(s) expire in the next 7 days.",
        "result_blocks": [_table_block("Client count by status", ["Status", "Clients"], rows)],
        "recommended_actions": [
            "Use specific prompts for exact reports, such as weight loss in 10 days, diet expiry, or follow-up due.",
            "Review diet expiries due this week before creating new plans.",
        ],
        "follow_up_questions": ["Do you want the exact list of diets expiring this week?"],
        "confidence_notes": ["This is a deterministic summary. Ask a more specific question for exact client lists."],
    }


async def _resolve_client_ai_query(clients: List[dict], prompt: str, params: Dict[str, Any]) -> Dict[str, Any]:
    intent = params.get("intent") or "business_summary"
    if intent == "weight_change":
        return await _resolve_weight_change_query(clients, params)
    if intent == "diet_expiry":
        return _resolve_date_window_query(clients, params, intent="diet_expiry", field="diet_end_date", title="Diet Expiry")
    if intent == "program_expiry":
        return _resolve_date_window_query(clients, params, intent="program_expiry", field="program_end_date", title="Program Expiry")
    if intent == "follow_up_due":
        return _resolve_date_window_query(clients, params, intent="follow_up_due", field="upcoming_follow_up_date", title="Upcoming Follow-up")
    if intent in {"client_profile_search", "diet_conflict_check"}:
        result = _resolve_profile_search_query(clients, params, prompt)
        result["intent"] = intent
        if intent == "diet_conflict_check":
            result["confidence_notes"].append("For exact diet-vs-allergy checks, upload or parse a diet plan for a selected client.")
        return result
    return _resolve_business_summary_query(clients, prompt)


def _field_conflict_type(field_name: str) -> str:
    if field_name == "allergies":
        return "allergy"
    if field_name == "medical_food_restrictions":
        return "medical_restriction"
    if field_name == "disliked_foods":
        return "disliked_food"
    return "avoid_food"


def _suggest_food_replacement(item: str) -> str:
    normalized = _normalize_food_key(item)
    for key, replacement in FOOD_REPLACEMENT_SUGGESTIONS.items():
        if _normalize_food_key(key) in normalized or normalized in _normalize_food_key(key):
            return replacement
    return "Use a suitable Indian replacement that respects the client's preference and restrictions"


def _iter_diet_text_slots(day_wise_plan: List[Dict[str, Any]], summary_slots: Dict[str, str]):
    for key, value in (summary_slots or {}).items():
        if str(value or "").strip():
            yield None, key, str(value)
    for day in day_wise_plan or []:
        day_number = day.get("day")
        for key, value in day.items():
            if key == "day" or not str(value or "").strip():
                continue
            yield day_number, key, str(value)


def _find_diet_conflicts(client_record: dict, day_wise_plan: List[Dict[str, Any]], summary_slots: Dict[str, str]) -> Dict[str, Any]:
    conflicts = []
    seen = set()
    restriction_items = []
    for field_name in CLIENT_FOOD_LIST_FIELDS:
        for value in _coerce_text_list(client_record.get(field_name)):
            normalized_value = _normalize_food_key(value)
            if normalized_value:
                restriction_items.append((field_name, value, normalized_value))

    if not restriction_items:
        return {
            "summary": "No structured allergy or avoid-food data is available for this client.",
            "conflicts": [],
            "safe_notes": [],
            "confidence_notes": ["Add structured allergies or avoid-foods to the client profile for reliable safety checks."],
        }

    for day_number, slot, text in _iter_diet_text_slots(day_wise_plan, summary_slots):
        normalized_text = f" {_normalize_food_key(text)} "
        for field_name, item, normalized_item in restriction_items:
            if not normalized_item:
                continue
            pattern = f" {normalized_item} "
            if pattern not in normalized_text and normalized_item not in normalized_text:
                continue
            key = (day_number, slot, field_name, normalized_item)
            if key in seen:
                continue
            seen.add(key)
            conflicts.append(
                {
                    "day": day_number,
                    "slot": slot,
                    "item": item,
                    "conflict_type": _field_conflict_type(field_name),
                    "matched_client_field": field_name,
                    "reason": f"Client {field_name.replace('_', ' ')} includes '{item}', and the diet text contains a matching item.",
                    "suggested_replacement": _suggest_food_replacement(item),
                }
            )

    safe_notes = []
    if not conflicts:
        safe_notes.append("No exact structured allergy/avoid-food conflicts were found in this draft.")

    return {
        "summary": f"{len(conflicts)} possible conflict{'s' if len(conflicts) != 1 else ''} found.",
        "conflicts": conflicts,
        "safe_notes": safe_notes,
        "confidence_notes": [
            "Matching is based on normalized text from structured client food fields and the parsed diet draft.",
            "Review manually for spelling variants, regional food names, and hidden ingredients.",
        ],
    }


@api_router.post("/clients/ai/analyze", response_model=ClientAIBusinessAnalysisResponse)
async def analyze_clients_with_ai(data: ClientAIBusinessAnalysisRequest, user: dict = Depends(get_current_user)):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")

    limit = max(1, min(int(data.limit or 100), 200))
    query = _visible_clients_query(user)
    status_filters = [status for status in (data.status_filters or []) if status]
    if status_filters:
        query["status"] = {"$in": status_filters}
    if data.search:
        query["$or"] = [
            {"name": {"$regex": data.search, "$options": "i"}},
            {"email": {"$regex": data.search, "$options": "i"}},
            {"phone": {"$regex": data.search, "$options": "i"}},
        ]

    client_rows = await db.clients.find(query, {"_id": 0}).sort("name", 1).limit(limit).to_list(limit)
    if not client_rows:
        raise HTTPException(status_code=400, detail="No visible clients found for this AI analysis")

    client_ids = [row["id"] for row in client_rows]
    owner_ids = _visible_client_owner_ids(user)

    file_rows = await db.files.find(
        {
            "coach_id": {"$in": owner_ids},
            "client_id": {"$in": client_ids},
            "is_deleted": False,
            "category": {"$in": ["blood-report", "past-diet", "client-picture"]},
        },
        {"_id": 0, "client_id": 1, "category": 1, "created_at": 1},
    ).to_list(1000)
    meal_rows = await db.meal_uploads.find(
        {"coach_id": {"$in": owner_ids}, "client_id": {"$in": client_ids}},
        {"_id": 0, "client_id": 1, "meal_type": 1, "reviewed": 1, "feedback": 1, "uploaded_at": 1},
    ).sort("uploaded_at", -1).to_list(1000)
    checkin_rows = await db.daily_checkins.find(
        {"client_id": {"$in": client_ids}},
        {"_id": 0, "client_id": 1, "date": 1, "adherence_score": 1, "weight_kg": 1, "meals": 1},
    ).sort("date", -1).to_list(1000)
    ai_health_rows = await db.client_ai_analyses.find(
        {"client_id": {"$in": client_ids}, "analysis_type": "health-analysis"},
        {"_id": 0, "client_id": 1, "overall_summary": 1, "clinical_risks": 1, "nutrition_gaps": 1, "generated_at": 1},
    ).to_list(500)

    file_context: Dict[str, Dict[str, int]] = {}
    for row in file_rows:
        client_context = file_context.setdefault(row.get("client_id"), {})
        category = row.get("category") or "unknown"
        client_context[category] = client_context.get(category, 0) + 1

    meal_context: Dict[str, Dict[str, Any]] = {}
    for row in meal_rows:
        client_context = meal_context.setdefault(
            row.get("client_id"),
            {"total": 0, "unreviewed": 0, "latest_feedback": None, "latest_upload_at": None},
        )
        client_context["total"] += 1
        if not row.get("reviewed"):
            client_context["unreviewed"] += 1
        if not client_context.get("latest_upload_at"):
            client_context["latest_upload_at"] = row.get("uploaded_at")
        if row.get("feedback") and not client_context.get("latest_feedback"):
            client_context["latest_feedback"] = row.get("feedback")

    checkin_context: Dict[str, Dict[str, Any]] = {}
    for row in checkin_rows:
        client_context = checkin_context.setdefault(
            row.get("client_id"),
            {"checkin_count": 0, "latest_date": None, "latest_adherence_score": None, "avg_recent_adherence_score": None},
        )
        client_context["checkin_count"] += 1
        if not client_context.get("latest_date"):
            client_context["latest_date"] = row.get("date")
            client_context["latest_adherence_score"] = row.get("adherence_score")
    for client_id, client_context in checkin_context.items():
        scores = [
            row.get("adherence_score")
            for row in checkin_rows
            if row.get("client_id") == client_id and isinstance(row.get("adherence_score"), (int, float))
        ][:14]
        if scores:
            client_context["avg_recent_adherence_score"] = round(sum(scores) / len(scores), 1)

    ai_health_context = {row.get("client_id"): row for row in ai_health_rows}
    status_counts: Dict[str, int] = {}
    for row in client_rows:
        status = row.get("status") or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1

    def compact_client(row: dict) -> dict:
        client_id = row.get("id")
        health_analysis = ai_health_context.get(client_id) or {}
        return {
            "id": client_id,
            "name": row.get("name"),
            "status": row.get("status"),
            "age": row.get("age"),
            "gender": row.get("gender"),
            "diet_preference": row.get("diet_preference"),
            "profession": row.get("profession"),
            "location": row.get("location"),
            "health_issues": row.get("health_issues"),
            "allergies": _coerce_text_list(row.get("allergies")),
            "avoid_foods": _coerce_text_list(row.get("avoid_foods")),
            "preferred_foods": _coerce_text_list(row.get("preferred_foods")),
            "disliked_foods": _coerce_text_list(row.get("disliked_foods")),
            "medical_food_restrictions": _coerce_text_list(row.get("medical_food_restrictions")),
            "recent_comment": row.get("recent_comment"),
            "diet_start_date": row.get("diet_start_date"),
            "diet_end_date": row.get("diet_end_date"),
            "program_start_date": row.get("program_start_date"),
            "program_end_date": row.get("program_end_date"),
            "last_follow_up_date": row.get("last_follow_up_date"),
            "upcoming_follow_up_date": row.get("upcoming_follow_up_date"),
            "initial_weight_kg": row.get("initial_weight_kg"),
            "current_weight_kg": row.get("current_weight_kg"),
            "goal_weight_kg": row.get("goal_weight_kg"),
            "sleep_quality": row.get("sleep_quality"),
            "sleep_hours": row.get("sleep_hours"),
            "morning_freshness": row.get("morning_freshness"),
            "adherence_rate": row.get("adherence_rate"),
            "about_client": (row.get("about_client") or "")[:500],
            "notes": (row.get("notes") or "")[:500],
            "uploaded_file_counts": file_context.get(client_id, {}),
            "meal_upload_summary": meal_context.get(client_id, {}),
            "tracker_summary": checkin_context.get(client_id, {}),
            "latest_ai_health_summary": health_analysis.get("overall_summary"),
            "latest_ai_clinical_risks": health_analysis.get("clinical_risks") or [],
            "latest_ai_nutrition_gaps": health_analysis.get("nutrition_gaps") or [],
        }

    context_summary = {
        "client_count": len(client_rows),
        "status_counts": status_counts,
        "filters": {"status_filters": status_filters, "search": data.search, "limit": limit},
        "available_context": [
            "client profile fields",
            "routine fields from profile",
            "diet and program dates",
            "recent team comments",
            "uploaded blood-report/past-diet/client-picture counts",
            "meal upload counts and review status",
            "daily tracker adherence summary when present",
            "previous per-client AI health summary when present",
        ],
    }

    try:
        analysis_payload = generate_client_business_analysis(
            clients=[compact_client(row) for row in client_rows],
            prompt=data.prompt,
            context_summary=context_summary,
        )
    except OpenAIAPIError as exc:
        detail = str(exc)
        status_code = 503 if "_API_KEY" in detail else 502
        raise HTTPException(status_code=status_code, detail=detail)

    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    response_doc = {
        "analysis_id": analysis_id,
        "model": get_default_model(),
        "generated_at": now,
        "client_count": len(client_rows),
        **analysis_payload,
    }

    await db.client_ai_business_analyses.insert_one(
        {
            "id": analysis_id,
            "coach_id": user["id"],
            "prompt": data.prompt,
            "filters": context_summary["filters"],
            "client_ids": client_ids,
            "payload": analysis_payload,
            "model": response_doc["model"],
            "created_at": now,
        }
    )
    await _write_audit_log(
        user=user,
        event_type="client-ai-business-analysis-generated",
        entity_type="client-ai-analysis",
        entity_id=analysis_id,
        summary=f"Generated client AI business analysis for {len(client_rows)} clients",
        metadata={"model": response_doc["model"], "client_count": len(client_rows)},
    )

    return ClientAIBusinessAnalysisResponse(**response_doc)


@api_router.post("/clients/ai/query", response_model=ClientAIQueryResponse)
async def query_clients_with_ai(data: ClientAIQueryRequest, user: dict = Depends(get_current_user)):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    prompt = (data.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    clients = await _load_clients_for_ai_query(data, user)
    if not clients:
        raise HTTPException(status_code=400, detail="No visible clients found for this query")

    params = _classify_client_query(prompt)
    result = await _resolve_client_ai_query(clients, prompt, params)
    query_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    response_doc = {
        "query_id": query_id,
        "intent": result.get("intent") or params.get("intent") or "business_summary",
        "answer_text": result.get("answer_text") or "No answer generated.",
        "result_blocks": result.get("result_blocks") or [],
        "recommended_actions": result.get("recommended_actions") or [],
        "follow_up_questions": result.get("follow_up_questions") or [],
        "confidence_notes": result.get("confidence_notes") or [],
    }

    await db.client_ai_queries.insert_one(
        {
            "id": query_id,
            "coach_id": user["id"],
            "prompt": prompt,
            "classification": params,
            "filters": {
                "status_filters": data.status_filters,
                "search": data.search,
                "limit": data.limit,
            },
            "payload": response_doc,
            "created_at": now,
        }
    )

    await _write_audit_log(
        user=user,
        event_type="client-ai-query-generated",
        entity_type="client-ai-query",
        entity_id=query_id,
        summary=f"Generated client AI query for intent {response_doc['intent']}",
        metadata={"intent": response_doc["intent"], "client_count": len(clients)},
    )

    return ClientAIQueryResponse(**response_doc)


@api_router.get("/clients/ai/query-history", response_model=List[ClientAIQueryHistoryItemResponse])
async def get_client_ai_query_history(
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")

    safe_limit = max(1, min(int(limit or 20), 100))
    rows = await db.client_ai_queries.find(
        {"coach_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).limit(safe_limit).to_list(safe_limit)

    history_items = []
    for row in rows:
        payload = row.get("payload") or {}
        history_items.append(
            ClientAIQueryHistoryItemResponse(
                prompt=row.get("prompt") or "",
                filters=row.get("filters") or {},
                created_at=row.get("created_at") or "",
                query_id=payload.get("query_id") or row.get("id") or "",
                intent=payload.get("intent") or "business_summary",
                answer_text=payload.get("answer_text") or "",
                result_blocks=payload.get("result_blocks") or [],
                recommended_actions=payload.get("recommended_actions") or [],
                follow_up_questions=payload.get("follow_up_questions") or [],
                confidence_notes=payload.get("confidence_notes") or [],
            )
        )

    return history_items


# ============ LEAD ROUTES ============
def _validate_lead_status(status: Optional[str]) -> Optional[str]:
    if status is None:
        return status
    normalized = status.strip().lower()
    normalized = LEGACY_LEAD_STATUS_MAP.get(normalized, normalized)
    if normalized not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid lead status")
    return normalized


def _normalize_lead_doc(lead: dict) -> dict:
    normalized = {**lead}
    normalized["status"] = _validate_lead_status(normalized.get("status") or "new") or "new"
    return normalized


@api_router.get("/leads", response_model=List[LeadResponse])
async def get_leads(
    status: Optional[str] = None,
    search: Optional[str] = None,
    month: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    user: dict = Depends(get_current_user)
):
    query = _visible_shared_owner_query(user)
    if status:
        normalized_status = _validate_lead_status(status)
        legacy_values = [key for key, value in LEGACY_LEAD_STATUS_MAP.items() if value == normalized_status]
        query["status"] = {"$in": [normalized_status, *legacy_values]}
    if month:
        if not re.match(r"^\d{4}-\d{2}$", month):
            raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")
        query["created_at"] = {"$regex": f"^{month}"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"source": {"$regex": search, "$options": "i"}},
        ]

    leads = await db.leads.find(query, {"_id": 0}).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    return [LeadResponse(**_normalize_lead_doc(lead)) for lead in leads]


@api_router.post("/leads", response_model=LeadResponse)
async def create_lead(data: LeadCreate, user: dict = Depends(get_current_user)):
    lead_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    payload = data.model_dump()
    payload["status"] = _validate_lead_status(payload.get("status") or "new")
    lead_doc = {
        "id": lead_id,
        "coach_id": SHARED_CLIENT_OWNER_ID,
        **payload,
        "created_at": now,
        "updated_at": now,
    }
    await db.leads.insert_one(lead_doc)
    lead_doc.pop("_id", None)
    return LeadResponse(**_normalize_lead_doc(lead_doc))


@api_router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one(_visible_shared_owner_query(user, {"id": lead_id}), {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadResponse(**_normalize_lead_doc(lead))


@api_router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: str, data: LeadUpdate, user: dict = Depends(get_current_user)):
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = _validate_lead_status(update_data.get("status"))
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.leads.find_one_and_update(
        _visible_shared_owner_query(user, {"id": lead_id}),
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Lead not found")
    result.pop("_id", None)
    return LeadResponse(**_normalize_lead_doc(result))


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    result = await db.leads.delete_one(_visible_shared_owner_query(user, {"id": lead_id}))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}


@api_router.get("/clients/weight-summaries", response_model=List[ClientWeightSummaryResponse])
async def get_client_weight_summaries(entries: int = 10, user: dict = Depends(get_current_user)):
    return await get_client_weight_summaries_handler(
        db=db,
        entries=entries,
        user=user,
        visible_clients_query=_visible_clients_query,
    )

@api_router.post("/clients", response_model=ClientResponse)
async def create_client(data: ClientCreate, user: dict = Depends(get_current_user)):
    client_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    current_weight = data.current_weight_kg if data.current_weight_kg is not None else data.initial_weight_kg
    payload = data.model_dump()
    primary_coach_id = payload.get("primary_coach_id")
    if primary_coach_id:
        staff_member = await db.staff_members.find_one({"id": primary_coach_id, "status": "active"}, {"_id": 0, "name": 1})
        if staff_member:
            payload["primary_coach"] = staff_member.get("name")
    client_doc = {
        "id": client_id,
        "coach_id": SHARED_CLIENT_OWNER_ID,
        **payload,
        "current_weight_kg": current_weight,
        "adherence_rate": 0.0,
        "created_at": now,
        "updated_at": now
    }
    await db.clients.insert_one(client_doc)
    await _write_audit_log(
        user=user,
        event_type="client-created",
        entity_type="client",
        entity_id=client_id,
        client_id=client_id,
        client_name=client_doc.get("name"),
        summary=f"Added client {client_doc.get('name')}",
        metadata={
            "created_at": now,
            "status": client_doc.get("status"),
        },
    )
    client_doc.pop("_id", None)
    return ClientResponse(**client_doc)

@api_router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    client = await _get_visible_client(client_id, user, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientResponse(**client)

@api_router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, data: ClientUpdate, user: dict = Depends(get_current_user)):
    existing = await _get_visible_client(client_id, user, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = data.model_dump(exclude_unset=True)
    primary_coach_id = update_data.get("primary_coach_id")
    if primary_coach_id:
        staff_member = await db.staff_members.find_one({"id": primary_coach_id, "status": "active"}, {"_id": 0, "name": 1})
        if staff_member:
            update_data["primary_coach"] = staff_member.get("name")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.clients.find_one_and_update(
        _visible_clients_query(user, {"id": client_id}),
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Client not found")

    tracked_date_fields = [
        "diet_start_date",
        "diet_end_date",
        "last_follow_up_date",
        "upcoming_follow_up_date",
        "program_start_date",
        "program_end_date",
    ]
    changed_date_fields = []
    for field in tracked_date_fields:
        if field not in update_data:
            continue
        if existing.get(field) == result.get(field):
            continue
        changed_date_fields.append(
            {
                "field": field,
                "from": existing.get(field),
                "to": result.get(field),
            }
        )

    if changed_date_fields:
        await _write_audit_log(
            user=user,
            event_type="client-date-updated",
            entity_type="client",
            entity_id=client_id,
            client_id=client_id,
            client_name=result.get("name"),
            summary=f"Updated client date fields for {result.get('name')}",
            metadata={"changes": changed_date_fields},
        )

    result.pop("_id", None)
    return ClientResponse(**result)


@api_router.get("/clients/{client_id}/comments", response_model=List[ClientCommentResponse])
async def get_client_comments(client_id: str, limit: int = 100, user: dict = Depends(get_current_user)):
    return await get_client_comments_handler(
        db=db,
        client_id=client_id,
        limit=limit,
        user=user,
        get_visible_client=_get_visible_client,
    )


@api_router.post("/clients/{client_id}/comments", response_model=ClientCommentResponse)
async def add_client_comment(client_id: str, data: ClientCommentCreate, user: dict = Depends(get_current_user)):
    return await add_client_comment_handler(
        db=db,
        client_id=client_id,
        data=data,
        user=user,
        get_visible_client=_get_visible_client,
    )

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    existing = await _get_visible_client(client_id, user, {"_id": 0, "id": 1, "name": 1})
    result = await db.clients.delete_one(_visible_clients_query(user, {"id": client_id}))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    if existing:
        await _write_audit_log(
            user=user,
            event_type="client-deleted",
            entity_type="client",
            entity_id=client_id,
            client_id=client_id,
            client_name=existing.get("name"),
            summary=f"Deleted client {existing.get('name')}",
        )
    return {"message": "Client deleted"}

# ============ WEIGHT ENTRY ROUTES ============
@api_router.get("/clients/{client_id}/weights", response_model=List[WeightEntryResponse])
async def get_weight_entries(client_id: str, limit: int = 100, user: dict = Depends(get_current_user)):
    return await get_weight_entries_handler(
        db=db,
        client_id=client_id,
        limit=limit,
        user=user,
        get_visible_client=_get_visible_client,
    )

@api_router.post("/clients/{client_id}/weights", response_model=WeightEntryResponse)
async def add_weight_entry(client_id: str, data: WeightEntryCreate, user: dict = Depends(get_current_user)):
    return await add_weight_entry_handler(
        db=db,
        client_id=client_id,
        data=data,
        user=user,
        get_visible_client=_get_visible_client,
    )


@api_router.put("/clients/{client_id}/weights/by-date", response_model=WeightEntryResponse)
async def upsert_weight_entry_by_date(client_id: str, data: WeightEntryUpsertRequest, user: dict = Depends(get_current_user)):
    return await upsert_weight_entry_by_date_handler(
        db=db,
        client_id=client_id,
        data=data,
        user=user,
        get_visible_client=_get_visible_client,
        parse_weight_date=_parse_weight_date,
    )


@api_router.post("/clients/{client_id}/weights/parse-upload", response_model=WeightImportParseResponse)
async def parse_weight_upload(
    client_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    return await parse_weight_upload_handler(
        client_id=client_id,
        file=file,
        user=user,
        get_visible_client=_get_visible_client,
        extract_text_from_weight_upload=_extract_text_from_weight_upload,
        parse_weight_import_payload=_parse_weight_import_payload,
    )


@api_router.post("/clients/{client_id}/weights/parse-text", response_model=WeightImportParseResponse)
async def parse_weight_text(
    client_id: str,
    payload: WeightImportTextRequest,
    user: dict = Depends(get_current_user),
):
    return await parse_weight_text_handler(
        client_id=client_id,
        payload=payload,
        user=user,
        get_visible_client=_get_visible_client,
        parse_weight_import_payload=_parse_weight_import_payload,
    )


@api_router.post("/clients/{client_id}/weights/bulk", response_model=WeightImportSaveResponse)
async def save_bulk_weight_entries(
    client_id: str,
    payload: WeightImportSaveRequest,
    user: dict = Depends(get_current_user),
):
    return await save_bulk_weight_entries_handler(
        db=db,
        client_id=client_id,
        payload=payload,
        user=user,
        get_visible_client=_get_visible_client,
        sanitize_weight_import_entries=_sanitize_weight_import_entries,
    )


@api_router.get("/clients/{client_id}/tracker", response_model=TrackerMonthResponse)
async def get_client_monthly_tracker(
    client_id: str,
    month: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    return await get_client_monthly_tracker_handler(
        db=db,
        client_id=client_id,
        month=month,
        user=user,
        get_visible_client=_get_visible_client,
        extract_tracker_activities=_extract_tracker_activities,
    )


@api_router.put("/clients/{client_id}/tracker/activity")
async def upsert_client_tracker_activity(
    client_id: str,
    data: TrackerActivityUpdateRequest,
    user: dict = Depends(get_current_user),
):
    return await upsert_client_tracker_activity_handler(
        db=db,
        client_id=client_id,
        data=data,
        user=user,
        get_visible_client=_get_visible_client,
        parse_weight_date=_parse_weight_date,
        normalize_tracker_activity_name=_normalize_tracker_activity_name,
    )

# ============ DIET PLAN ROUTES ============
@api_router.get("/diet-plans", response_model=List[DietPlanResponse])
async def get_diet_plans(
    client_id: Optional[str] = None,
    plan_type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"coach_id": user["id"]}
    if client_id:
        query["client_id"] = client_id
    if plan_type:
        if plan_type not in DIET_PLAN_TYPES:
            raise HTTPException(status_code=400, detail="Invalid plan_type")
        query["plan_type"] = plan_type
    plans = await db.diet_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [DietPlanResponse(**_normalize_diet_plan_doc(p)) for p in plans]

@api_router.post("/diet-plans", response_model=DietPlanResponse)
async def create_diet_plan(data: DietPlanCreate, user: dict = Depends(get_current_user)):
    plan_type = data.plan_type or DIET_PLAN_TYPE_CLIENT
    if plan_type not in DIET_PLAN_TYPES:
        raise HTTPException(status_code=400, detail="Invalid plan_type")
    if data.export_layout not in DIET_EXPORT_LAYOUTS:
        raise HTTPException(status_code=400, detail="Invalid export_layout")

    if plan_type == DIET_PLAN_TYPE_CLIENT:
        if not data.client_id:
            raise HTTPException(status_code=400, detail="client_id is required for client plans")
        client = await _get_visible_client(data.client_id, user)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
    else:
        if data.source_template_id:
            source_template = await db.diet_plans.find_one(
                {"id": data.source_template_id, "coach_id": user["id"]},
                {"_id": 0}
            )
            normalized_source = _normalize_diet_plan_doc(source_template)
            if not normalized_source or normalized_source.get("plan_type") != DIET_PLAN_TYPE_TEMPLATE:
                raise HTTPException(status_code=404, detail="Source template not found")
    
    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    plan_doc = {
        "id": plan_id,
        "coach_id": user["id"],
        **data.model_dump(),
        "client_id": data.client_id if plan_type == DIET_PLAN_TYPE_CLIENT else None,
        "meals": [m.model_dump() for m in data.meals],
        "plan_type": plan_type,
        "version": 1,
        "created_at": now,
        "updated_at": now
    }
    await db.diet_plans.insert_one(plan_doc)
    plan_doc.pop("_id", None)
    return DietPlanResponse(**_normalize_diet_plan_doc(plan_doc))


@api_router.post("/diet-plans/parse-template-pdf")
async def parse_template_pdf(
    file: UploadFile = File(...),
    duration_days: int = Form(...),
    diet_preference: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    if duration_days not in [7, 10, 14]:
        raise HTTPException(status_code=400, detail="duration_days must be one of 7, 10 or 14")

    if file.content_type not in ["application/pdf", "application/octet-stream"] and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")

    if client_id:
        client = await _get_visible_client(client_id, user, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

    try:
        from pypdf import PdfReader
    except Exception:
        try:
            from PyPDF2 import PdfReader  # type: ignore
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="PDF parser dependency not available. Install with: pip install pypdf==6.7.5",
            )

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    page_texts = [(_clean_text(page.extract_text() or "")) for page in reader.pages]
    non_empty_pages = [text for text in page_texts if text]
    if not non_empty_pages:
        raise HTTPException(status_code=400, detail="PDF has no extractable text. OCR PDFs are not supported in v1.")

    blocks = _split_template_blocks(non_empty_pages)
    if not blocks:
        blocks = ["\n".join(non_empty_pages)]

    parsed_templates = []
    parse_warnings = []
    for block_index, block in enumerate(blocks, start=1):
        day_wise_plan = _parse_day_wise_plan(block)
        if not day_wise_plan:
            parse_warnings.append(f"Template block {block_index} had no day entries and was skipped.")
            continue
        prefix_slots = _extract_prefix_slots(block)
        summary_slots = _build_summary_slots(prefix_slots, day_wise_plan)
        detected_days = max([int(entry["day"]) for entry in day_wise_plan]) if day_wise_plan else 0
        parsed_templates.append({
            "name": _extract_template_title(block, f"Template {block_index}"),
            "day_wise_plan": day_wise_plan,
            "summary_slots": summary_slots,
            "detected_days": detected_days,
            "raw_text": block,
        })

    if not parsed_templates:
        raise HTTPException(status_code=400, detail="Could not parse any day-wise diet template from this PDF")

    selected_template = parsed_templates[0]
    selected_score = None
    for template in parsed_templates:
        detected_days = template["detected_days"] or len(template["day_wise_plan"])
        duration_exact = 1 if detected_days == duration_days else 0
        preference_score = _diet_preference_score(diet_preference, template["raw_text"])
        score = (duration_exact, preference_score)
        # Tie-break keeps first encountered template.
        if selected_score is None or score > selected_score:
            selected_score = score
            selected_template = template

    normalized_days = _normalize_day_wise_plan(selected_template["day_wise_plan"], duration_days)
    selected_summary = _finalize_summary_slots(selected_template["summary_slots"], normalized_days)

    return {
        "selected_template_name": selected_template["name"],
        "plan_days": duration_days,
        "summary_slots": selected_summary,
        "day_wise_plan": normalized_days,
        "visible_columns": DEFAULT_VISIBLE_COLUMNS,
        "parse_warnings": parse_warnings
    }


@api_router.post("/diet-plans/ai/analyze")
async def analyze_diet_plan_with_ai(
    data: DietPlanAIAnalyzeRequest,
    user: dict = Depends(get_current_user),
):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    if data.plan_days not in [7, 10, 14]:
        raise HTTPException(status_code=400, detail="plan_days must be one of 7, 10 or 14")

    client_record = await _get_visible_client(data.client_id, user, {"_id": 0})
    if not client_record:
        raise HTTPException(status_code=404, detail="Client not found")

    normalized_days = _normalize_day_wise_plan(data.day_wise_plan or [], data.plan_days)
    summary_slots = _finalize_summary_slots(data.summary_slots or {}, normalized_days)
    client_context = _build_diet_ai_client_context(client_record)
    plan_fingerprint = _build_diet_plan_fingerprint(
        client_id=data.client_id,
        plan_days=data.plan_days,
        day_wise_plan=normalized_days,
        summary_slots=summary_slots,
    )

    try:
        analysis_payload = generate_diet_plan_analysis(
            client=client_record,
            plan_days=data.plan_days,
            day_wise_plan=normalized_days,
            summary_slots=summary_slots,
            client_context=client_context,
        )
    except OpenAIAPIError as exc:
        detail = str(exc)
        status_code = 503 if "_API_KEY" in detail else 502
        raise HTTPException(status_code=status_code, detail=detail)

    now = datetime.now(timezone.utc).isoformat()
    analysis_id = str(uuid.uuid4())
    artifact_doc = {
        "id": analysis_id,
        "client_id": data.client_id,
        "coach_id": user["id"],
        "source_type": "parsed_pdf" if data.source_filename else "manual_plan",
        "source_filename": data.source_filename,
        "plan_fingerprint": plan_fingerprint,
        "plan_days": data.plan_days,
        "day_wise_plan": normalized_days,
        "summary_slots": summary_slots,
        "client_context": client_context,
        "analysis_payload": analysis_payload,
        "latest_suggestions": [],
        "model": get_default_model(),
        "created_at": now,
        "updated_at": now,
    }
    await db.diet_ai_artifacts.update_one(
        {"coach_id": user["id"], "client_id": data.client_id, "plan_fingerprint": plan_fingerprint},
        {"$set": artifact_doc},
        upsert=True,
    )

    await _write_audit_log(
        user=user,
        event_type="diet-ai-analysis-generated",
        entity_type="diet-ai-analysis",
        entity_id=analysis_id,
        client_id=data.client_id,
        client_name=client_record.get("name"),
        summary=f"Generated AI diet analysis for {client_record.get('name', 'client')}",
        metadata={"model": artifact_doc["model"], "plan_fingerprint": plan_fingerprint},
    )

    return {
        "analysis_id": analysis_id,
        "model": artifact_doc["model"],
        "generated_at": now,
        "plan_fingerprint": plan_fingerprint,
        "client_context": client_context,
        **analysis_payload,
    }


@api_router.get("/diet-plans/ai/latest")
async def get_latest_diet_plan_ai_artifact(
    client_id: str,
    plan_fingerprint: str,
    user: dict = Depends(get_current_user),
):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")

    artifact = await db.diet_ai_artifacts.find_one(
        {"coach_id": user["id"], "client_id": client_id, "plan_fingerprint": plan_fingerprint},
        {"_id": 0},
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="AI analysis not found")

    return {
        "analysis_id": artifact["id"],
        "model": artifact.get("model", get_default_model()),
        "generated_at": artifact.get("updated_at") or artifact.get("created_at"),
        "plan_fingerprint": artifact["plan_fingerprint"],
        "client_context": artifact.get("client_context") or {},
        **(artifact.get("analysis_payload") or {}),
        "latest_suggestions": artifact.get("latest_suggestions") or [],
    }


@api_router.post("/diet-plans/ai/suggest")
async def suggest_diet_plan_changes_with_ai(
    data: DietPlanAISuggestRequest,
    user: dict = Depends(get_current_user),
):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    if data.plan_days not in [7, 10, 14]:
        raise HTTPException(status_code=400, detail="plan_days must be one of 7, 10 or 14")
    if not (data.action_key or (data.custom_prompt or "").strip()):
        raise HTTPException(status_code=400, detail="Provide an action_key or custom_prompt")

    client_record = await _get_visible_client(data.client_id, user, {"_id": 0})
    if not client_record:
        raise HTTPException(status_code=404, detail="Client not found")

    normalized_days = _normalize_day_wise_plan(data.day_wise_plan or [], data.plan_days)
    summary_slots = _finalize_summary_slots(data.summary_slots or {}, normalized_days)
    client_context = _build_diet_ai_client_context(client_record)
    plan_fingerprint = _build_diet_plan_fingerprint(
        client_id=data.client_id,
        plan_days=data.plan_days,
        day_wise_plan=normalized_days,
        summary_slots=summary_slots,
    )

    try:
        suggestion_payload = generate_diet_plan_suggestions(
            client=client_record,
            plan_days=data.plan_days,
            day_wise_plan=normalized_days,
            summary_slots=summary_slots,
            client_context=client_context,
            action_key=data.action_key,
            custom_prompt=data.custom_prompt,
            day=data.day,
            slot=data.slot,
        )
    except OpenAIAPIError as exc:
        detail = str(exc)
        status_code = 503 if "_API_KEY" in detail else 502
        raise HTTPException(status_code=status_code, detail=detail)

    suggestion_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    suggestion_doc = {
        "id": suggestion_id,
        "analysis_id": data.analysis_id,
        "prompt_label": suggestion_payload.get("prompt_label"),
        "summary": suggestion_payload.get("summary"),
        "recommendations": suggestion_payload.get("recommendations") or [],
        "proposed_changes": suggestion_payload.get("proposed_changes") or [],
        "follow_up_questions": suggestion_payload.get("follow_up_questions") or [],
        "confidence_notes": suggestion_payload.get("confidence_notes") or [],
        "created_at": now,
    }

    await db.diet_ai_artifacts.update_one(
        {"coach_id": user["id"], "client_id": data.client_id, "plan_fingerprint": plan_fingerprint},
        {
            "$set": {
                "updated_at": now,
                "plan_days": data.plan_days,
                "day_wise_plan": normalized_days,
                "summary_slots": summary_slots,
                "client_context": client_context,
                "source_type": "parsed_pdf" if data.source_filename else "manual_plan",
                "source_filename": data.source_filename,
                "model": get_default_model(),
            },
            "$push": {"latest_suggestions": {"$each": [suggestion_doc], "$slice": -10}},
            "$setOnInsert": {
                "id": data.analysis_id or str(uuid.uuid4()),
                "created_at": now,
                "analysis_payload": {},
                "plan_fingerprint": plan_fingerprint,
            },
        },
        upsert=True,
    )

    await _write_audit_log(
        user=user,
        event_type="diet-ai-suggestion-generated",
        entity_type="diet-ai-analysis",
        entity_id=data.analysis_id or suggestion_id,
        client_id=data.client_id,
        client_name=client_record.get("name"),
        summary=f"Generated AI diet suggestions for {client_record.get('name', 'client')}",
        metadata={"action_key": data.action_key, "custom_prompt": data.custom_prompt, "plan_fingerprint": plan_fingerprint},
    )

    return {
        "suggestion_id": suggestion_id,
        "plan_fingerprint": plan_fingerprint,
        **suggestion_payload,
    }


@api_router.post("/diet-plans/ai/conflict-check", response_model=DietPlanAIConflictCheckResponse)
async def check_diet_plan_conflicts_with_ai(
    data: DietPlanAIConflictCheckRequest,
    user: dict = Depends(get_current_user),
):
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")

    client_record = await _get_visible_client(data.client_id, user, {"_id": 0})
    if not client_record:
        raise HTTPException(status_code=404, detail="Client not found")

    normalized_days = _normalize_day_wise_plan(data.day_wise_plan or [], len(data.day_wise_plan or []) or 7)
    summary_slots = _finalize_summary_slots(data.summary_slots or {}, normalized_days)
    conflict_payload = _find_diet_conflicts(client_record, normalized_days, summary_slots)
    conflict_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    await db.diet_ai_conflict_checks.insert_one(
        {
            "id": conflict_id,
            "client_id": data.client_id,
            "coach_id": user["id"],
            "summary": conflict_payload["summary"],
            "conflicts": conflict_payload["conflicts"],
            "safe_notes": conflict_payload["safe_notes"],
            "confidence_notes": conflict_payload["confidence_notes"],
            "created_at": now,
        }
    )

    return DietPlanAIConflictCheckResponse(conflict_id=conflict_id, **conflict_payload)


@api_router.get("/diet-plans/{plan_id}", response_model=DietPlanResponse)
async def get_diet_plan(plan_id: str, user: dict = Depends(get_current_user)):
    plan = await db.diet_plans.find_one({"id": plan_id, "coach_id": user["id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Diet plan not found")
    return DietPlanResponse(**_normalize_diet_plan_doc(plan))

@api_router.put("/diet-plans/{plan_id}", response_model=DietPlanResponse)
async def update_diet_plan(plan_id: str, data: DietPlanUpdate, user: dict = Depends(get_current_user)):
    update_data = data.model_dump(exclude_unset=True)
    if "plan_type" in update_data and update_data["plan_type"] not in DIET_PLAN_TYPES:
        raise HTTPException(status_code=400, detail="Invalid plan_type")
    if "export_layout" in update_data and update_data["export_layout"] not in DIET_EXPORT_LAYOUTS:
        raise HTTPException(status_code=400, detail="Invalid export_layout")
    if "meals" in update_data:
        update_data["meals"] = [m.model_dump() if hasattr(m, 'model_dump') else m for m in update_data["meals"]]
    if update_data.get("plan_type") == DIET_PLAN_TYPE_TEMPLATE:
        update_data["client_id"] = None
    elif "client_id" in update_data:
        client = await _get_visible_client(update_data["client_id"], user, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Increment version
    result = await db.diet_plans.find_one_and_update(
        {"id": plan_id, "coach_id": user["id"]},
        {"$set": update_data, "$inc": {"version": 1}},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Diet plan not found")
    result.pop("_id", None)
    return DietPlanResponse(**_normalize_diet_plan_doc(result))

@api_router.delete("/diet-plans/{plan_id}")
async def delete_diet_plan(plan_id: str, user: dict = Depends(get_current_user)):
    result = await db.diet_plans.delete_one({"id": plan_id, "coach_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Diet plan not found")
    return {"message": "Diet plan deleted"}

# ============ FOLLOW-UP ROUTES ============
@api_router.get("/follow-ups", response_model=List[FollowUpResponse])
async def get_follow_ups(
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status
    
    follow_ups = await db.follow_ups.find(query, {"_id": 0}).sort("scheduled_date", 1).to_list(100)
    return [FollowUpResponse(**f) for f in follow_ups]

@api_router.post("/follow-ups", response_model=FollowUpResponse)
async def create_follow_up(data: FollowUpCreate, user: dict = Depends(get_current_user)):
    client = await _get_visible_client(data.client_id, user, {"_id": 0, "id": 1, "name": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client_name = client.get("name") or "Client"
    scheduled_time = _normalize_follow_up_time(data.scheduled_time)

    follow_up_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    follow_up_doc = {
        "id": follow_up_id,
        "coach_id": user["id"],
        **data.model_dump(exclude={"scheduled_time"}),
        "scheduled_time": scheduled_time,
        "status": "scheduled",
        "created_by_name": user.get("name") or "Coach",
        "created_at": now
    }
    await db.follow_ups.insert_one(follow_up_doc)
    await _sync_client_follow_up_dates(data.client_id)
    await _write_audit_log(
        user=user,
        event_type="follow-up-created",
        entity_type="follow-up",
        entity_id=follow_up_id,
        client_id=data.client_id,
        client_name=client_name,
        summary=f"Created {data.type.replace('-', ' ')} follow-up for {client_name}",
        metadata={
            "scheduled_date": data.scheduled_date,
            "scheduled_time": scheduled_time,
            "type": data.type,
            "notes": data.notes,
            "status": "scheduled",
        },
    )
    follow_up_doc.pop("_id", None)
    return FollowUpResponse(**follow_up_doc)

@api_router.put("/follow-ups/{follow_up_id}", response_model=FollowUpResponse)
async def update_follow_up(follow_up_id: str, data: FollowUpUpdate, user: dict = Depends(get_current_user)):
    existing = await db.follow_ups.find_one({"id": follow_up_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    update_data = data.model_dump(exclude_unset=True)
    if "scheduled_time" in update_data:
        update_data["scheduled_time"] = _normalize_follow_up_time(update_data["scheduled_time"])
    result = await db.follow_ups.find_one_and_update(
        {"id": follow_up_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    await _sync_client_follow_up_dates(result["client_id"])
    client = await db.clients.find_one({"id": result["client_id"]}, {"_id": 0, "name": 1})
    await _write_audit_log(
        user=user,
        event_type="follow-up-updated",
        entity_type="follow-up",
        entity_id=follow_up_id,
        client_id=result["client_id"],
        client_name=(client or {}).get("name"),
        summary=f"Updated follow-up for {(client or {}).get('name', 'Client')}",
        metadata={
            "from": {
                "scheduled_date": existing.get("scheduled_date"),
                "scheduled_time": existing.get("scheduled_time"),
                "status": existing.get("status"),
                "notes": existing.get("notes"),
                "type": existing.get("type"),
            },
            "to": {
                "scheduled_date": result.get("scheduled_date"),
                "scheduled_time": result.get("scheduled_time"),
                "status": result.get("status"),
                "notes": result.get("notes"),
                "type": result.get("type"),
            },
        },
    )
    result.pop("_id", None)
    return FollowUpResponse(**result)

@api_router.delete("/follow-ups/{follow_up_id}")
async def delete_follow_up(follow_up_id: str, user: dict = Depends(get_current_user)):
    existing = await db.follow_ups.find_one({"id": follow_up_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    result = await db.follow_ups.delete_one({"id": follow_up_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    await _sync_client_follow_up_dates(existing["client_id"])
    client = await db.clients.find_one({"id": existing["client_id"]}, {"_id": 0, "name": 1})
    await _write_audit_log(
        user=user,
        event_type="follow-up-deleted",
        entity_type="follow-up",
        entity_id=follow_up_id,
        client_id=existing["client_id"],
        client_name=(client or {}).get("name"),
        summary=f"Deleted follow-up for {(client or {}).get('name', 'Client')}",
        metadata={
            "scheduled_date": existing.get("scheduled_date"),
            "scheduled_time": existing.get("scheduled_time"),
            "status": existing.get("status"),
            "type": existing.get("type"),
        },
    )
    return {"message": "Follow-up deleted"}

# ============ TRANSACTION ROUTES ============
TRANSACTION_MONTH_LOOKUP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

TRANSACTION_IMPORT_HEADER_ALIASES = {
    "date": ["date"],
    "client_name": ["client", "clientname", "name"],
    "amount": ["amount", "amount₹", "amountrs", "amountinr"],
    "program_duration": ["durationofprogram", "duration", "programduration"],
    "source": ["sources", "source", "leadsource"],
    "description": ["comment", "comments", "note", "notes"],
}


def _normalize_transaction_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _normalize_client_name_key(value: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _extract_tracker_year(value: str) -> Optional[int]:
    text = str(value or "")
    match = re.search(r"\b(20\d{2})\b", text)
    if match:
        return int(match.group(1))
    match = re.search(r"(?:^|[^0-9])(\d{2})(?:$|[^0-9])", text)
    if match:
        return 2000 + int(match.group(1))
    return None


def _extract_tracker_month(value: str) -> Optional[int]:
    text = str(value or "").lower()
    for token in sorted(TRANSACTION_MONTH_LOOKUP.keys(), key=len, reverse=True):
        if re.search(rf"\b{re.escape(token)}\b", text):
            return TRANSACTION_MONTH_LOOKUP[token]
    return None


def _parse_tracker_amount(value: Optional[str]) -> float:
    text = str(value or "").strip()
    if not text:
        return 0.0
    normalized = re.sub(r"[^\d.\-]", "", text)
    if not normalized:
        return 0.0
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def _parse_client_tracker_date(value: Optional[str], default_year: int, default_month: Optional[int] = None) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    match = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s*[-/ ]\s*([A-Za-z]+)", text, re.IGNORECASE)
    if match:
        day = int(match.group(1))
        month = TRANSACTION_MONTH_LOOKUP.get(match.group(2).lower())
        if month:
            return f"{default_year:04d}-{month:02d}-{day:02d}"

    match = re.search(r"(\d{1,2})", text)
    if match and default_month:
        day = int(match.group(1))
        return f"{default_year:04d}-{default_month:02d}-{day:02d}"
    return None


def _resolve_tracker_header_map(headers: List[str]) -> Dict[str, int]:
    header_map: Dict[str, int] = {}
    normalized_headers = [_normalize_transaction_header(header) for header in headers]
    for target_key, aliases in TRANSACTION_IMPORT_HEADER_ALIASES.items():
        for idx, normalized_header in enumerate(normalized_headers):
            if normalized_header in aliases:
                header_map[target_key] = idx
                break
    return header_map


def _build_transaction_dedupe_key(doc: Dict[str, Any]) -> str:
    return "|".join([
        SHARED_CLIENT_OWNER_ID,
        str(doc.get("type") or ""),
        str(doc.get("category") or ""),
        str(doc.get("transaction_date") or ""),
        _normalize_client_name_key(doc.get("client_name") or ""),
        f"{float(doc.get('amount') or 0):.2f}",
        str(doc.get("program_duration") or "").strip().lower(),
        str(doc.get("source") or "").strip().lower(),
        str(doc.get("description") or "").strip().lower(),
    ])


def _parse_transaction_import_rows(csv_text: str, filename: str, client_lookup: Dict[str, Dict[str, str]], coach_id: str) -> List[Dict[str, Any]]:
    reader = list(csv.reader(io.StringIO(csv_text)))
    if not reader:
        return []

    header_index = None
    header_map: Dict[str, int] = {}
    for idx, row in enumerate(reader[:6]):
        candidate_map = _resolve_tracker_header_map(row)
        if {"date", "client_name", "amount"}.issubset(candidate_map.keys()):
            header_index = idx
            header_map = candidate_map
            break
    if header_index is None:
        return []

    title_text = " ".join(cell.strip() for cell in (reader[0] if reader else []) if cell and cell.strip())
    filename_stem = Path(filename).stem
    resolved_year = _extract_tracker_year(filename_stem) or _extract_tracker_year(title_text) or datetime.now(timezone.utc).year
    resolved_month = _extract_tracker_month(filename_stem) or _extract_tracker_month(title_text)
    now = datetime.now(timezone.utc).isoformat()
    parsed_docs: List[Dict[str, Any]] = []

    for row in reader[header_index + 1:]:
        if not any(str(cell or "").strip() for cell in row):
            continue

        def cell_value(key: str) -> str:
            index = header_map.get(key, -1)
            if index < 0 or index >= len(row):
                return ""
            return str(row[index] or "").strip()

        client_name = cell_value("client_name")
        transaction_date = _parse_client_tracker_date(cell_value("date"), resolved_year, resolved_month)
        if not transaction_date or not client_name:
            continue

        amount = _parse_tracker_amount(cell_value("amount"))
        normalized_client_key = _normalize_client_name_key(client_name)
        matched_client = client_lookup.get(normalized_client_key)

        parsed_docs.append({
            "id": str(uuid.uuid4()),
            "coach_id": SHARED_CLIENT_OWNER_ID,
            "type": "income",
            "category": "Program Fee",
            "amount": amount,
            "description": cell_value("description") or None,
            "client_id": matched_client.get("id") if matched_client else None,
            "client_name": matched_client.get("name") if matched_client else client_name,
            "program_duration": cell_value("program_duration") or None,
            "source": cell_value("source") or None,
            "payment_method": None,
            "transaction_date": transaction_date,
            "imported_from": filename,
            "created_at": now,
        })

    return parsed_docs


def _validate_transaction_month(month: str) -> str:
    month_key = str(month or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}", month_key):
        raise HTTPException(status_code=400, detail="Month must be in YYYY-MM format")
    year, month_number = month_key.split("-")
    if int(month_number) < 1 or int(month_number) > 12:
        raise HTTPException(status_code=400, detail="Month must be in YYYY-MM format")
    return f"{year}-{month_number}"


def _csv_safe_cell(value: Any) -> Any:
    if value is None:
        return ""
    if not isinstance(value, str):
        return value
    if value[:1] in {"=", "+", "-", "@"}:
        return f"'{value}"
    return value


@api_router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    type: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    ensure_admin_user(user)
    query = _visible_shared_owner_query(user)
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if start_date or end_date:
        query["transaction_date"] = {}
        if start_date:
            query["transaction_date"]["$gte"] = start_date
        if end_date:
            query["transaction_date"]["$lte"] = end_date
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("transaction_date", -1).skip(skip).limit(limit).to_list(limit)
    return [TransactionResponse(**t) for t in transactions]


@api_router.get("/transactions/export-csv")
async def export_transactions_csv(
    month: str = Query(..., description="Month to export in YYYY-MM format"),
    user: dict = Depends(get_current_user)
):
    ensure_admin_user(user)
    month_key = _validate_transaction_month(month)
    query = _visible_shared_owner_query(user, {"transaction_date": {"$regex": f"^{month_key}"}})
    transactions = await db.transactions.find(query, {"_id": 0}).sort("transaction_date", 1).to_list(None)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Type",
        "Category",
        "Amount",
        "Client",
        "Client ID",
        "Program Duration",
        "Source",
        "Payment Method",
        "Comment",
        "Imported From",
        "Created At",
    ])
    for transaction in transactions:
        writer.writerow([
            transaction.get("transaction_date") or "",
            transaction.get("type") or "",
            _csv_safe_cell(transaction.get("category")),
            transaction.get("amount") or 0,
            _csv_safe_cell(transaction.get("client_name")),
            _csv_safe_cell(transaction.get("client_id")),
            _csv_safe_cell(transaction.get("program_duration")),
            _csv_safe_cell(transaction.get("source")),
            _csv_safe_cell(transaction.get("payment_method")),
            _csv_safe_cell(transaction.get("description")),
            _csv_safe_cell(transaction.get("imported_from")),
            transaction.get("created_at") or "",
        ])

    filename = f"transactions_{month_key}.csv"
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/transactions/summary")
async def get_transaction_summary(
    month: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    ensure_admin_user(user)
    query = _visible_shared_owner_query(user)
    if month:
        query["transaction_date"] = {"$regex": f"^{month}"}
    
    transactions = await db.transactions.find(query, {"_id": 0}).to_list(1000)
    
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expense = sum(t["amount"] for t in transactions if t["type"] == "expense")
    
    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "net": total_income - total_expense,
        "transaction_count": len(transactions)
    }

@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    ensure_admin_user(user)
    client_name = data.client_name
    if data.client_id:
        client = await _get_visible_client(data.client_id, user, {"_id": 0, "name": 1})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        client_name = client.get("name") or client_name

    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    transaction_doc = {
        "id": transaction_id,
        "coach_id": SHARED_CLIENT_OWNER_ID,
        **data.model_dump(),
        "client_name": client_name,
        "transaction_date": data.transaction_date or now[:10],
        "created_at": now
    }
    await db.transactions.insert_one(transaction_doc)
    await _write_audit_log(
        user=user,
        event_type="transaction-created",
        entity_type="transaction",
        entity_id=transaction_id,
        client_id=data.client_id,
        client_name=client_name,
        summary=f"Added {transaction_doc['type']} transaction for {client_name or 'unlinked client'}",
        metadata={
            "amount": transaction_doc["amount"],
            "category": transaction_doc["category"],
            "transaction_date": transaction_doc["transaction_date"],
            "payment_method": transaction_doc.get("payment_method"),
            "program_duration": transaction_doc.get("program_duration"),
        },
    )
    transaction_doc.pop("_id", None)
    return TransactionResponse(**transaction_doc)

@api_router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(transaction_id: str, data: TransactionUpdate, user: dict = Depends(get_current_user)):
    ensure_admin_user(user)
    existing = await db.transactions.find_one(_visible_shared_owner_query(user, {"id": transaction_id}), {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "client_id" in update_data and update_data["client_id"]:
        client = await _get_visible_client(update_data["client_id"], user, {"_id": 0, "name": 1})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        update_data["client_name"] = client.get("name") or update_data.get("client_name")
    result = await db.transactions.find_one_and_update(
        _visible_shared_owner_query(user, {"id": transaction_id}),
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await _write_audit_log(
        user=user,
        event_type="transaction-updated",
        entity_type="transaction",
        entity_id=transaction_id,
        client_id=result.get("client_id"),
        client_name=result.get("client_name"),
        summary=f"Updated transaction for {result.get('client_name') or 'unlinked client'}",
        metadata={
            "from": {
                "amount": existing.get("amount"),
                "category": existing.get("category"),
                "transaction_date": existing.get("transaction_date"),
                "payment_method": existing.get("payment_method"),
            },
            "to": {
                "amount": result.get("amount"),
                "category": result.get("category"),
                "transaction_date": result.get("transaction_date"),
                "payment_method": result.get("payment_method"),
            },
        },
    )
    result.pop("_id", None)
    return TransactionResponse(**result)

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    ensure_admin_user(user)
    existing = await db.transactions.find_one(_visible_shared_owner_query(user, {"id": transaction_id}), {"_id": 0})
    result = await db.transactions.delete_one(_visible_shared_owner_query(user, {"id": transaction_id}))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if existing:
        await _write_audit_log(
            user=user,
            event_type="transaction-deleted",
            entity_type="transaction",
            entity_id=transaction_id,
            client_id=existing.get("client_id"),
            client_name=existing.get("client_name"),
            summary=f"Deleted transaction for {existing.get('client_name') or 'unlinked client'}",
            metadata={
                "amount": existing.get("amount"),
                "category": existing.get("category"),
                "transaction_date": existing.get("transaction_date"),
            },
        )
    return {"message": "Transaction deleted"}


@api_router.post("/transactions/import-csv", response_model=TransactionImportResponse)
async def import_transactions_csv(
    files: List[UploadFile] = File(...),
    user: dict = Depends(get_current_user)
):
    ensure_admin_user(user)
    if not files:
        raise HTTPException(status_code=400, detail="At least one CSV file is required")

    clients = await db.clients.find(_visible_clients_query(user), {"_id": 0, "id": 1, "name": 1}).to_list(2000)
    client_lookup = {}
    for client in clients:
        normalized_name = _normalize_client_name_key(client.get("name"))
        if normalized_name and normalized_name not in client_lookup:
            client_lookup[normalized_name] = {"id": client.get("id"), "name": client.get("name")}

    existing_transactions = await db.transactions.find(_visible_shared_owner_query(user), {"_id": 0}).to_list(5000)
    existing_keys = {_build_transaction_dedupe_key(transaction) for transaction in existing_transactions}

    docs_to_insert: List[Dict[str, Any]] = []
    file_results: List[TransactionImportFileResult] = []
    imported_count = 0
    skipped_count = 0

    for file in files:
        filename = file.filename or "transactions.csv"
        if not filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail=f"Only CSV files are supported. Invalid file: {filename}")

        raw_bytes = await file.read()
        if not raw_bytes:
            file_results.append(TransactionImportFileResult(filename=filename, imported_count=0, skipped_count=0))
            continue

        try:
            csv_text = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            csv_text = raw_bytes.decode("latin-1")

        parsed_docs = _parse_transaction_import_rows(csv_text, filename, client_lookup, SHARED_CLIENT_OWNER_ID)
        file_imported = 0
        file_skipped = 0
        for doc in parsed_docs:
            dedupe_key = _build_transaction_dedupe_key(doc)
            if dedupe_key in existing_keys:
                skipped_count += 1
                file_skipped += 1
                continue
            existing_keys.add(dedupe_key)
            docs_to_insert.append(doc)
            imported_count += 1
            file_imported += 1

        file_results.append(
            TransactionImportFileResult(
                filename=filename,
                imported_count=file_imported,
                skipped_count=file_skipped,
            )
        )

    if docs_to_insert:
        await db.transactions.insert_many(docs_to_insert)
        await _write_audit_log(
            user=user,
            event_type="transaction-imported",
            entity_type="transaction",
            entity_id=None,
            summary=f"Imported {imported_count} transactions",
            metadata={
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "files": [result.model_dump() if hasattr(result, "model_dump") else result for result in file_results],
            },
        )

    return TransactionImportResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        file_results=file_results,
    )

@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    client_id: Optional[str] = None,
    category: str = "general",
    user: dict = Depends(get_current_user)
):
    return await upload_file_handler(
        db=db,
        file=file,
        client_id=client_id,
        category=category,
        user=user,
        get_visible_client=_get_visible_client,
    )


@api_router.get("/files", response_model=List[FileRecordResponse])
async def list_files(
    client_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user),
):
    records = await list_files_handler(
        db=db,
        client_id=client_id,
        category=category,
        limit=limit,
        user=user,
        get_visible_client=_get_visible_client,
        visible_client_owner_ids=_visible_client_owner_ids,
    )
    return [FileRecordResponse(**record) for record in records]

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, user: dict = Depends(get_current_user)):
    return await get_file_handler(
        db=db,
        file_id=file_id,
        user=user,
        visible_client_owner_ids=_visible_client_owner_ids,
    )


@api_router.get("/clients/{client_id}/ai/health-analysis", response_model=ClientAIHealthAnalysisResponse)
async def get_client_ai_health_analysis(client_id: str, user: dict = Depends(get_current_user)):
    analysis_doc = await get_health_analysis_handler(
        db=db,
        client_id=client_id,
        user=user,
        get_visible_client=_get_visible_client,
    )
    return ClientAIHealthAnalysisResponse(**analysis_doc)


@api_router.post("/clients/{client_id}/ai/health-analysis/generate", response_model=ClientAIHealthAnalysisResponse)
async def generate_client_ai_health_analysis(client_id: str, user: dict = Depends(get_current_user)):
    analysis_doc = await generate_health_analysis_handler(
        db=db,
        client_id=client_id,
        user=user,
        get_visible_client=_get_visible_client,
        visible_client_owner_ids=_visible_client_owner_ids,
        extract_text_from_stored_file_record=_extract_text_from_stored_file_record,
        serialize_file_record=_serialize_file_record,
        write_audit_log=_write_audit_log,
    )
    return ClientAIHealthAnalysisResponse(**analysis_doc)

# ============ DASHBOARD STATS ============
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    # Client stats
    total_clients = await db.clients.count_documents(_visible_clients_query(user))
    active_clients = await db.clients.count_documents(_visible_clients_query(user, {"status": "active"}))
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    current_month_label = now.strftime("%B %Y")
    new_clients_this_month = await db.clients.count_documents(_visible_clients_query(user, {"created_at": {"$regex": f"^{current_month}"}}))
    
    # Follow-up stats
    today = now.strftime("%Y-%m-%d")
    pending_follow_ups = await db.follow_ups.count_documents({"status": "scheduled", "scheduled_date": {"$lte": today}})
    
    # Revenue stats (current month)
    month_transactions = await db.transactions.find(
        _visible_shared_owner_query(user, {"transaction_date": {"$regex": f"^{current_month}"}}),
        {"_id": 0},
    ).to_list(1000)
    monthly_income = sum(t["amount"] for t in month_transactions if t["type"] == "income")
    monthly_expense = sum(t["amount"] for t in month_transactions if t["type"] == "expense")
    
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "new_clients_this_month": new_clients_this_month,
        "current_month_label": current_month_label,
        "pending_follow_ups": pending_follow_ups,
        "monthly_revenue": monthly_income - monthly_expense,
        "monthly_income": monthly_income,
        "monthly_expense": monthly_expense
    }

@api_router.get("/dashboard/recent-activity")
async def get_recent_activity(limit: int = 10, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    current_month = now.strftime("%Y-%m")
    current_month_label = now.strftime("%B")
    expiry_cutoff = (now + timedelta(days=5)).strftime("%Y-%m-%d")

    # Get new clients for the current month
    new_clients = await db.clients.find(
        _visible_clients_query(user, {"created_at": {"$regex": f"^{current_month}"}}),
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    # Build current month overview
    month_client_rows = await db.clients.find(
        _visible_clients_query(user, {"created_at": {"$regex": f"^{current_month}"}}),
        {"_id": 0, "created_at": 1}
    ).to_list(1000)
    month_transaction_rows = await db.transactions.find(
        _visible_shared_owner_query(user, {"transaction_date": {"$regex": f"^{current_month}"}}),
        {"_id": 0, "transaction_date": 1, "amount": 1, "type": 1}
    ).to_list(1000)

    if now.month == 12:
        next_month = now.replace(year=now.year + 1, month=1, day=1)
    else:
        next_month = now.replace(month=now.month + 1, day=1)
    days_in_month = (next_month - timedelta(days=1)).day

    daily_new_clients = {day: 0 for day in range(1, days_in_month + 1)}
    daily_revenue = {day: 0 for day in range(1, days_in_month + 1)}

    for row in month_client_rows:
        created_at = _parse_datetime_or_date(row.get("created_at"))
        if created_at and created_at.month == now.month and created_at.year == now.year:
            daily_new_clients[created_at.day] += 1

    for row in month_transaction_rows:
        transaction_date = _parse_datetime_or_date(row.get("transaction_date"))
        if not transaction_date or transaction_date.month != now.month or transaction_date.year != now.year:
            continue
        amount = row.get("amount", 0)
        daily_revenue[transaction_date.day] += amount if row.get("type") == "income" else -amount

    monthly_overview = [
        {
            "day": day,
            "label": f"{day:02d}",
            "new_clients": daily_new_clients[day],
            "revenue": daily_revenue[day],
        }
        for day in range(1, days_in_month + 1)
    ]

    # Get upcoming follow-ups
    upcoming_follow_ups = await db.follow_ups.find(
        {"status": "scheduled", "scheduled_date": {"$gte": today}},
        {"_id": 0}
    ).sort("scheduled_date", 1).limit(limit).to_list(limit)

    # Get diet plans expiring soon from client diet_end_date
    expiring_diet_plans = await db.clients.find(
        _visible_clients_query(user, {"status": "active", "diet_end_date": {"$gte": today, "$lte": expiry_cutoff}}),
        {"_id": 0}
    ).sort("diet_end_date", 1).limit(limit).to_list(limit)

    client_ids = {item.get("client_id") for item in upcoming_follow_ups if item.get("client_id")}
    client_ids.update(client.get("id") for client in expiring_diet_plans if client.get("id"))
    client_map = {}
    if client_ids:
        client_rows = await db.clients.find({"id": {"$in": list(client_ids)}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(client_ids))
        client_map = {row["id"]: row.get("name", "Client") for row in client_rows}

    follow_up_items = []
    for item in upcoming_follow_ups:
        follow_up_items.append({
            **item,
            "client_name": client_map.get(item.get("client_id"), "Client"),
        })

    expiring_plan_items = []
    for client in expiring_diet_plans:
        diet_end = _parse_datetime_or_date(client.get("diet_end_date"))
        days_until_expiry = (diet_end.date() - now.date()).days if diet_end else None
        expiring_plan_items.append({
            "id": client["id"],
            "client_id": client["id"],
            "client_name": client.get("name", "Client"),
            "diet_end_date": client.get("diet_end_date"),
            "days_until_expiry": days_until_expiry,
            "status": client.get("status", "active"),
        })
    
    return {
        "current_month_label": current_month_label,
        "monthly_overview": monthly_overview,
        "recent_clients": new_clients,
        "upcoming_follow_ups": follow_up_items,
        "expiring_diet_plans": expiring_plan_items,
    }


@api_router.get("/tasks/pending", response_model=PendingTasksFeedResponse)
async def get_pending_tasks(window_days: int = 3, user: dict = Depends(get_current_user)):
    window_days = max(1, min(window_days, 14))
    payload = await _build_pending_tasks_feed(user, window_days=window_days)
    return PendingTasksFeedResponse(**payload)


@api_router.post("/tasks", response_model=ManualTaskResponse)
async def create_manual_task(data: ManualTaskCreate, user: dict = Depends(get_current_user)):
    client_row = await _get_visible_client(data.client_id, user, {"_id": 0, "id": 1, "name": 1})
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")

    parsed_due_date = _parse_datetime_or_date(data.due_date)
    if not parsed_due_date:
        raise HTTPException(status_code=400, detail="Valid task date is required")
    due_date = parsed_due_date.date().isoformat()

    comment = (data.comment or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Task comment is required")

    now = datetime.now(timezone.utc).isoformat()
    task_doc = {
        "id": str(uuid.uuid4()),
        "coach_id": SHARED_CLIENT_OWNER_ID,
        "client_id": client_row["id"],
        "client_name": client_row.get("name") or "Client",
        "comment": comment,
        "due_date": due_date,
        "status": "open",
        "created_by_id": user.get("id"),
        "created_by_name": user.get("name") or "Coach",
        "created_at": now,
    }
    await db.manual_tasks.insert_one(task_doc)
    task_doc.pop("_id", None)
    return ManualTaskResponse(**task_doc)


@api_router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    event_type: Optional[str] = None,
    client_id: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user),
):
    limit = max(1, min(limit, 500))
    query = _visible_shared_owner_query(user)
    if event_type:
        query["event_type"] = event_type
    if client_id:
        query["client_id"] = client_id
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    normalized_logs = []
    for log in logs:
        if not log.get("event_label"):
            log["event_label"] = _derive_audit_event_label(
                log.get("event_type", ""),
                log.get("entity_type", ""),
                log.get("metadata"),
            )
        if "old_value" not in log or "new_value" not in log:
            derived_old_value, derived_new_value = _derive_audit_value_columns(
                event_type=log.get("event_type", ""),
                entity_type=log.get("entity_type", ""),
                metadata=log.get("metadata"),
            )
            log.setdefault("old_value", derived_old_value)
            log.setdefault("new_value", derived_new_value)
        normalized_logs.append(AuditLogResponse(**log))
    return normalized_logs

# ============ CLIENT MOBILE APP MODELS ============

# Client Registration (for mobile app)
class ClientRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    invite_code: str  # Dietitian invite code required for mobile registration

class ClientLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    client: dict

# Daily Check-in Models
class MealCheckIn(BaseModel):
    meal_name: str  # breakfast, lunch, dinner, snack
    completed: bool
    photo_id: Optional[str] = None
    notes: Optional[str] = None

class DailyCheckInCreate(BaseModel):
    date: Optional[str] = None
    meals: List[MealCheckIn] = []
    water_glasses: int = 0
    mood: Optional[str] = None  # great, good, okay, bad
    notes: Optional[str] = None

class DailyCheckInResponse(BaseModel):
    id: str
    client_id: str
    date: str
    meals: List[dict] = []
    water_glasses: int
    mood: Optional[str] = None
    notes: Optional[str] = None
    adherence_score: float
    created_at: str
    updated_at: str

# Meal Upload Models
class MealUploadResponse(BaseModel):
    id: str
    client_id: str
    meal_type: str
    photo_path: str
    caption: Optional[str] = None
    uploaded_at: str
    coach_feedback: Optional[str] = None

# Chat Models
class ChatMessageCreate(BaseModel):
    content: str
    message_type: str = "text"  # text, image

class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_type: str  # coach, client
    content: str
    message_type: str
    read: bool
    created_at: str

# ============ CLIENT MOBILE AUTH ============

@api_router.post("/client/auth/register")
async def client_register(data: ClientRegister):
    """Register a new client for the mobile app"""
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    invite_code = data.invite_code.strip().upper()
    if not invite_code:
        raise HTTPException(status_code=400, detail="Dietitian invite code is required")

    coach = await db.users.find_one({"invite_code": invite_code, "role": {"$in": list(STAFF_ROLES)}}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=400, detail="Invalid dietitian invite code")
    coach_id = coach["id"]
    
    # Create user account with client role
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "role": "client",
        "coach_id": coach_id,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    # If coach exists, create client record
    if coach_id:
        client_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "coach_id": coach_id,
            "name": data.name,
            "email": data.email,
            "phone": data.phone,
            "status": "active",
            "adherence_rate": 0.0,
            "created_at": now,
            "updated_at": now
        }
        await db.clients.insert_one(client_doc)
    
    token = create_token(user_id, data.email, "client")
    return {
        "access_token": token,
        "token_type": "bearer",
        "client": {
            "id": user_id,
            "email": data.email,
            "name": data.name,
            "role": "client",
            "coach_id": coach_id
        }
    }

@api_router.post("/client/auth/login")
async def client_login(data: UserLogin):
    """Login for mobile client app"""
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get client record if exists
    client_record = await db.clients.find_one({"email": data.email}, {"_id": 0})
    
    token = create_token(user["id"], user["email"], user.get("role", "client"))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "client"),
            "coach_id": user.get("coach_id")
        },
        "client_profile": client_record
    }

@api_router.get("/client/me")
async def get_client_profile(user: dict = Depends(get_current_user)):
    """Get current client's profile and linked client record"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    coach_info = None
    if user.get("coach_id"):
        coach = await db.users.find_one({"id": user["coach_id"]}, {"_id": 0, "password": 0})
        if coach:
            coach_info = {"id": coach["id"], "name": coach["name"], "email": coach["email"]}
    
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role"),
            "phone": user.get("phone")
        },
        "client_profile": client_record,
        "coach": coach_info
    }

# ============ CLIENT MOBILE - DIET PLAN ============

@api_router.get("/client/diet-plan")
async def get_client_diet_plan(user: dict = Depends(get_current_user)):
    """Get the active diet plan assigned to this client"""
    # Find client record
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    # Get active diet plan
    diet_plan = await db.diet_plans.find_one(
        {"client_id": client_record["id"], "is_active": True},
        {"_id": 0}
    )
    
    return {
        "diet_plan": diet_plan,
        "client": {
            "name": client_record.get("name"),
            "goal_weight_kg": client_record.get("goal_weight_kg"),
            "current_weight_kg": client_record.get("current_weight_kg")
        }
    }

# ============ CLIENT MOBILE - DAILY CHECK-IN ============

@api_router.post("/client/checkin")
async def create_daily_checkin(data: DailyCheckInCreate, user: dict = Depends(get_current_user)):
    """Create or update daily check-in"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    checkin_date = data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc).isoformat()
    
    # Calculate adherence score
    completed_meals = sum(1 for m in data.meals if m.completed)
    total_meals = len(data.meals) if data.meals else 1
    adherence_score = (completed_meals / total_meals) * 100
    
    # Check if checkin already exists for today
    existing = await db.daily_checkins.find_one(
        {"client_id": client_record["id"], "date": checkin_date}
    )
    
    checkin_doc = {
        "client_id": client_record["id"],
        "coach_id": client_record.get("coach_id"),
        "date": checkin_date,
        "meals": [m.model_dump() for m in data.meals],
        "water_glasses": data.water_glasses,
        "mood": data.mood,
        "notes": data.notes,
        "adherence_score": adherence_score,
        "updated_at": now
    }
    
    if existing:
        await db.daily_checkins.update_one(
            {"_id": existing["_id"]},
            {"$set": checkin_doc}
        )
        checkin_doc["id"] = existing.get("id", str(existing["_id"]))
        checkin_doc["created_at"] = existing.get("created_at", now)
    else:
        checkin_doc["id"] = str(uuid.uuid4())
        checkin_doc["created_at"] = now
        await db.daily_checkins.insert_one(checkin_doc)
    
    # Update client adherence rate
    all_checkins = await db.daily_checkins.find({"client_id": client_record["id"]}, {"_id": 0}).to_list(100)
    if all_checkins:
        avg_adherence = sum(c.get("adherence_score", 0) for c in all_checkins) / len(all_checkins)
        await db.clients.update_one(
            {"id": client_record["id"]},
            {"$set": {"adherence_rate": avg_adherence, "updated_at": now}}
        )
    
    checkin_doc.pop("_id", None)
    return DailyCheckInResponse(**checkin_doc)

@api_router.get("/client/checkins")
async def get_client_checkins(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 30,
    user: dict = Depends(get_current_user)
):
    """Get client's check-in history"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    query = {"client_id": client_record["id"]}
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = start_date
        if end_date:
            query["date"]["$lte"] = end_date
    
    checkins = await db.daily_checkins.find(query, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return {"checkins": checkins, "count": len(checkins)}

@api_router.get("/client/checkin/today")
async def get_today_checkin(user: dict = Depends(get_current_user)):
    """Get today's check-in status"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    checkin = await db.daily_checkins.find_one(
        {"client_id": client_record["id"], "date": today},
        {"_id": 0}
    )
    
    return {"date": today, "checkin": checkin, "completed": checkin is not None}

# ============ CLIENT MOBILE - WEIGHT TRACKING ============

@api_router.post("/client/weight")
async def log_client_weight(data: WeightEntryCreate, user: dict = Depends(get_current_user)):
    """Log weight from mobile app"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    entry_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    entry_doc = {
        "id": entry_id,
        "client_id": client_record["id"],
        "weight_kg": data.weight_kg,
        "recorded_date": data.recorded_date or now[:10],
        "notes": data.notes,
        "created_at": now
    }
    await db.weight_entries.insert_one(entry_doc)
    
    # Update client's current weight
    await db.clients.update_one(
        {"id": client_record["id"]},
        {"$set": {"current_weight_kg": data.weight_kg, "updated_at": now}}
    )
    
    entry_doc.pop("_id", None)
    return WeightEntryResponse(**entry_doc)

@api_router.get("/client/weights")
async def get_client_weights(limit: int = 30, user: dict = Depends(get_current_user)):
    """Get client's weight history"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    weights = await db.weight_entries.find(
        {"client_id": client_record["id"]},
        {"_id": 0}
    ).sort("recorded_date", -1).limit(limit).to_list(limit)
    
    return {
        "weights": weights,
        "current_weight": client_record.get("current_weight_kg"),
        "initial_weight": client_record.get("initial_weight_kg"),
        "goal_weight": client_record.get("goal_weight_kg")
    }

# ============ CLIENT MOBILE - MEAL PHOTO UPLOAD ============

@api_router.post("/client/meal-upload")
async def upload_meal_photo(
    file: UploadFile = File(...),
    meal_type: str = Query(..., description="breakfast, lunch, dinner, snack"),
    caption: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Upload meal photo for tracking"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(status_code=400, detail="Only image files allowed")
    
    path = f"{APP_NAME}/meals/{client_record['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    content_type = file.content_type or f"image/{ext}"
    
    result = put_object(path, data, content_type)
    
    upload_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    upload_doc = {
        "id": upload_id,
        "client_id": client_record["id"],
        "coach_id": client_record.get("coach_id"),
        "meal_type": meal_type,
        "photo_path": result["path"],
        "original_filename": file.filename,
        "caption": caption,
        "uploaded_at": now,
        "date": now[:10],
        "coach_feedback": None,
        "reviewed": False
    }
    await db.meal_uploads.insert_one(upload_doc)
    
    return MealUploadResponse(**upload_doc)

@api_router.get("/client/meal-uploads")
async def get_client_meal_uploads(
    date: Optional[str] = None,
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """Get client's meal photo uploads"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    query = {"client_id": client_record["id"]}
    if date:
        query["date"] = date
    
    uploads = await db.meal_uploads.find(query, {"_id": 0}).sort("uploaded_at", -1).limit(limit).to_list(limit)
    return {"uploads": uploads, "count": len(uploads)}

# ============ CLIENT MOBILE - CHAT ============

@api_router.get("/client/chat/messages")
async def get_chat_messages(
    limit: int = 50,
    before_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get chat messages between client and coach"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    # Find or create conversation
    conversation = await db.chat_conversations.find_one(
        {"client_id": client_record["id"]},
        {"_id": 0}
    )
    
    if not conversation:
        conv_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conversation = {
            "id": conv_id,
            "client_id": client_record["id"],
            "coach_id": client_record.get("coach_id"),
            "created_at": now,
            "last_message_at": now
        }
        await db.chat_conversations.insert_one(conversation)
    
    query = {"conversation_id": conversation["id"]}
    messages = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.chat_messages.update_many(
        {"conversation_id": conversation["id"], "sender_id": {"$ne": user["id"]}, "read": False},
        {"$set": {"read": True}}
    )
    
    return {
        "conversation_id": conversation["id"],
        "messages": list(reversed(messages)),
        "coach_id": client_record.get("coach_id")
    }

@api_router.post("/client/chat/send")
async def send_chat_message(data: ChatMessageCreate, user: dict = Depends(get_current_user)):
    """Send a message to coach"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    # Get or create conversation
    conversation = await db.chat_conversations.find_one(
        {"client_id": client_record["id"]},
        {"_id": 0}
    )
    
    if not conversation:
        conv_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conversation = {
            "id": conv_id,
            "client_id": client_record["id"],
            "coach_id": client_record.get("coach_id"),
            "created_at": now,
            "last_message_at": now
        }
        await db.chat_conversations.insert_one(conversation)
    
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "id": msg_id,
        "conversation_id": conversation["id"],
        "sender_id": user["id"],
        "sender_type": "client",
        "content": data.content,
        "message_type": data.message_type,
        "read": False,
        "created_at": now
    }
    await db.chat_messages.insert_one(message_doc)
    
    # Update conversation
    await db.chat_conversations.update_one(
        {"id": conversation["id"]},
        {"$set": {"last_message_at": now}}
    )
    
    message_doc.pop("_id", None)
    return ChatMessageResponse(**message_doc)

# ============ CLIENT MOBILE - FOLLOW-UPS ============

@api_router.get("/client/follow-ups")
async def get_client_follow_ups(user: dict = Depends(get_current_user)):
    """Get upcoming follow-ups for client"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        raise HTTPException(status_code=404, detail="Client profile not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    follow_ups = await db.follow_ups.find(
        {"client_id": client_record["id"], "scheduled_date": {"$gte": today}},
        {"_id": 0}
    ).sort("scheduled_date", 1).to_list(20)
    
    return {"follow_ups": follow_ups}

# ============ CLIENT MOBILE - DASHBOARD ============

@api_router.get("/client/dashboard")
async def get_client_dashboard(user: dict = Depends(get_current_user)):
    """Get client dashboard data for mobile app"""
    client_record = await db.clients.find_one(
        {"$or": [{"user_id": user["id"]}, {"email": user["email"]}]},
        {"_id": 0}
    )
    
    if not client_record:
        return {
            "has_profile": False,
            "message": "No client profile linked. Please ask your coach to add you."
        }
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's check-in
    today_checkin = await db.daily_checkins.find_one(
        {"client_id": client_record["id"], "date": today},
        {"_id": 0}
    )
    
    # Get active diet plan
    diet_plan = await db.diet_plans.find_one(
        {"client_id": client_record["id"], "is_active": True},
        {"_id": 0}
    )
    
    # Get recent weight entries
    recent_weights = await db.weight_entries.find(
        {"client_id": client_record["id"]},
        {"_id": 0}
    ).sort("recorded_date", -1).limit(7).to_list(7)
    
    # Get upcoming follow-ups
    upcoming_follow_ups = await db.follow_ups.find(
        {"client_id": client_record["id"], "status": "scheduled", "scheduled_date": {"$gte": today}},
        {"_id": 0}
    ).sort("scheduled_date", 1).limit(3).to_list(3)
    
    # Get unread messages count
    conversation = await db.chat_conversations.find_one({"client_id": client_record["id"]})
    unread_count = 0
    if conversation:
        unread_count = await db.chat_messages.count_documents(
            {"conversation_id": conversation["id"], "sender_type": "coach", "read": False}
        )
    
    # Calculate streak
    checkins = await db.daily_checkins.find(
        {"client_id": client_record["id"]},
        {"_id": 0}
    ).sort("date", -1).limit(30).to_list(30)
    
    streak = 0
    for i, checkin in enumerate(checkins):
        if checkin.get("adherence_score", 0) >= 50:
            streak += 1
        else:
            break
    
    return {
        "has_profile": True,
        "client": {
            "name": client_record.get("name"),
            "current_weight": client_record.get("current_weight_kg"),
            "goal_weight": client_record.get("goal_weight_kg"),
            "initial_weight": client_record.get("initial_weight_kg"),
            "adherence_rate": client_record.get("adherence_rate", 0)
        },
        "today": {
            "date": today,
            "checkin_completed": today_checkin is not None,
            "adherence_score": today_checkin.get("adherence_score") if today_checkin else 0
        },
        "diet_plan": {
            "name": diet_plan.get("name") if diet_plan else None,
            "daily_calories": diet_plan.get("daily_calories") if diet_plan else None,
            "meals_count": len(diet_plan.get("meals", [])) if diet_plan else 0
        } if diet_plan else None,
        "progress": {
            "recent_weights": recent_weights,
            "streak_days": streak,
            "weight_change": (
                client_record.get("initial_weight_kg", 0) - client_record.get("current_weight_kg", 0)
            ) if client_record.get("initial_weight_kg") and client_record.get("current_weight_kg") else 0
        },
        "upcoming_follow_ups": upcoming_follow_ups,
        "unread_messages": unread_count
    }

# ============ COACH - CHAT ROUTES ============

@api_router.get("/coach/chats")
async def get_coach_conversations(user: dict = Depends(get_current_user)):
    """Get all chat conversations for coach"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    conversations = await db.chat_conversations.find(
        {"coach_id": user["id"]},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)
    
    # Enrich with client info and last message
    enriched = []
    for conv in conversations:
        client = await db.clients.find_one({"id": conv["client_id"]}, {"_id": 0})
        last_message = await db.chat_messages.find_one(
            {"conversation_id": conv["id"]},
            {"_id": 0}
        )
        unread = await db.chat_messages.count_documents(
            {"conversation_id": conv["id"], "sender_type": "client", "read": False}
        )
        enriched.append({
            **conv,
            "client_name": client.get("name") if client else "Unknown",
            "last_message": last_message,
            "unread_count": unread
        })
    
    return {"conversations": enriched}

@api_router.get("/coach/chat/{client_id}/messages")
async def get_coach_chat_messages(client_id: str, limit: int = 50, user: dict = Depends(get_current_user)):
    """Get chat messages for a specific client"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    conversation = await db.chat_conversations.find_one(
        {"client_id": client_id, "coach_id": user["id"]},
        {"_id": 0}
    )
    
    if not conversation:
        return {"messages": [], "conversation_id": None}
    
    messages = await db.chat_messages.find(
        {"conversation_id": conversation["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark as read
    await db.chat_messages.update_many(
        {"conversation_id": conversation["id"], "sender_type": "client", "read": False},
        {"$set": {"read": True}}
    )
    
    return {"messages": list(reversed(messages)), "conversation_id": conversation["id"]}

@api_router.post("/coach/chat/{client_id}/send")
async def coach_send_message(client_id: str, data: ChatMessageCreate, user: dict = Depends(get_current_user)):
    """Coach sends message to client"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    # Get or create conversation
    conversation = await db.chat_conversations.find_one(
        {"client_id": client_id, "coach_id": user["id"]},
        {"_id": 0}
    )
    
    if not conversation:
        conv_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conversation = {
            "id": conv_id,
            "client_id": client_id,
            "coach_id": user["id"],
            "created_at": now,
            "last_message_at": now
        }
        await db.chat_conversations.insert_one(conversation)
    
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    message_doc = {
        "id": msg_id,
        "conversation_id": conversation["id"],
        "sender_id": user["id"],
        "sender_type": "coach",
        "content": data.content,
        "message_type": data.message_type,
        "read": False,
        "created_at": now
    }
    await db.chat_messages.insert_one(message_doc)
    
    await db.chat_conversations.update_one(
        {"id": conversation["id"]},
        {"$set": {"last_message_at": now}}
    )
    
    message_doc.pop("_id", None)
    return ChatMessageResponse(**message_doc)

# ============ COACH - MEAL UPLOADS REVIEW ============

@api_router.get("/coach/meal-uploads")
async def get_meal_uploads_for_review(
    client_id: Optional[str] = None,
    reviewed: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Get meal uploads for coach to review"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    query = {"coach_id": user["id"]}
    if client_id:
        query["client_id"] = client_id
    if reviewed is not None:
        query["reviewed"] = reviewed
    
    uploads = await db.meal_uploads.find(query, {"_id": 0}).sort("uploaded_at", -1).limit(50).to_list(50)
    
    # Enrich with client names
    for upload in uploads:
        client = await db.clients.find_one({"id": upload["client_id"]}, {"_id": 0})
        upload["client_name"] = client.get("name") if client else "Unknown"
    
    return {"uploads": uploads}

@api_router.put("/coach/meal-uploads/{upload_id}/feedback")
async def add_meal_feedback(upload_id: str, feedback: str = Query(...), user: dict = Depends(get_current_user)):
    """Add feedback to a meal upload"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    result = await db.meal_uploads.update_one(
        {"id": upload_id, "coach_id": user["id"]},
        {"$set": {"coach_feedback": feedback, "reviewed": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return {"message": "Feedback added"}

# ============ COACH - INVITE CODE ============

@api_router.post("/coach/generate-invite")
async def generate_invite_code(user: dict = Depends(get_current_user)):
    """Generate an invite code for clients to register"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    invite_code = str(uuid.uuid4())[:8].upper()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"invite_code": invite_code}}
    )
    
    return {"invite_code": invite_code}

@api_router.get("/coach/invite-code")
async def get_invite_code(user: dict = Depends(get_current_user)):
    """Get coach's current invite code"""
    if not is_staff_user(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    coach = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"invite_code": coach.get("invite_code")}

# ============ ROOT ============
@api_router.get("/")
async def root():
    return {"message": "DietTracker Pro API", "version": "1.0.0", "mobile_api": "enabled"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

async def _wait_for_mongo(max_attempts: int = 5, base_delay_seconds: float = 2.0):
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            await db.command("ping")
            logger.info("MongoDB connection check passed")
            return
        except Exception as e:
            last_error = e
            logger.warning(f"MongoDB connection attempt {attempt}/{max_attempts} failed: {e}")
            err_text = str(e)
            if "TLSV1_ALERT_INTERNAL_ERROR" in err_text or "tlsv1 alert internal error" in err_text:
                logger.error(
                    "MongoDB TLS handshake failed. This is often caused by a stale Atlas SRV hostname in MONGO_URL. "
                    "Re-copy the latest Python connection string from Atlas > Database > Connect > Drivers, "
                    "and verify Atlas Network Access includes your current public IP."
                )
            if attempt < max_attempts:
                await asyncio.sleep(base_delay_seconds * attempt)
    raise last_error

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")

    # Atlas can occasionally fail TLS/server selection briefly.
    # Retry before failing the entire API startup.
    await _wait_for_mongo()

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("invite_code", sparse=True)
    await db.staff_members.create_index("email", unique=True)
    await db.staff_members.create_index("user_id", sparse=True)
    await db.staff_members.create_index([("status", 1), ("role", 1)])
    await db.clients.create_index([("coach_id", 1), ("status", 1)])
    await db.clients.create_index("email", sparse=True)
    await db.clients.create_index("user_id", sparse=True)
    await db.leads.create_index([("coach_id", 1), ("status", 1), ("updated_at", -1)])
    await db.leads.create_index([("coach_id", 1), ("next_follow_up_date", 1)])
    await db.leads.create_index([("coach_id", 1), ("created_at", -1)])
    await db.client_comments.create_index([("client_id", 1), ("created_at", -1)])
    await db.client_comments.create_index([("coach_id", 1), ("created_at", -1)])
    await db.weight_entries.create_index([("client_id", 1), ("recorded_date", -1)])
    await db.diet_plans.create_index([("coach_id", 1), ("client_id", 1)])
    await db.diet_plans.create_index([("coach_id", 1), ("plan_type", 1), ("created_at", -1)])
    await db.follow_ups.create_index([("coach_id", 1), ("scheduled_date", 1)])
    await db.follow_ups.create_index([("client_id", 1), ("scheduled_date", 1)])
    await db.transactions.create_index([("coach_id", 1), ("transaction_date", -1)])
    await db.manual_tasks.create_index([("coach_id", 1), ("due_date", 1)])
    await db.manual_tasks.create_index([("client_id", 1), ("due_date", 1)])
    await db.audit_logs.create_index([("coach_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("entity_type", 1), ("created_at", -1)])
    await db.client_ai_analyses.create_index([("client_id", 1), ("analysis_type", 1)], unique=True)
    await db.client_ai_business_analyses.create_index([("coach_id", 1), ("created_at", -1)])
    await db.client_ai_queries.create_index([("coach_id", 1), ("created_at", -1)])
    await db.diet_ai_artifacts.create_index([("coach_id", 1), ("client_id", 1), ("plan_fingerprint", 1)], unique=True)
    await db.diet_ai_artifacts.create_index([("client_id", 1), ("updated_at", -1)])
    await db.diet_ai_conflict_checks.create_index([("coach_id", 1), ("client_id", 1), ("created_at", -1)])
    # Mobile app indexes
    await db.daily_checkins.create_index([("client_id", 1), ("date", -1)])
    await db.meal_uploads.create_index([("client_id", 1), ("uploaded_at", -1)])
    await db.meal_uploads.create_index([("coach_id", 1), ("reviewed", 1)])
    await db.chat_conversations.create_index("client_id")
    await db.chat_conversations.create_index("coach_id")
    await db.chat_messages.create_index([("conversation_id", 1), ("created_at", -1)])

    transaction_migration = await db.transactions.update_many(
        {"coach_id": {"$ne": SHARED_CLIENT_OWNER_ID}},
        {"$set": {"coach_id": SHARED_CLIENT_OWNER_ID}},
    )
    if transaction_migration.modified_count:
        logger.info("Shared transaction migration updated %s record(s)", transaction_migration.modified_count)
    await _sync_staff_directory_from_users()
    logger.info("Database indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
