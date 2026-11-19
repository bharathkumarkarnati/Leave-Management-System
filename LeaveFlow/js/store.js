
function apiRequest(path, method, data) {
    var xhr = new XMLHttpRequest();

    xhr.open(method, "/api" + path, false);
    xhr.setRequestHeader("Content-Type", "application/json");

    try {
        xhr.send(data === undefined ? null : JSON.stringify(data));

        var result = xhr.responseText
            ? JSON.parse(xhr.responseText)
            : {};

        if (xhr.status < 200 || xhr.status >= 300) {
            alert(result.error || "Something went wrong.");
            return null;
        }

        return result;
    } catch (error) {
        alert("Cannot connect to Flask. Please start the backend.");
        return null;
    }
}


// Temporary cache to avoid repeated database requests.
var dataCache = {};
var sessionCache = null;
var sessionCacheTime = 0;

var CACHE_TIME = 3000;

var Store = {
    reload: function () {
        dataCache = {};
        return true;
    },

    all: function (table) {
        var cached = dataCache[table];

        if (cached && Date.now() - cached.time < CACHE_TIME) {
            return cached.data;
        }

        var result = apiRequest("/data/" + table, "GET");

        if (Array.isArray(result)) {
            dataCache[table] = {
                data: result,
                time: Date.now()
            };

            return result;
        }

        return [];
    },

    find: function (table, id) {
        var rows = this.all(table);

        return rows.find(function (row) {
            return Number(row.id) === Number(id);
        }) || null;
    },

    where: function (table, callback) {
        return this.all(table).filter(callback);
    },

    insert: function (table, row) {
        var result = apiRequest("/data/" + table, "POST", row);

        if (result) {
            delete dataCache[table];
        }

        return result;
    },

    update: function (table, id, changes) {
        var result = apiRequest(
            "/data/" + table + "/" + id,
            "PUT",
            changes
        );

        if (result) {
            delete dataCache[table];
        }

        return result;
    },

    remove: function (table, id) {
        var result = apiRequest(
            "/data/" + table + "/" + id,
            "DELETE"
        );

        if (result) {
            delete dataCache[table];
        }

        return result;
    },

    notify: function (employeeId, message) {
        var result = apiRequest("/notify", "POST", {
            employee_id: employeeId,
            message: message
        });

        if (result) {
            delete dataCache.notifications;
        }

        return result;
    },

    reset: function () {
        alert("Database reset is disabled to protect your MySQL data.");
        return false;
    }
};


var Auth = {
    current: function () {
        if (
            sessionCache !== null &&
            Date.now() - sessionCacheTime < CACHE_TIME
        ) {
            return sessionCache;
        }

        var result = apiRequest("/me", "GET");

        sessionCache = result || null;
        sessionCacheTime = Date.now();

        return sessionCache;
    },

    login: function (email, password, role) {
        var result = apiRequest("/login", "POST", {
            email: email,
            password: password,
            role: role
        });

        if (result && result.employee) {
            sessionCache = result.employee;
            sessionCacheTime = Date.now();
            dataCache = {};

            return result.employee;
        }

        return null;
    },

    logout: function () {
        sessionCache = null;
        dataCache = {};

        apiRequest("/logout", "POST", {});
        location.href = "login.html";
    },

    register: function (data) {
        var result = apiRequest("/register", "POST", {
            name: data.name,
            email: data.email,
            password: data.password,
            role: data.role || "Employee",
            department_id: data.department_id || data.departmentId,
            phone: data.phone || "",
            designation: data.designation || "",
            admin_code: data.admin_code || data.adminCode || ""
        });

        if (result && result.employee) {
            sessionCache = result.employee;
            sessionCacheTime = Date.now();
            dataCache = {};

            return result.employee;
        }

        return null;
    },

    resetPassword: function (email, empCode, newPassword) {
        var result = apiRequest("/reset-password", "POST", {
            email: email,
            emp_code: empCode,
            new_password: newPassword
        });

        return !!result;
    },

    changePassword: function (currentPassword, newPassword) {
        return apiRequest("/change-password", "POST", {
            current_password: currentPassword,
            new_password: newPassword
        });
    }
};
