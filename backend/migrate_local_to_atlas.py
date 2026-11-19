
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

LOCAL_URI = os.getenv("MONGO_URI")
ATLAS_URI = os.getenv("ATLAS_MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME", "leave_management")

local_client = None
atlas_client = None

try:
    print("Connecting to Local MongoDB...")

    local_client = MongoClient(
        LOCAL_URI,
        serverSelectionTimeoutMS=10000
    )
    local_client.admin.command("ping")

    print("Local MongoDB connected!")

    print("Connecting to MongoDB Atlas...")

    atlas_client = MongoClient(
        ATLAS_URI,
        serverSelectionTimeoutMS=10000
    )
    atlas_client.admin.command("ping")

    print("MongoDB Atlas connected!")

    local_db = local_client[DB_NAME]
    atlas_db = atlas_client[DB_NAME]

    collections = local_db.list_collection_names()

    if not collections:
        raise Exception("Local database has no collections.")

    # Safety check: never overwrite existing Atlas data.
    atlas_collections = atlas_db.list_collection_names()

    if atlas_collections:
        raise Exception(
            "Atlas database already contains collections. "
            "Migration stopped to protect existing data."
        )

    print("\nStarting data transfer...\n")

    total_records = 0

    for collection_name in collections:
        source = local_db[collection_name]
        destination = atlas_db[collection_name]

        records = list(source.find({}))

        if records:
            destination.insert_many(records)

        count = len(records)
        total_records += count

        print(f"{collection_name}: {count} records copied")

    print("\nMIGRATION COMPLETED SUCCESSFULLY!")
    print("Database:", DB_NAME)
    print("Collections:", len(collections))
    print("Total records:", total_records)
    print("Local database was not modified.")

except Exception as e:
    print("\nMIGRATION FAILED!")
    print(e)

finally:
    if local_client:
        local_client.close()

    if atlas_client:
        atlas_client.close()
