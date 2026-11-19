
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB configuration

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://127.0.0.1:27017/"
)

MONGO_DB_NAME = os.getenv(
    "MONGO_DB_NAME",
    "leave_management"
)

# Flask configuration
# These values must be supplied through environment variables.

SECRET_KEY = os.getenv("SECRET_KEY")

ADMIN_REGISTRATION_CODE = os.getenv("ADMIN_REGISTRATION_CODE")

# Old MySQL settings (migration only)

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_DATABASE = os.getenv(
    "MYSQL_DATABASE",
    "leave_management"
)
