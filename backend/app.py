
import os
from datetime import date, datetime
from functools import wraps

from flask import Flask, jsonify, request, session, send_from_directory
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError
from werkzeug.security import generate_password_hash, check_password_hash

from config import (
    MONGO_URI,
    MONGO_DB_NAME,
    SECRET_KEY,
    ADMIN_REGISTRATION_CODE
)


# ==================================================
# APPLICATION SETUP
# ==================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FRONTEND_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "..", "LeaveFlow")
)

app = Flask(__name__)

app.secret_key = SECRET_KEY

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax"
)


# ==================================================
# MONGODB CONNECTION
# ==================================================

mongo_client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000
)

mongo_db = mongo_client[MONGO_DB_NAME]

_indexes_ready = False


COLLECTIONS = {
    "departments": "departments",
    "leave_types": "leave_types",
    "employees": "employees",
    "leave_requests": "leave_requests",
    "notifications": "notifications"
}


# Allowed fields for each collection

TABLE_COLUMNS = {
    "departments": {
        "name"
    },

    "leave_types": {
        "name",
        "days_per_year"
    },

    "employees": {
        "emp_code",
        "name",
        "email",
        "password",
        "role",
        "department_id",
        "phone",
        "designation",
        "join_date",
        "status"
    },

    "leave_requests": {
        "employee_id",
        "leave_type_id",
        "from_date",
        "to_date",
        "days",
        "reason",
        "status",
        "applied_on",
        "reviewed_by",
        "reviewed_on",
        "remarks"
    },

    "notifications": {
        "employee_id",
        "message",
        "is_read",
        "created_at"
    }
}


# ==================================================
# DATABASE HELPERS
# ==================================================


