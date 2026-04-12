from __future__ import annotations

import os
import uuid
from datetime import date, datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient


def main() -> None:
    load_dotenv("backend/.env")

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ.get("DB_NAME", "coaching_app")

    client = MongoClient(mongo_url)
    db = client[db_name]

    today = date.today()
    current_month = f"{today.year}-{today.month:02d}"
    previous_month_date = date(today.year - 1, 12, 1) if today.month == 1 else date(today.year, today.month - 1, 1)
    previous_month = f"{previous_month_date.year}-{previous_month_date.month:02d}"
    now = datetime.now(timezone.utc).isoformat()

    existing_keys = {
        (doc.get("client_id"), doc.get("scheduled_date"), doc.get("status"))
        for doc in db.follow_ups.find({}, {"_id": 0, "client_id": 1, "scheduled_date": 1, "status": 1})
    }

    docs_to_insert = []
    completed_count = 0
    scheduled_count = 0

    clients = list(
        db.clients.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "last_follow_up_date": 1,
                "upcoming_follow_up_date": 1,
            },
        )
    )

    for client_doc in clients:
        client_id = client_doc["id"]
        client_name = client_doc.get("name") or "Client"
        last_follow_up_date = (client_doc.get("last_follow_up_date") or "").strip()
        upcoming_follow_up_date = (client_doc.get("upcoming_follow_up_date") or "").strip()

        is_recent_last_follow_up = last_follow_up_date.startswith(current_month) or last_follow_up_date.startswith(previous_month)
        if is_recent_last_follow_up:
            try:
                parsed_last = date.fromisoformat(last_follow_up_date)
            except ValueError:
                parsed_last = None

            if parsed_last and parsed_last <= today:
                completed_key = (client_id, last_follow_up_date, "completed")
                if completed_key not in existing_keys:
                    docs_to_insert.append(
                        {
                            "id": str(uuid.uuid4()),
                            "coach_id": "shared",
                            "client_id": client_id,
                            "scheduled_date": last_follow_up_date,
                            "scheduled_time": None,
                            "type": "check-in",
                            "notes": "Backfilled from client tracker last follow-up date",
                            "status": "completed",
                            "completed_at": f"{last_follow_up_date}T12:00:00+00:00",
                            "created_by_name": "System Seed",
                            "created_at": now,
                        }
                    )
                    existing_keys.add(completed_key)
                    completed_count += 1

            if upcoming_follow_up_date.startswith(current_month):
                scheduled_key = (client_id, upcoming_follow_up_date, "scheduled")
                if scheduled_key not in existing_keys:
                    docs_to_insert.append(
                        {
                            "id": str(uuid.uuid4()),
                            "coach_id": "shared",
                            "client_id": client_id,
                            "scheduled_date": upcoming_follow_up_date,
                            "scheduled_time": None,
                            "type": "check-in",
                            "notes": "Backfilled from client tracker upcoming follow-up date",
                            "status": "scheduled",
                            "created_by_name": "System Seed",
                            "created_at": now,
                        }
                    )
                    existing_keys.add(scheduled_key)
                    scheduled_count += 1

    if docs_to_insert:
        db.follow_ups.insert_many(docs_to_insert)

    print(
        {
            "clients_checked": len(clients),
            "inserted_total": len(docs_to_insert),
            "inserted_completed": completed_count,
            "inserted_scheduled": scheduled_count,
            "current_month": current_month,
            "previous_month": previous_month,
        }
    )


if __name__ == "__main__":
    main()
