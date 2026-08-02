import os
from pathlib import Path

import certifi
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


def _get_required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value or value.lower() == "change-me":
        raise RuntimeError(f"{name} must be set to a non-placeholder value in backend/.env")
    return value


def _get_cors_origins() -> list[str]:
    raw_origins = _get_required_env("CORS_ORIGINS")
    origins = [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]
    if not origins or "*" in origins:
        raise RuntimeError("CORS_ORIGINS must contain one or more explicit origins; wildcard origins are not supported")
    return origins

mongo_url = _get_required_env("MONGO_URL")
mongo_client_kwargs = {
    "serverSelectionTimeoutMS": 30000,
    "connectTimeoutMS": 20000,
    "socketTimeoutMS": 20000,
}
if mongo_url.startswith("mongodb+srv://"):
    mongo_client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
db = client[_get_required_env("DB_NAME")]

JWT_SECRET = _get_required_env("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
CORS_ORIGINS = _get_cors_origins()

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "diettracker-pro"
SHARED_CLIENT_OWNER_ID = "shared"

ROLE_SUPER_ADMIN = "super_admin"
ROLE_ADMIN = "admin"
ROLE_DIETITIAN = "dietitian"
ROLE_CLIENT = "client"
LEGACY_ROLE_COACH = "coach"

SUPER_ADMIN_ROLES = {ROLE_SUPER_ADMIN, LEGACY_ROLE_COACH}
ADMIN_ROLES = {ROLE_SUPER_ADMIN, LEGACY_ROLE_COACH, ROLE_ADMIN}
STAFF_ROLES = {ROLE_SUPER_ADMIN, LEGACY_ROLE_COACH, ROLE_ADMIN, ROLE_DIETITIAN}

TRACKER_ACTIVITY_ORDER = [
    "morning_drink",
    "breakfast",
    "lunch",
    "dinner",
    "night_drink",
    "workout",
]

TRACKER_ACTIVITY_ALIASES = {
    "morning_drink": "morning_drink",
    "morning drink": "morning_drink",
    "breakfast": "breakfast",
    "lunch": "lunch",
    "dinner": "dinner",
    "night_drink": "night_drink",
    "night drink": "night_drink",
    "workout": "workout",
}