def get_db():

    global _indexes_ready

    if not _indexes_ready:

        mongo_client.admin.command("ping")

        mongo_db.departments.create_index(
            "id",
            unique=True
        )

        mongo_db.departments.create_index(
            "name",
            unique=True
        )

        mongo_db.leave_types.create_index(
            "id",
            unique=True
        )

        mongo_db.leave_types.create_index(
            "name",
            unique=True
        )

        mongo_db.employees.create_index(
            "id",
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

        mongo_db.leave_requests.create_index(
            "id",
            unique=True
        )

        mongo_db.notifications.create_index(
            "id",
            unique=True
        )

        # MongoDB automatically creates a unique index
        # on the _id field. No additional index is needed.

        _indexes_ready = True

    return mongo_db


def next_id(collection_name):

    db = get_db()

    result = db.counters.find_one_and_update(
        {"_id": collection_name},

        {"$inc": {"sequence": 1}},

        upsert=True,

        return_document=ReturnDocument.AFTER
    )

    return int(result["sequence"])


def clean_document(document):

    if not document:
        return None

    result = dict(document)

    result.pop("_id", None)

    return result


def safe_employee(employee):

    if not employee:
        return None

    result = clean_document(employee)

    result.pop("password_hash", None)

    result.pop("password", None)

    return result


def current_employee():

    employee_id = session.get("employee_id")

    if not employee_id:
        return None

    return get_db().employees.find_one({
        "id": int(employee_id)
    })


def json_body():

    return request.get_json(silent=True) or {}


def as_int(value, default=None):

    try:
        return int(value)

    except (TypeError, ValueError):
        return default


# ==================================================
# AUTHENTICATION DECORATORS
# ==================================================

def login_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        if not current_employee():

            return jsonify({
                "error": "Please log in first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


def admin_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        employee = current_employee()

        if not employee:

            return jsonify({
                "error": "Please log in first."
            }), 401

        if employee.get("role") != "Administrator":

            return jsonify({
                "error": "Administrator access required."
            }), 403

        return function(*args, **kwargs)

    return wrapper


# ==================================================
# NOTIFICATION HELPER
# ==================================================

def notify_employee(employee_id, message):

    db = get_db()

    notification = {
        "id": next_id("notifications"),

        "employee_id": int(employee_id),

        "message": str(message),

        "is_read": False,

        "created_at": datetime.now().isoformat(
            timespec="seconds"
        )
    }

    db.notifications.insert_one(notification)


# ==================================================
# LEAVE MANAGEMENT HELPERS
# ==================================================

def inclusive_days(from_date, to_date):

    start = date.fromisoformat(str(from_date)[:10])

    end = date.fromisoformat(str(to_date)[:10])

    return (end - start).days + 1


def leave_balance(employee_id, leave_type_id, year_value):

    db = get_db()

    leave_type = db.leave_types.find_one({
        "id": int(leave_type_id)
    })

    if not leave_type:
        return 0

    allowed = int(
        leave_type.get("days_per_year", 0)
    )

    used = 0

    pending = 0

    requests = db.leave_requests.find({
        "employee_id": int(employee_id),

        "leave_type_id": int(leave_type_id),

        "from_date": {
            "$regex": "^" + str(year_value)
        },

        "status": {
            "$in": ["Approved", "Pending"]
        }
    })

    for row in requests:

        if row.get("status") == "Approved":

            used += int(row.get("days", 0))

        elif row.get("status") == "Pending":

            pending += int(row.get("days", 0))

    return max(0, allowed - used - pending)


def validate_leave_request(data, employee_id):

    required = [
        "leave_type_id",
        "from_date",
        "to_date",
        "reason"
    ]

    if any(not data.get(key) for key in required):

        return "Please complete all leave request fields."

    try:

        start = date.fromisoformat(
            str(data["from_date"])[:10]
        )

        end = date.fromisoformat(
            str(data["to_date"])[:10]
        )

    except ValueError:

        return "Please enter valid leave dates."

    if end < start:

        return "To date must be the same as or later than the from date."

    if start < date.today():

        return "Leave cannot start in the past."

    days = (end - start).days + 1

    type_id = as_int(data.get("leave_type_id"))

    if not type_id:

        return "Please select a valid leave type."

    db = get_db()

    if not db.leave_types.find_one({"id": type_id}):

        return "Please select a valid leave type."

    overlap = db.leave_requests.find_one({

        "employee_id": int(employee_id),

        "status": {
            "$in": ["Pending", "Approved"]
        },

        "from_date": {
            "$lte": end.isoformat()
        },

        "to_date": {
            "$gte": start.isoformat()
        }

    })

    if overlap:

        return "These dates overlap with an existing pending or approved leave request."

    if days > leave_balance(
        employee_id,
        type_id,
        start.year
    ):

        return "Not enough leave balance for the selected leave type."

    if not str(data.get("reason", "")).strip():

        return "Please enter a reason for your leave."

    return None


# ==================================================
# DATABASE ERROR HANDLER
# ==================================================

@app.errorhandler(PyMongoError)
def handle_database_error(error):

    app.logger.exception(
        "MongoDB operation failed"
    )

    return jsonify({
        "error": "Database connection or operation failed. Check MongoDB settings."
    }), 500


# ==================================================
# LOGIN
# ==================================================

@app.route("/api/login", methods=["POST"])
def login():

    data = json_body()

    email = str(
        data.get("email", "")
    ).strip().lower()

    password = str(
        data.get("password", "")
    )

    role = str(
        data.get("role", "")
    )

    employee = get_db().employees.find_one({
        "email": email
    })

    if (
        not employee
        or employee.get("status") != "Active"
        or not check_password_hash(
            employee.get("password_hash", ""),
            password
        )
        or employee.get("role") != role
    ):

        return jsonify({
            "error": "Invalid email, password, or role."
        }), 401

    session["employee_id"] = int(employee["id"])

    return jsonify({
        "employee": safe_employee(employee)
    })


# ==================================================
# CURRENT LOGGED-IN EMPLOYEE
# ==================================================

@app.route("/api/me", methods=["GET"])
def me():

    employee = current_employee()

    if not employee:

        session.clear()

        return jsonify({
            "error": "Not logged in."
        }), 401

    return jsonify(
        safe_employee(employee)
    )


# ==================================================
# LOGOUT
# ==================================================

@app.route("/api/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({
        "success": True
    })


# ==================================================
# REGISTER
# ==================================================

@app.route("/api/register", methods=["POST"])
def register():

    data = json_body()

    name = str(
        data.get("name", "")
    ).strip()

    email = str(
        data.get("email", "")
    ).strip().lower()

    password = str(
        data.get("password", "")
    )

    role = str(
        data.get("role", "Employee")
    )

    department_id = as_int(
        data.get("department_id")
    )

    if (
        not name
        or not email
        or len(password) < 6
        or not department_id
    ):

        return jsonify({
            "error": "Please complete all required fields. Password must be at least 6 characters."
        }), 400

    if role not in ["Employee", "Administrator"]:

        return jsonify({
            "error": "Invalid role."
        }), 400

    if (
        role == "Administrator"
        and data.get("admin_code") != ADMIN_REGISTRATION_CODE
    ):

        return jsonify({
            "error": "Invalid administrator registration code."
        }), 403

    db = get_db()

    if not db.departments.find_one({
        "id": department_id
    }):

        return jsonify({
            "error": "Please select a valid department."
        }), 400

    if db.employees.find_one({
        "email": email
    }):

        return jsonify({
            "error": "An account with this email already exists."
        }), 409

    employee_id = next_id("employees")

    employee = {

        "id": employee_id,

        "emp_code": "EMP" + str(employee_id).zfill(3),

        "name": name,

        "email": email,

        "password_hash": generate_password_hash(password),

        "role": role,

        "department_id": department_id,

        "phone": str(
            data.get("phone", "")
        ).strip(),

        "designation": str(
            data.get("designation", "")
        ).strip(),

        "join_date": date.today().isoformat(),

        "status": "Active"
    }

    try:

        db.employees.insert_one(employee)

    except DuplicateKeyError:

        return jsonify({
            "error": "An account with this email or employee ID already exists."
        }), 409

    session["employee_id"] = employee_id

    return jsonify({
        "employee": safe_employee(employee)
    }), 201


# ==================================================
# RESET PASSWORD
# ==================================================

@app.route("/api/reset-password", methods=["POST"])
def reset_password():

    data = json_body()

    email = str(
        data.get("email", "")
    ).strip().lower()

    emp_code = str(
        data.get("emp_code", "")
    ).strip()

    new_password = str(
        data.get("new_password", "")
    )

    if len(new_password) < 6:

        return jsonify({
            "error": "Password must be at least 6 characters."
        }), 400

    result = get_db().employees.update_one(

        {
            "email": email,
            "emp_code": emp_code,
            "status": "Active"
        },

        {
            "$set": {
                "password_hash": generate_password_hash(
                    new_password
                )
            }
        }
    )

    if not result.matched_count:

        return jsonify({
            "error": "Email and employee ID do not match."
        }), 404

    return jsonify({
        "success": True
    })


# ==================================================
# CHANGE PASSWORD
# ==================================================

@app.route("/api/change-password", methods=["POST"])
@login_required
def change_password():

    data = json_body()

    employee = current_employee()

    old_password = str(
        data.get("current_password", "")
    )

    new_password = str(
        data.get("new_password", "")
    )

    if not check_password_hash(
        employee.get("password_hash", ""),
        old_password
    ):

        return jsonify({
            "error": "Current password is incorrect."
        }), 400

    if len(new_password) < 6:

        return jsonify({
            "error": "New password must be at least 6 characters."
        }), 400

    get_db().employees.update_one(

        {"id": employee["id"]},

        {
            "$set": {
                "password_hash": generate_password_hash(
                    new_password
                )
            }
        }
    )

    return jsonify({
        "success": True
    })


# ==================================================
# GET AND INSERT COLLECTION DATA
# ==================================================

@app.route("/api/data/<table>", methods=["GET", "POST"])
def data_collection(table):

    if table not in COLLECTIONS:

        return jsonify({
            "error": "Unknown data collection."
        }), 404

    db = get_db()

    collection = db[COLLECTIONS[table]]

    # ----------------------------------------------
    # GET DATA
    # ----------------------------------------------

    if request.method == "GET":

        employee = current_employee()

        if (
            table not in ["departments", "leave_types"]
            and not employee
        ):

            return jsonify({
                "error": "Please log in first."
            }), 401

        query = {}

        if (
            employee
            and employee.get("role") != "Administrator"
        ):

            if table == "leave_requests":

                query["employee_id"] = int(
                    employee["id"]
                )

            elif table == "notifications":

                query["employee_id"] = int(
                    employee["id"]
                )

            elif table == "employees":

                query["id"] = int(
                    employee["id"]
                )

        rows = [
            clean_document(row)
            for row in collection.find(query).sort("id", 1)
        ]

        if table == "employees":

            rows = [
                safe_employee(row)
                for row in rows
            ]

        return jsonify(rows)

    # ----------------------------------------------
    # POST DATA
    # ----------------------------------------------

    employee = current_employee()

    if not employee:

        return jsonify({
            "error": "Please log in first."
        }), 401

    data = json_body()

    # Employee submitting leave request
    if table == "leave_requests":

        if employee.get("role") != "Employee":

            return jsonify({
                "error": "Only employees can submit leave requests."
            }), 403

        error = validate_leave_request(
            data,
            employee["id"]
        )

        if error:

            return jsonify({
                "error": error
            }), 400

        start = str(data["from_date"])[:10]

        end = str(data["to_date"])[:10]

        row = {

            "id": next_id(table),

            "employee_id": int(employee["id"]),

            "leave_type_id": int(data["leave_type_id"]),

            "from_date": start,

            "to_date": end,

            "days": inclusive_days(start, end),

            "reason": str(data["reason"]).strip(),

            "status": "Pending",

            "applied_on": date.today().isoformat(),

            "reviewed_by": None,

            "reviewed_on": None,

            "remarks": ""
        }

        collection.insert_one(row)

        admins = db.employees.find({

            "role": "Administrator",

            "status": "Active"

        })

        for admin in admins:

            notify_employee(
                admin["id"],
                f"New leave request from {employee.get('name', 'an employee')}."
            )

        return jsonify(
            clean_document(row)
        ), 201

    # Other insert operations are administrator-only
    if employee.get("role") != "Administrator":

        return jsonify({
            "error": "Administrator access required."
        }), 403

    payload = {
        key: value
        for key, value in data.items()
        if key in TABLE_COLUMNS[table]
    }

    if table == "employees":

        password = payload.pop("password", None)

        if password:

            if len(str(password)) < 6:

                return jsonify({
                    "error": "Password must be at least 6 characters."
                }), 400

            payload["password_hash"] = generate_password_hash(
                str(password)
            )

        payload["department_id"] = as_int(
            payload.get("department_id")
        )

        if payload.get("email"):

            payload["email"] = str(
                payload["email"]
            ).strip().lower()

    if table == "leave_types":

        payload["days_per_year"] = as_int(
            payload.get("days_per_year"),
            0
        )

    if table == "departments":

        payload["name"] = str(
            payload.get("name", "")
        ).strip()

    if not payload:

        return jsonify({
            "error": "No valid fields supplied."
        }), 400

    row_id = next_id(table)

    payload["id"] = row_id

    try:

        collection.insert_one(payload)

    except DuplicateKeyError:

        return jsonify({
            "error": "A record with this unique value already exists."
        }), 409

    return jsonify(
        clean_document(payload)
    ), 201


# ==================================================
# UPDATE AND DELETE COLLECTION RECORDS
# ==================================================

@app.route(
    "/api/data/<table>/<int:row_id>",
    methods=["PUT", "DELETE"]
)
@login_required
def data_record(table, row_id):

    if table not in COLLECTIONS:

        return jsonify({
            "error": "Unknown data collection."
        }), 404

    db = get_db()

    collection = db[COLLECTIONS[table]]

    employee = current_employee()

    record = collection.find_one({
        "id": row_id
    })

    if not record:

        return jsonify({
            "error": "Record not found."
        }), 404

    is_admin = (
        employee.get("role") == "Administrator"
    )

    # ----------------------------------------------
    # DELETE
    # ----------------------------------------------

    if request.method == "DELETE":

        if not is_admin:

            return jsonify({
                "error": "Administrator access required."
            }), 403

        if (
            table == "employees"
            and db.leave_requests.find_one({
                "employee_id": row_id
            })
        ):

            return jsonify({
                "error": "Cannot delete an employee with leave requests. Mark the employee Inactive instead."
            }), 400

        if (
            table == "departments"
            and db.employees.find_one({
                "department_id": row_id
            })
        ):

            return jsonify({
                "error": "Cannot delete a department that still has employees."
            }), 400

        if (
            table == "leave_types"
            and db.leave_requests.find_one({
                "leave_type_id": row_id
            })
        ):

            return jsonify({
                "error": "Cannot delete a leave type used by requests."
            }), 400

        collection.delete_one({
            "id": row_id
        })

        return jsonify({
            "success": True
        })

    # ----------------------------------------------
    # UPDATE
    # ----------------------------------------------

    data = json_body()

    payload = {
        key: value
        for key, value in data.items()
        if key in TABLE_COLUMNS[table]
    }

    if table == "employees":

        if (
            not is_admin
            and row_id == int(employee["id"])
        ):

            allowed = {
                "name",
                "phone"
            }

            payload = {
                key: value
                for key, value in payload.items()
                if key in allowed
            }

        elif not is_admin:

            return jsonify({
                "error": "You cannot edit this employee."
            }), 403

        password = payload.pop("password", None)

        if password:

            if len(str(password)) < 6:

                return jsonify({
                    "error": "Password must be at least 6 characters."
                }), 400

            payload["password_hash"] = generate_password_hash(
                str(password)
            )

        if "department_id" in payload:

            payload["department_id"] = as_int(
                payload["department_id"]
            )

        if "email" in payload:

            payload["email"] = str(
                payload["email"]
            ).strip().lower()

    elif table in ["departments", "leave_types"]:

        if not is_admin:

            return jsonify({
                "error": "Administrator access required."
            }), 403

        if (
            table == "leave_types"
            and "days_per_year" in payload
        ):

            payload["days_per_year"] = as_int(
                payload["days_per_year"],
                0
            )

    elif table == "leave_requests":

        if is_admin:

            if record.get("status") != "Pending":

                return jsonify({
                    "error": "This request is no longer pending."
                }), 400

            payload = {
                key: value
                for key, value in payload.items()
                if key in {
                    "status",
                    "reviewed_by",
                    "reviewed_on",
                    "remarks"
                }
            }

            if payload.get("status") not in [
                "Approved",
                "Rejected"
            ]:

                return jsonify({
                    "error": "Invalid review decision."
                }), 400

            payload["reviewed_by"] = int(
                employee["id"]
            )

            payload["reviewed_on"] = date.today().isoformat()

        else:

            if int(record.get("employee_id", -1)) != int(employee["id"]):

                return jsonify({
                    "error": "You cannot edit this leave request."
                }), 403

            if (
                record.get("status") != "Pending"
                or data.get("status") != "Cancelled"
            ):

                return jsonify({
                    "error": "Only pending requests can be cancelled."
                }), 400

            payload = {
                "status": "Cancelled"
            }

    elif table == "notifications":

        if int(record.get("employee_id", -1)) != int(employee["id"]):

            return jsonify({
                "error": "You cannot edit this notification."
            }), 403

        payload = {
            "is_read": bool(
                data.get("is_read", True)
            )
        }

    if not payload:

        return jsonify({
            "error": "No valid fields supplied."
        }), 400

    try:

        collection.update_one(
            {"id": row_id},
            {"$set": payload}
        )

    except DuplicateKeyError:

        return jsonify({
            "error": "A record with this unique value already exists."
        }), 409

    updated = collection.find_one({
        "id": row_id
    })

    # Notify employee after administrator review
    if (
        table == "leave_requests"
        and is_admin
        and payload.get("status") in ["Approved", "Rejected"]
    ):

        notify_employee(
            record["employee_id"],
            f"Your leave request has been {payload['status'].lower()}."
        )

    if (
        table == "employees"
        and row_id == int(employee["id"])
    ):

        updated = current_employee()

    if table == "employees":

        return jsonify(
            safe_employee(updated)
        )

    return jsonify(
        clean_document(updated)
    )


# ==================================================
# MANUAL NOTIFICATION API
# ==================================================

@app.route("/api/notify", methods=["POST"])
@login_required
def notify():

    data = json_body()

    employee_id = as_int(
        data.get("employee_id")
    )

    message = str(
        data.get("message", "")
    ).strip()

    employee = current_employee()

    if not employee_id or not message:

        return jsonify({
            "error": "Employee and message are required."
        }), 400

    if (
        employee.get("role") != "Administrator"
        and employee_id != int(employee["id"])
    ):

        return jsonify({
            "error": "You cannot create notifications for another employee."
        }), 403

    notify_employee(
        employee_id,
        message
    )

    return jsonify({
        "success": True
    }), 201


# ==================================================
# FRONTEND ROUTES
# ==================================================

@app.route("/", defaults={"filename": "index.html"})
@app.route("/<path:filename>")
def frontend(filename):

    if not os.path.isdir(FRONTEND_DIR):

        return jsonify({
            "error": "Frontend folder was not found."
        }), 404

    return send_from_directory(
        FRONTEND_DIR,
        filename
    )


# ==================================================
# RUN APPLICATION
# ==================================================

if __name__ == "__main__":

    print("Starting LeaveFlow with MongoDB...")

    print("Frontend:", FRONTEND_DIR)

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
