LEAVEFLOW - LEAVE MANAGEMENT SYSTEM   (IMS project, version 4)

HOW TO RUN
1. Extract the zip.
2. Double-click index.html  (Chrome or Edge). That is all - no installation.

PAGES
index.html      landing page
register.html   sign up (Employee, or Administrator with code ADMIN2026)
login.html      log in (choose Employee / Administrator)
forgot.html     reset password (email + employee ID)
app.html        the dashboard (opens after login)

DEMO ACCOUNTS (or register your own with any email)
Employee        employee@demo.com / user123
Administrator   admin@demo.com    / admin123

SEE THE LIVE UPDATES
Open app.html as an employee in one browser window and log in as admin in another window
of the SAME browser. Apply for leave in the employee window -> the admin's bell, counters,
charts and pending list update by themselves. Approve it -> the employee gets a notification.

FEATURES
Everyone:   register, login, dark/light mode, notifications bell, profile + change password,
            leave calendar, hover effects, mobile friendly
Employee:   dashboard with balance rings, apply for leave, cancel pending, balance page
Admin:      dashboard with charts, approve/reject with remarks, export CSV,
            CRUD for Employees / Departments / Leave types, balances of all employees
Rules:      overlap check, balance check, unique email/ID, delete blocked by foreign keys

FILES
js/store.js        DATA LAYER - 5 tables (+ login/register logic). Only file that touches data.
js/common.js       shared helpers (icons, toast, theme)
js/auth.js         login / register / forgot pages
js/app.js          dashboard application
css/style.css      all styling
database/schema.sql   MySQL tables, keys, constraints, 3 triggers, 1 view
database/seed.sql     sample data
database/queries.sql  11 report queries (JOIN, GROUP BY, HAVING, subquery)

NEXT STAGE - DATABASE
departments 1-N employees   |   employees 1-N leave_requests   |   leave_types 1-N leave_requests
employees 1-N notifications |   leave_requests.reviewed_by -> employees.id
1) run schema.sql + seed.sql in MySQL 8.0.16+
2) build Flask app.py with the same operations as store.js
3) rewrite js/store.js to fetch() those routes; move login to the server with hashed passwords
Note: right now data and sessions live in the browser (localStorage). Passwords use a demo hash only.
