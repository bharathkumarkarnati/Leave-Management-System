
from pymongo import MongoClient
from config import MONGO_URI, MONGO_DB_NAME

client = MongoClient(MONGO_URI)

db = client[MONGO_DB_NAME]

collections = [
    "departments",
    "leave_types",
    "employees",
    "leave_requests",
    "notifications"
]

print("\nLEAVEFLOW - MONGODB VERIFICATION")
print("--------------------------------")

for collection in collections:

    count = db[collection].count_documents({})

    print(collection, ":", count, "records")

print("--------------------------------")

print(
    "Total records:",
    sum(db[name].count_documents({}) for name in collections)
)

client.close()
