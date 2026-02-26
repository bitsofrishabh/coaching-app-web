from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Query, Header, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'diettracker-pro-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Storage Config
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "diettracker-pro"
storage_key = None

# Create the main app
app = FastAPI(title="DietTracker Pro API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ STORAGE FUNCTIONS ============
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set, file uploads disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage not available")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

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

# Client Models
class ClientCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    initial_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    status: str = "active"
    notes: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    coach_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    initial_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    status: str
    notes: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None
    adherence_rate: Optional[float] = None
    created_at: str
    updated_at: str

# Weight Entry Models
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

class DietPlanCreate(BaseModel):
    client_id: str
    name: str
    description: Optional[str] = None
    daily_calories: Optional[int] = None
    meals: List[MealSlot] = []
    instructions: Optional[str] = None
    is_active: bool = True

class DietPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    daily_calories: Optional[int] = None
    meals: Optional[List[MealSlot]] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None

class DietPlanResponse(BaseModel):
    id: str
    client_id: str
    coach_id: str
    name: str
    description: Optional[str] = None
    daily_calories: Optional[int] = None
    meals: List[MealSlot] = []
    instructions: Optional[str] = None
    is_active: bool
    version: int
    created_at: str
    updated_at: str

# Follow-up Models
class FollowUpCreate(BaseModel):
    client_id: str
    scheduled_date: str
    type: str = "check-in"
    notes: Optional[str] = None

class FollowUpUpdate(BaseModel):
    scheduled_date: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    completed_at: Optional[str] = None

class FollowUpResponse(BaseModel):
    id: str
    client_id: str
    coach_id: str
    scheduled_date: str
    type: str
    status: str
    notes: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str

# Transaction Models
class TransactionCreate(BaseModel):
    type: str  # income, expense
    category: str
    amount: float
    description: Optional[str] = None
    client_id: Optional[str] = None
    transaction_date: Optional[str] = None

class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    client_id: Optional[str] = None
    transaction_date: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    coach_id: str
    type: str
    category: str
    amount: float
    description: Optional[str] = None
    client_id: Optional[str] = None
    transaction_date: str
    created_at: str

# ============ AUTH HELPERS ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ AUTH ROUTES ============
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "created_at": now,
        "updated_at": now
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, data.email, data.role)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=data.email, name=data.name, role=data.role, created_at=now)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"], created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], role=user["role"], created_at=user["created_at"])

