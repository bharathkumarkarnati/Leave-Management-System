
import pymysql
from pymongo import MongoClient
from pymongo.errors import PyMongoError, DuplicateKeyError

from config import (
    MYSQL_HOST,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_DATABASE,
    MONGO_URI,
    MONGO_DB_NAME
)


TABLES = [
    "departments",
    "leave_types",
    "employees",
    "leave_requests",
    "notifications"
]


def convert_value(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def convert_row(row):
    return {
        key: convert_value(value)
        for key, value in row.items()
    }


def migrate():

    mysql_connection = None
    mongo_client = None

    try:
        print("\nConnecting to MySQL...")

        mysql_connection = pymysql.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            port=MYSQL_PORT,
            database=MYSQL_DATABASE,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=10
        )

        print("MySQL connected.")

        print("\nConnecting to MongoDB...")

        mongo_client = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000
        )

        mongo_client.admin.command("ping")

        mongo_db = mongo_client[MONGO_DB_NAME]

        print("MongoDB connected.")

        # Safety check: do not overwrite existing MongoDB data.
        for table in TABLES:

            if mongo_db[table].count_documents({}) > 0:
                print(
                    f"\nSTOP: {table} already contains records."
                )
                print("No migration was performed.")
                return

        # Create indexes.
        for table in TABLES:
            mongo_db[table].create_index(
                "id",
                unique=True
            )

        mongo_db.departments.create_index(
            "name",
            unique=True
        )

        mongo_db.leave_types.create_index(
            "name",
            unique=True
        )

        mongo_db.employees.create_index(
            "email",
            unique=True
        )

        mongo_db.employees.create_index(
            "emp_code",
            unique=True
        )

        total_records = 0

        # Transfer MySQL records.
        for table in TABLES:

            print(f"\nMigrating {table}...")

            with mysql_connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT * FROM `{table}`"
                )
                mysql_rows = cursor.fetchall()

            documents = [
                convert_row(row)
                for row in mysql_rows
            ]

            if documents:
                mongo_db[table].insert_many(
                    documents,
                    ordered=True
                )

            total_records += len(documents)

            print(
                f"Transferred {len(documents)} records."
            )

        # Initialize counters using the highest existing IDs.
        for table in TABLES:

            highest = mongo_db[table].find_one(
                {},
                sort=[("id", -1)]
            )

            sequence = (
                int(highest["id"])
                if highest
                else 0
            )

            mongo_db.counters.update_one(
                {"_id": table},
                {"$max": {"sequence": sequence}},
                upsert=True
            )

        # Verify using count_documents().
        print("\nMigration verification:")

        for table in TABLES:

            count = mongo_db[table].count_documents({})

            print(f"{table}: {count} records")

        print("\n================================")
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("================================")

        print(f"Total records: {total_records}")
        print("MySQL database was not modified.")

    except (pymysql.Error, PyMongoError, DuplicateKeyError) as error:

        print("\nMigration database error:")
        print(error)

    except Exception as error:

        print("\nMigration failed:")
        print(error)

    finally:

        if mysql_connection:
            mysql_connection.close()

        if mongo_client:
            mongo_client.close()


if __name__ == "__main__":
    migrate()
