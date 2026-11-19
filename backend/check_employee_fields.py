
from pymongo import MongoClient
from config import MONGO_URI, MONGO_DB_NAME

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

employee = db.employees.find_one(
    {},
    {"_id": 0, "password_hash": 1, "password": 1,
     "name": 1, "email": 1, "role": 1, "status": 1}
)

if employee:
    print("Employee fields:", list(employee.keys()))
    print("Password hash exists:", bool(employee.get("password_hash")))
    print("Password field exists:", bool(employee.get("password")))
    print("Role:", employee.get("role"))
    print("Status:", employee.get("status"))
else:
    print("No employee records found.")

client.close()