# ============ CLIENT ROUTES ============
@api_router.get("/clients", response_model=List[ClientResponse])
async def get_clients(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    query = {"coach_id": user["id"]}
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
    total = await db.clients.count_documents({"coach_id": user["id"]})
    active = await db.clients.count_documents({"coach_id": user["id"], "status": "active"})
    on_hold = await db.clients.count_documents({"coach_id": user["id"], "status": "on-hold"})
    completed = await db.clients.count_documents({"coach_id": user["id"], "status": "completed"})
    return {"total": total, "active": active, "on_hold": on_hold, "completed": completed}

@api_router.post("/clients", response_model=ClientResponse)
async def create_client(data: ClientCreate, user: dict = Depends(get_current_user)):
    client_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    client_doc = {
        "id": client_id,
        "coach_id": user["id"],
        **data.model_dump(),
        "current_weight_kg": data.initial_weight_kg,
        "adherence_rate": 0.0,
        "created_at": now,
        "updated_at": now
    }
    await db.clients.insert_one(client_doc)
    client_doc.pop("_id", None)
    return ClientResponse(**client_doc)

@api_router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    client = await db.clients.find_one({"id": client_id, "coach_id": user["id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientResponse(**client)

@api_router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, data: ClientUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.clients.find_one_and_update(
        {"id": client_id, "coach_id": user["id"]},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Client not found")
    result.pop("_id", None)
    return ClientResponse(**result)

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    result = await db.clients.delete_one({"id": client_id, "coach_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted"}

# ============ WEIGHT ENTRY ROUTES ============
@api_router.get("/clients/{client_id}/weights", response_model=List[WeightEntryResponse])
async def get_weight_entries(client_id: str, limit: int = 100, user: dict = Depends(get_current_user)):
    # Verify client belongs to coach
    client = await db.clients.find_one({"id": client_id, "coach_id": user["id"]})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    entries = await db.weight_entries.find({"client_id": client_id}, {"_id": 0}).sort("recorded_date", -1).limit(limit).to_list(limit)
    return [WeightEntryResponse(**e) for e in entries]

@api_router.post("/clients/{client_id}/weights", response_model=WeightEntryResponse)
async def add_weight_entry(client_id: str, data: WeightEntryCreate, user: dict = Depends(get_current_user)):
    client = await db.clients.find_one({"id": client_id, "coach_id": user["id"]})
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
        "created_at": now
    }
    await db.weight_entries.insert_one(entry_doc)
    
    # Update client's current weight
    await db.clients.update_one({"id": client_id}, {"$set": {"current_weight_kg": data.weight_kg, "updated_at": now}})
    
    entry_doc.pop("_id", None)
    return WeightEntryResponse(**entry_doc)

# ============ DIET PLAN ROUTES ============
@api_router.get("/diet-plans", response_model=List[DietPlanResponse])
async def get_diet_plans(client_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"coach_id": user["id"]}
    if client_id:
        query["client_id"] = client_id
    plans = await db.diet_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [DietPlanResponse(**p) for p in plans]

@api_router.post("/diet-plans", response_model=DietPlanResponse)
async def create_diet_plan(data: DietPlanCreate, user: dict = Depends(get_current_user)):
    # Verify client belongs to coach
    client = await db.clients.find_one({"id": data.client_id, "coach_id": user["id"]})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    plan_doc = {
        "id": plan_id,
        "coach_id": user["id"],
        **data.model_dump(),
        "meals": [m.model_dump() for m in data.meals],
        "version": 1,
        "created_at": now,
        "updated_at": now
    }
    await db.diet_plans.insert_one(plan_doc)
    plan_doc.pop("_id", None)
    return DietPlanResponse(**plan_doc)

@api_router.get("/diet-plans/{plan_id}", response_model=DietPlanResponse)
async def get_diet_plan(plan_id: str, user: dict = Depends(get_current_user)):
    plan = await db.diet_plans.find_one({"id": plan_id, "coach_id": user["id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Diet plan not found")
    return DietPlanResponse(**plan)

@api_router.put("/diet-plans/{plan_id}", response_model=DietPlanResponse)
async def update_diet_plan(plan_id: str, data: DietPlanUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "meals" in update_data:
        update_data["meals"] = [m.model_dump() if hasattr(m, 'model_dump') else m for m in update_data["meals"]]
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
    return DietPlanResponse(**result)

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
    query = {"coach_id": user["id"]}
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status
    
    follow_ups = await db.follow_ups.find(query, {"_id": 0}).sort("scheduled_date", 1).to_list(100)
    return [FollowUpResponse(**f) for f in follow_ups]

@api_router.post("/follow-ups", response_model=FollowUpResponse)
async def create_follow_up(data: FollowUpCreate, user: dict = Depends(get_current_user)):
    follow_up_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    follow_up_doc = {
        "id": follow_up_id,
        "coach_id": user["id"],
        **data.model_dump(),
        "status": "scheduled",
        "created_at": now
    }
    await db.follow_ups.insert_one(follow_up_doc)
    follow_up_doc.pop("_id", None)
    return FollowUpResponse(**follow_up_doc)

@api_router.put("/follow-ups/{follow_up_id}", response_model=FollowUpResponse)
async def update_follow_up(follow_up_id: str, data: FollowUpUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.follow_ups.find_one_and_update(
        {"id": follow_up_id, "coach_id": user["id"]},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    result.pop("_id", None)
    return FollowUpResponse(**result)

@api_router.delete("/follow-ups/{follow_up_id}")
async def delete_follow_up(follow_up_id: str, user: dict = Depends(get_current_user)):
    result = await db.follow_ups.delete_one({"id": follow_up_id, "coach_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return {"message": "Follow-up deleted"}

# ============ TRANSACTION ROUTES ============
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
    query = {"coach_id": user["id"]}
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

@api_router.get("/transactions/summary")
async def get_transaction_summary(
    month: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"coach_id": user["id"]}
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
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    transaction_doc = {
        "id": transaction_id,
        "coach_id": user["id"],
        **data.model_dump(),
        "transaction_date": data.transaction_date or now[:10],
        "created_at": now
    }
    await db.transactions.insert_one(transaction_doc)
    transaction_doc.pop("_id", None)
    return TransactionResponse(**transaction_doc)

@api_router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(transaction_id: str, data: TransactionUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.transactions.find_one_and_update(
        {"id": transaction_id, "coach_id": user["id"]},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    result.pop("_id", None)
    return TransactionResponse(**result)

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": transaction_id, "coach_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}

# ============ FILE UPLOAD ROUTES ============
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}

@api_router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    client_id: Optional[str] = None,
    category: str = "general",
    user: dict = Depends(get_current_user)
):
    if not storage_key and not init_storage():
        raise HTTPException(status_code=503, detail="Storage not available")
    
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    
    result = put_object(path, data, content_type)
    
    file_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    file_doc = {
        "id": file_id,
        "coach_id": user["id"],
        "client_id": client_id,
        "category": category,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now
    }
    await db.files.insert_one(file_doc)
    
    return {"id": file_id, "path": result["path"], "filename": file.filename}

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, user: dict = Depends(get_current_user)):
    record = await db.files.find_one({"id": file_id, "coach_id": user["id"], "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    
    data, content_type = get_object(record["storage_path"])
    return Response(content=data, media_type=record.get("content_type", content_type))

# ============ DASHBOARD STATS ============
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    # Client stats
    total_clients = await db.clients.count_documents({"coach_id": user["id"]})
    active_clients = await db.clients.count_documents({"coach_id": user["id"], "status": "active"})
    
    # Follow-up stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    pending_follow_ups = await db.follow_ups.count_documents({"coach_id": user["id"], "status": "scheduled", "scheduled_date": {"$lte": today}})
    
    # Revenue stats (current month)
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    month_transactions = await db.transactions.find({"coach_id": user["id"], "transaction_date": {"$regex": f"^{current_month}"}}, {"_id": 0}).to_list(1000)
    monthly_income = sum(t["amount"] for t in month_transactions if t["type"] == "income")
    monthly_expense = sum(t["amount"] for t in month_transactions if t["type"] == "expense")
    
    # Diet plans count
    active_plans = await db.diet_plans.count_documents({"coach_id": user["id"], "is_active": True})
    
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "pending_follow_ups": pending_follow_ups,
        "monthly_revenue": monthly_income - monthly_expense,
        "monthly_income": monthly_income,
        "monthly_expense": monthly_expense,
        "active_diet_plans": active_plans
    }

@api_router.get("/dashboard/recent-activity")
async def get_recent_activity(limit: int = 10, user: dict = Depends(get_current_user)):
    # Get recent clients
    recent_clients = await db.clients.find({"coach_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Get upcoming follow-ups
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    upcoming_follow_ups = await db.follow_ups.find(
        {"coach_id": user["id"], "status": "scheduled", "scheduled_date": {"$gte": today}},
        {"_id": 0}
    ).sort("scheduled_date", 1).limit(5).to_list(5)
    
    return {
        "recent_clients": recent_clients,
        "upcoming_follow_ups": upcoming_follow_ups
    }

# ============ CLIENT MOBILE APP MODELS ============

# Client Registration (for mobile app)
class ClientRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    invite_code: Optional[str] = None  # Coach's invite code

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
    
    # Find coach by invite code if provided
    coach_id = None
    if data.invite_code:
        coach = await db.users.find_one({"invite_code": data.invite_code, "role": "coach"}, {"_id": 0})
        if coach:
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
    
    if not storage_key and not init_storage():
        raise HTTPException(status_code=503, detail="Storage not available")
    
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
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
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
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
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
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
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
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
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
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
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
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
    invite_code = str(uuid.uuid4())[:8].upper()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"invite_code": invite_code}}
    )
    
    return {"invite_code": invite_code}

@api_router.get("/coach/invite-code")
async def get_invite_code(user: dict = Depends(get_current_user)):
    """Get coach's current invite code"""
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
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

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.clients.create_index([("coach_id", 1), ("status", 1)])
    await db.weight_entries.create_index([("client_id", 1), ("recorded_date", -1)])
    await db.diet_plans.create_index([("coach_id", 1), ("client_id", 1)])
    await db.follow_ups.create_index([("coach_id", 1), ("scheduled_date", 1)])
    await db.transactions.create_index([("coach_id", 1), ("transaction_date", -1)])
    logger.info("Database indexes created")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
