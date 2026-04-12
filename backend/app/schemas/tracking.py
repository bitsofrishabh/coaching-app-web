from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class WeightEntryCreate(BaseModel):
    weight_kg: float
    recorded_date: Optional[str] = None
    notes: Optional[str] = None


class WeightEntryResponse(BaseModel):
    id: str
    client_id: str
    weight_kg: float
    recorded_date: str
    notes: Optional[str] = None
    mapped_fields: Dict[str, str] = Field(default_factory=dict)
    created_at: str


class ClientWeightSummaryEntry(BaseModel):
    recorded_date: str
    weight_kg: float


class ClientWeightSummaryResponse(BaseModel):
    client_id: str
    delta_kg: Optional[float] = None
    latest_weight_kg: Optional[float] = None
    oldest_weight_kg: Optional[float] = None
    entries: List[ClientWeightSummaryEntry] = Field(default_factory=list)


class WeightImportEntry(BaseModel):
    recorded_date: str
    weight_kg: float
    notes: Optional[str] = None
    mapped_fields: Dict[str, str] = Field(default_factory=dict)


class WeightImportParseResponse(BaseModel):
    entries: List[WeightImportEntry] = Field(default_factory=list)
    parse_warnings: List[str] = Field(default_factory=list)
    parser_mode: str = "heuristic"


class WeightImportSaveRequest(BaseModel):
    entries: List[WeightImportEntry] = Field(default_factory=list)


class WeightImportSaveResponse(BaseModel):
    saved_entries: int
    updated_entries: int
    latest_weight_kg: Optional[float] = None


class WeightImportTextRequest(BaseModel):
    raw_text: str


class WeightEntryUpsertRequest(BaseModel):
    recorded_date: str
    weight_kg: float
    notes: Optional[str] = None


class TrackerActivityUpdateRequest(BaseModel):
    date: str
    activity_name: str
    completed: bool


class TrackerDayResponse(BaseModel):
    date: str
    activities: Dict[str, bool] = Field(default_factory=dict)


class TrackerMonthResponse(BaseModel):
    entries: List[TrackerDayResponse] = Field(default_factory=list)


class ClientCommentCreate(BaseModel):
    content: str


class ClientCommentResponse(BaseModel):
    id: str
    client_id: str
    coach_id: str
    author_id: str
    author_name: str
    author_role: Optional[str] = None
    content: str
    created_at: str
