from __future__ import annotations

import argparse
import os
from pathlib import Path

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne


ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")


CLIENT_RELATED_COLLECTIONS = [
    "follow_ups",
    "client_comments",
    "weight_entries",
    "daily_checkins",
    "meal_uploads",
    "chat_conversations",
    "chat_messages",
]


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


def count_state(db):
    return {
        "clients": db.clients.count_documents({}),
        "follow_ups": db.follow_ups.count_documents({}),
        "client_comments": db.client_comments.count_documents({}),
        "weight_entries": db.weight_entries.count_documents({}),
        "diet_plans_with_client": db.diet_plans.count_documents({"client_id": {"$ne": None}}),
        "daily_checkins": db.daily_checkins.count_documents({}),
        "meal_uploads": db.meal_uploads.count_documents({}),
        "chat_conversations": db.chat_conversations.count_documents({}),
        "chat_messages": db.chat_messages.count_documents({}),
        "files_with_client": db.files.count_documents({"client_id": {"$ne": None}}),
        "transactions_with_client_link": db.transactions.count_documents({"client_id": {"$ne": None}}),
    }


def cleanup(db):
    clients = list(db.clients.find({}, {"_id": 0, "id": 1, "name": 1}))
    client_ids = [client["id"] for client in clients if client.get("id")]
    client_name_by_id = {client["id"]: client.get("name") for client in clients if client.get("id")}

    transaction_updates = []
    if client_ids:
        transactions = list(
            db.transactions.find(
                {"client_id": {"$in": client_ids}},
                {"_id": 0, "id": 1, "client_id": 1, "client_name": 1},
            )
        )
        for transaction in transactions:
            client_id = transaction.get("client_id")
            if not client_id:
                continue
            update_doc = {"client_id": None}
            if not transaction.get("client_name") and client_name_by_id.get(client_id):
                update_doc["client_name"] = client_name_by_id[client_id]
            transaction_updates.append(
                UpdateOne(
                    {"id": transaction["id"]},
                    {"$set": update_doc},
                )
            )

    detached_transactions = 0
    if transaction_updates:
        result = db.transactions.bulk_write(transaction_updates, ordered=False)
        detached_transactions = result.modified_count

    deleted = {}

    # Remove any client-linked files metadata but leave finance transactions intact.
    deleted["files_with_client"] = db.files.delete_many({"client_id": {"$in": client_ids}}).deleted_count if client_ids else 0

    # Preserve reusable templates by only removing plans tied to clients.
    deleted["diet_plans_with_client"] = db.diet_plans.delete_many({"client_id": {"$in": client_ids}}).deleted_count if client_ids else 0

    for collection_name in CLIENT_RELATED_COLLECTIONS:
        deleted[collection_name] = db[collection_name].delete_many({}).deleted_count

    deleted["clients"] = db.clients.delete_many({}).deleted_count
    deleted["detached_transactions"] = detached_transactions

    return deleted


def main():
    parser = argparse.ArgumentParser(description="One-off cleanup for client and follow-up data.")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete data. Without this flag, the script only prints current counts.",
    )
    args = parser.parse_args()

    client, db = get_db()
    try:
        before = count_state(db)
        print("Current client-related state:")
        for key, value in before.items():
            print(f"  {key}: {value}")

        if not args.execute:
            print("\nDry run only. Re-run with --execute to perform cleanup.")
            return

        deleted = cleanup(db)
        after = count_state(db)

        print("\nDeleted / detached:")
        for key, value in deleted.items():
            print(f"  {key}: {value}")

        print("\nState after cleanup:")
        for key, value in after.items():
            print(f"  {key}: {value}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
