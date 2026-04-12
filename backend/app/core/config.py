import os
from pathlib import Path

import certifi
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
mongo_client_kwargs = {
    "serverSelectionTimeoutMS": 30000,
    "connectTimeoutMS": 20000,
    "socketTimeoutMS": 20000,
}
if mongo_url.startswith("mongodb+srv://"):
    mongo_client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "diettracker-pro-secret-key-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

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

