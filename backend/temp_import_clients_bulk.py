from __future__ import annotations

import argparse
import csv
import io
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient


ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")
SHARED_CLIENT_OWNER_ID = "shared"


def get_db():
    mongo_url = os.environ["MONGO_URL"]
    kwargs = {
        "serverSelectionTimeoutMS": 30000,
        "connectTimeoutMS": 20000,
        "socketTimeoutMS": 20000,
    }
    if mongo_url.startswith("mongodb+srv://"):
        kwargs["tlsCAFile"] = certifi.where()
    client = MongoClient(mongo_url, **kwargs)
    db = client[os.environ["DB_NAME"]]
    return client, db


def text_or_none(value):
    text = str(value or "").strip()
    return text or None


def parse_nullable_int(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def parse_nullable_float(value):
    text = re.sub(r"[^\d.\-]", "", str(value or "").strip())
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_height_to_cm(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    feet_dot_inches = re.match(r"^(\d)\.(\d{1,2})$", raw)
    if feet_dot_inches:
        feet = int(feet_dot_inches.group(1))
        inch = int(feet_dot_inches.group(2))
        if inch < 12:
            return round(feet * 30.48 + inch * 2.54, 1)
    ft_in_match = re.search(r"(\d+)[^\d]+(\d+)", raw)
    if ft_in_match:
        feet = int(ft_in_match.group(1))
        inch = int(ft_in_match.group(2))
        return round(feet * 30.48 + inch * 2.54, 1)
    return parse_nullable_float(raw)


def normalize_header_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def parse_csv_rows(csv_text):
    rows = [row for row in csv.reader(io.StringIO(csv_text)) if any(cell.strip() for cell in row)]
    if not rows:
        return []

    header_counts = {}
    headers = []
    for header in rows[0]:
        clean = header.strip()
        header_counts[clean] = header_counts.get(clean, 0) + 1
        headers.append(clean if header_counts[clean] == 1 else f"{clean}__{header_counts[clean]}")

    parsed = []
    for cells in rows[1:]:
        if not any((cell or "").strip() for cell in cells):
            continue
        parsed.append({header: (cells[idx].strip() if idx < len(cells) else "") for idx, header in enumerate(headers)})
    return parsed


def read_csv_value_by_aliases(row, aliases):
    normalized_aliases = [normalize_header_key(alias) for alias in aliases]
    for key, value in row.items():
        if not value:
            continue
        normalized_key = normalize_header_key(re.sub(r"__\d+$", "", key))
        if normalized_key in normalized_aliases:
            return value
    return ""


def pick_diet_from_row(row):
    candidates = []
    for key, value in row.items():
        if not value:
            continue
        normalized_key = normalize_header_key(re.sub(r"__\d+$", "", key))
        if key == "Are you?" or key.startswith("Are you?__") or normalized_key == "dietpreference":
            candidates.append(value)
    for value in candidates:
        if re.search(r"veg|vegetarian|jain|vegan|egg", value, re.IGNORECASE):
            return value
    return candidates[0] if candidates else ""


def parse_added_time(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%B-%Y %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def map_status(value):
    raw = str(value or "").lower()
    if re.search(r"outoftown|out of town|travel|travelling|traveling|vacation", raw):
        return "out-of-town"
    if re.search(r"programdone|done|complete|completed|closed", raw):
        return "completed"
    if re.search(r"onhold|hold|paused|pause", raw):
        return "on-hold"
    if re.search(r"inactive|drop|dropped|lost", raw):
        return "inactive"
    return "active"


def build_notes(row):
    improvement_goal = read_csv_value_by_aliases(row, ["What do you want to improve?", "What are you looking to improve in your Health?", "Improvement Goal", "Goal"])
    medication = read_csv_value_by_aliases(row, ["Are you taking any medication currently", "Are you taking any medication currently?"])
    father_history = read_csv_value_by_aliases(row, ["Father's Medical History"])
    mother_history = read_csv_value_by_aliases(row, ["Mother's Medical History"])
    physical_activity = read_csv_value_by_aliases(row, ["Do you indulge in any physical activity?", "If Yes, What Activity and how many times a week?"])
    activity_minutes = read_csv_value_by_aliases(row, ["How many minutes in a day do you indulge in general Activity?"])
    work_stress = read_csv_value_by_aliases(row, ["How would you describe your official stress?"])
    water_intake = read_csv_value_by_aliases(row, ["How many liters of water do you drink in a day?"])
    hair_condition = read_csv_value_by_aliases(row, ["Do you suffer from any specific hair condition like?"])

    meal_times = [
        ("Wake Up", read_csv_value_by_aliases(row, ["What time do you wake up?"])),
        ("Breakfast", read_csv_value_by_aliases(row, ["What time do you eat your breakfast?"])),
        ("Lunch", read_csv_value_by_aliases(row, ["What time do you eat your lunch?"])),
        ("Evening Snack", read_csv_value_by_aliases(row, ["What time do you eat your evening snacks?"])),
        ("Dinner", read_csv_value_by_aliases(row, ["What time do you eat your dinner?"])),
    ]
    meal_times_text = ", ".join(f"{label}: {value}" for label, value in meal_times if value)

    notes = [
        f"Improve: {improvement_goal}" if improvement_goal else "",
        f"Medication: {medication}" if medication else "",
        f"Past Illness: {read_csv_value_by_aliases(row, ['Any major illness in the past?', 'Past Illness'])}" if read_csv_value_by_aliases(row, ["Any major illness in the past?", "Past Illness"]) else "",
        f"Genetic History: {read_csv_value_by_aliases(row, ['Genetic History'])}" if read_csv_value_by_aliases(row, ["Genetic History"]) else "",
        f"Father History: {father_history}" if father_history else "",
        f"Mother History: {mother_history}" if mother_history else "",
        f"Physical Activity: {physical_activity}" if physical_activity else "",
        f"General Activity: {activity_minutes}" if activity_minutes else "",
        f"Work Stress: {work_stress}" if work_stress else "",
        f"Water Intake: {water_intake}" if water_intake else "",
        f"Hair Condition: {hair_condition}" if hair_condition else "",
        f"Meal Times: {meal_times_text}" if meal_times_text else "",
    ]
    return " | ".join(note for note in notes if note) or None


def map_row_to_client_payload(row, source_file):
    added_time = parse_added_time(read_csv_value_by_aliases(row, ["Added Time"]))
    health_profile = read_csv_value_by_aliases(row, ["About Client", "How would you describe your health profile?", "How is your lifestyle?", "Lifestyle"])
    health_concern = read_csv_value_by_aliases(row, ["Health Issues", "Any specific known concern about your health?", "Health Concern", "What do you suffer from?"])

    return {
        "name": text_or_none(read_csv_value_by_aliases(row, ["Name", "Full Name", "Client Name"])),
        "phone": text_or_none(read_csv_value_by_aliases(row, ["Phone", "Phone Number", "Mobile", "Contact Number"])),
        "location": text_or_none(read_csv_value_by_aliases(row, ["Location", "City", "Address"])),
        "profession": text_or_none(read_csv_value_by_aliases(row, ["Profession", "Occupation"])),
        "age": parse_nullable_int(read_csv_value_by_aliases(row, ["Age"])),
        "gender": text_or_none(read_csv_value_by_aliases(row, ["Gender", "Sex"])),
        "email": text_or_none(read_csv_value_by_aliases(row, ["Email", "Email Address"])),
        "height_cm": parse_height_to_cm(read_csv_value_by_aliases(row, ["Height", "Height (cm)", "Height Cm"])),
        "initial_weight_kg": parse_nullable_float(read_csv_value_by_aliases(row, ["Start Weight", "Initial Weight", "Weight"])),
        "current_weight_kg": parse_nullable_float(read_csv_value_by_aliases(row, ["Current Weight", "Weight"])),
        "goal_weight_kg": parse_nullable_float(read_csv_value_by_aliases(row, ["Target Weight", "Goal Weight", "Desired Weight"])),
        "about_client": text_or_none(health_profile or read_csv_value_by_aliases(row, ["How is your lifestyle?"])),
        "health_issues": text_or_none(health_concern),
        "diet_preference": text_or_none(pick_diet_from_row(row)),
        "primary_coach": text_or_none(read_csv_value_by_aliases(row, ["Primary Coach", "Coach", "Task Owner"])),
        "status": map_status(read_csv_value_by_aliases(row, ["Status"])),
        "sleep_quality": text_or_none(read_csv_value_by_aliases(row, ["How is your quality of sleep?", "Sleep Quality"])),
        "morning_freshness": text_or_none(read_csv_value_by_aliases(row, ["Do you feel fresh after waking up in the morning?", "Morning Freshness"])),
        "sleep_hours": text_or_none(read_csv_value_by_aliases(row, ["How many hours do you sleep?", "Sleep Hours"])),
        "notes": build_notes(row),
        "_added_time": added_time,
        "_source_file": source_file,
    }


def dedupe_key(payload):
    email = (payload.get("email") or "").strip().lower()
    if email:
        return f"email:{email}"
    phone = re.sub(r"\D", "", payload.get("phone") or "")
    if phone:
        return f"phone:{phone}"
    return f"name:{re.sub(r'[^a-z0-9]+', ' ', (payload.get('name') or '').lower()).strip()}"


def merge_payloads(existing, candidate):
    existing_time = existing.get("_added_time")
    candidate_time = candidate.get("_added_time")
    if candidate_time and (not existing_time or candidate_time > existing_time):
        return candidate
    return existing


def load_and_map_rows(file_paths):
    deduped = {}
    raw_rows = 0
    for file_path in file_paths:
        csv_text = Path(file_path).read_text(encoding="utf-8-sig")
        rows = parse_csv_rows(csv_text)
        raw_rows += len(rows)
        for row in rows:
            payload = map_row_to_client_payload(row, Path(file_path).name)
            if not payload.get("name"):
                continue
            key = dedupe_key(payload)
            if key in deduped:
                deduped[key] = merge_payloads(deduped[key], payload)
            else:
                deduped[key] = payload
    return raw_rows, list(deduped.values())


def import_clients(db, file_paths, execute=False):
    raw_rows, unique_payloads = load_and_map_rows(file_paths)
    print(f"Raw CSV rows: {raw_rows}")
    print(f"Unique client payloads after dedupe: {len(unique_payloads)}")
    print(f"Client visibility mode: shared ({SHARED_CLIENT_OWNER_ID})")

    if not execute:
        print("\nDry run only. Re-run with --execute to insert clients.")
        return

    existing_keys = set()
    for existing in db.clients.find({}, {"_id": 0, "email": 1, "phone": 1, "name": 1}):
        existing_keys.add(
            dedupe_key({
                "email": existing.get("email"),
                "phone": existing.get("phone"),
                "name": existing.get("name"),
            })
        )

    docs = []
    for payload in unique_payloads:
        key = dedupe_key(payload)
        if key in existing_keys:
            continue
        existing_keys.add(key)
        created_at = payload.get("_added_time") or datetime.now(timezone.utc)
        current_weight = payload.get("current_weight_kg") if payload.get("current_weight_kg") is not None else payload.get("initial_weight_kg")
        docs.append({
            "id": str(uuid.uuid4()),
            "coach_id": SHARED_CLIENT_OWNER_ID,
            "name": payload.get("name"),
            "email": payload.get("email"),
            "phone": payload.get("phone"),
            "location": payload.get("location"),
            "profession": payload.get("profession"),
            "age": payload.get("age"),
            "gender": payload.get("gender"),
            "diet_preference": payload.get("diet_preference"),
            "primary_coach": payload.get("primary_coach"),
            "height_cm": payload.get("height_cm"),
            "initial_weight_kg": payload.get("initial_weight_kg"),
            "current_weight_kg": current_weight,
            "goal_weight_kg": payload.get("goal_weight_kg"),
            "status": payload.get("status") or "active",
            "notes": payload.get("notes"),
            "about_client": payload.get("about_client"),
            "health_issues": payload.get("health_issues"),
            "recent_comment": None,
            "diet_start_date": None,
            "diet_end_date": None,
            "diet_duration": None,
            "program_start_date": None,
            "program_end_date": None,
            "program_duration": None,
            "pause_days": None,
            "last_follow_up_date": None,
            "upcoming_follow_up_date": None,
            "sleep_quality": payload.get("sleep_quality"),
            "sleep_hours": payload.get("sleep_hours"),
            "morning_freshness": payload.get("morning_freshness"),
            "adherence_rate": 0.0,
            "created_at": created_at.isoformat(),
            "updated_at": created_at.isoformat(),
        })
    if docs:
        db.clients.insert_many(docs)
        print(f"Inserted {len(docs)} shared clients")
    else:
        print("No new clients inserted")


def main():
    parser = argparse.ArgumentParser(description="One-time bulk import of client profile CSV files.")
    parser.add_argument("files", nargs="+", help="CSV files to import")
    parser.add_argument("--execute", action="store_true", help="Actually insert into MongoDB")
    args = parser.parse_args()

    client, db = get_db()
    try:
        import_clients(db, args.files, execute=args.execute)
    finally:
        client.close()


if __name__ == "__main__":
    main()
