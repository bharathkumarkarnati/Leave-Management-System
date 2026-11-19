
from datetime import date

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from werkzeug.security import generate_password_hash

from config import MONGO_URI, MONGO_DB_NAME


# ==================================================
# MONGODB CONNECTION
# ==================================================

client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000
)

db = client[MONGO_DB_NAME]


# ==================================================
# INITIAL DATA
# ==================================================

departments = [
    {"id": 1, "name": "Information Technology"},
    {"id": 2, "name": "Human Resources"},
    {"id": 3, "name": "Finance"},
    {"id": 4, "name": "Administration"}
]


leave_types = [
    {"id": 1, "name": "Annual Leave", "days_per_year": 20},
    {"id": 2, "name": "Sick Leave", "days_per_year": 10},
    {"id": 3, "name": "Personal Leave", "days_per_year": 5},
    {"id": 4, "name": "Unpaid Leave", "days_per_year": 30}
]


employees = [
    {
        "id": 1,
        "emp_code": "EMP000",
        "name": "Alex Morgan",
        "email": "admin@demo.com",
        "password_hash": generate_password_hash("admin123"),
        "role": "Administrator",
        "department_id": 4,
        "phone": "",
        "designation": "Administrator",
        "join_date": date.today().isoformat(),
        "status": "Active"
    },
    {
        "id": 2,
        "emp_code": "EMP001",
        "name": "Jordan Davis",
        "email": "employee@demo.com",
        "password_hash": generate_password_hash("user123"),
        "role": "Employee",
        "department_id": 1,
        "phone": "",
        "designation": "Employee",
        "join_date": date.today().isoformat(),
        "status": "Active"
    }
]


# ==================================================
# CREATE INDEXES
# ==================================================

def create_indexes():

    db.departments.create_index("id", unique=True)
    db.departments.create_index("name", unique=True)

    db.leave_types.create_index("id", unique=True)
    db.leave_types.create_index("name", unique=True)

    db.employees.create_index("id", unique=True)
    db.employees.create_index("email", unique=True)
    db.employees.create_index("emp_code", unique=True)

    db.leave_requests.create_index("id", unique=True)
    db.notifications.create_index("id", unique=True)

    db.counters.create_index("_id", unique=True)


# ==================================================
# INSERT INITIAL DATA
# ==================================================

def seed_collection(name, records):

    collection = db[name]

    if collection.count_documents({}) > 0:

        print(f"{name}: already contains data. Skipping.")

        return

    if records:

        collection.insert_many(records)

    print(f"{name}: inserted {len(records)} records.")

    db.counters.update_one(
        {"_id": name},
        {
            "$max": {
                "sequence": max(
                    record["id"] for record in records
                )
            }
        },
        upsert=True
    )


# ==================================================
# RUN SEED
# ==================================================

def seed():

    try:

        client.admin.command("ping")

        print("Connected to MongoDB.")

        create_indexes()

        seed_collection("departments", departments)

        seed_collection("leave_types", leave_types)

        seed_collection("employees", employees)

        print("\nMongoDB initial data setup completed.")

        print("\nDemo login details:")

        print("Administrator: admin@demo.com / admin123")

        print("Employee: employee@demo.com / user123")

    except DuplicateKeyError:

        print("Duplicate data detected. Check your MongoDB collections.")

    except Exception as error:

        print("Seed failed:", error)

    finally:

        client.close()


if __name__ == "__main__":

    seed()
