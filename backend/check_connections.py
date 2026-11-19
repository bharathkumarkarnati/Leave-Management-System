
from pymongo import MongoClient
import pymysql

from config import (
    MONGO_URI,
    MONGO_DB_NAME,
    MYSQL_HOST,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_DATABASE
)

# Check MongoDB
try:
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000
    )

    client.admin.command("ping")

    print("MongoDB: Connected successfully!")

    print("Database:", MONGO_DB_NAME)

    client.close()

except Exception as error:
    print("MongoDB connection failed:")
    print(error)


# Check MySQL
try:
    connection = pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        port=MYSQL_PORT,
        database=MYSQL_DATABASE,
        connect_timeout=5
    )

    print("\nMySQL: Connected successfully!")

    print("Database:", MYSQL_DATABASE)

    connection.close()

except Exception as error:
    print("\nMySQL connection failed:")
    print(error)
