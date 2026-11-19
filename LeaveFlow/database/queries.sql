-- Queries for the IMS report / viva.      USE leave_management;

-- 1. All requests with employee, department and leave type (3-table JOIN)
SELECT r.id, e.name, d.name AS department, lt.name AS leave_type, r.from_date, r.to_date, r.days, r.status
FROM leave_requests r
JOIN employees e    ON e.id  = r.employee_id
JOIN departments d  ON d.id  = e.department_id
JOIN leave_types lt ON lt.id = r.leave_type_id
ORDER BY r.applied_on DESC;

-- 2. Pending requests (admin dashboard)
SELECT r.id, e.name, lt.name AS leave_type, r.from_date, r.to_date FROM leave_requests r
JOIN employees e ON e.id = r.employee_id JOIN leave_types lt ON lt.id = r.leave_type_id WHERE r.status = 'Pending';

-- 3. Leave balance of every active employee (uses the view)
SELECT * FROM v_leave_balance ORDER BY employee, leave_type;

-- 4. Approved leave days per department (GROUP BY)
SELECT d.name, SUM(r.days) AS total_days FROM leave_requests r
JOIN employees e ON e.id = r.employee_id JOIN departments d ON d.id = e.department_id
WHERE r.status = 'Approved' GROUP BY d.name ORDER BY total_days DESC;

-- 5. Who is on leave today
SELECT e.name, lt.name AS leave_type, r.to_date FROM leave_requests r
JOIN employees e ON e.id = r.employee_id JOIN leave_types lt ON lt.id = r.leave_type_id
WHERE r.status = 'Approved' AND CURDATE() BETWEEN r.from_date AND r.to_date;

-- 6. Employees who never applied for leave (LEFT JOIN + IS NULL)
SELECT e.name FROM employees e LEFT JOIN leave_requests r ON r.employee_id = e.id WHERE r.id IS NULL;

-- 7. Leave days per month (bar chart on the dashboard)
SELECT DATE_FORMAT(from_date,'%Y-%m') AS month, SUM(days) AS days
FROM leave_requests WHERE status IN ('Approved','Pending') GROUP BY month ORDER BY month DESC LIMIT 6;

-- 8. Employees with more than 5 approved days (GROUP BY + HAVING)
SELECT e.name, SUM(r.days) AS days FROM leave_requests r JOIN employees e ON e.id = r.employee_id
WHERE r.status = 'Approved' GROUP BY e.id, e.name HAVING SUM(r.days) > 5;

-- 9. Employee with the most leave (subquery)
SELECT name FROM employees WHERE id = (SELECT employee_id FROM leave_requests WHERE status='Approved' GROUP BY employee_id ORDER BY SUM(days) DESC LIMIT 1);

-- 10. Approve a request (the Approve button runs this; the trigger notifies the employee)
UPDATE leave_requests SET status='Approved', reviewed_by=1, reviewed_on=CURDATE(), remarks='Approved' WHERE id=1 AND status='Pending';

-- 11. Unread notifications of one user
SELECT message, created_at FROM notifications WHERE employee_id = 1 AND is_read = FALSE ORDER BY created_at DESC;
