
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

ATLAS_URI = os.getenv("ATLAS_MONGO_URI")

try:
    client = MongoClient(
        ATLAS_URI,
        serverSelectionTimeoutMS=10000
    )

    client.admin.command("ping")

    print("ATLAS CONNECTION SUCCESSFUL!")

    db = client["leave_management"]

    print("Database:", db.name)
    print("Connection verified!")

    client.close()

except Exception as e:
    print("ATLAS CONNECTION FAILED!")
    print(e)
