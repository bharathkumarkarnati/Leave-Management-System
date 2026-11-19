-- ============================================================
-- LeaveFlow - Leave Management System   |   MySQL 8.0.16+ schema
-- Run:  mysql -u root -p < database/schema.sql
-- Tables match js/store.js exactly (same names, same columns).
-- ============================================================
DROP DATABASE IF EXISTS leave_management;
CREATE DATABASE leave_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE leave_management;

CREATE TABLE departments (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE leave_types (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(50) NOT NULL UNIQUE,
  days_per_year  INT NOT NULL CHECK (days_per_year > 0)
) ENGINE=InnoDB;

CREATE TABLE employees (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  emp_code       VARCHAR(20)  NOT NULL UNIQUE,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,                 -- never store plain passwords
  role           ENUM('Employee','Administrator') NOT NULL DEFAULT 'Employee',
  department_id  INT NOT NULL,
  phone          VARCHAR(20)  NOT NULL DEFAULT '',
  designation    VARCHAR(80)  NOT NULL DEFAULT '',
  join_date      DATE NOT NULL,
  status         ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_emp_dept FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE leave_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  employee_id    INT NOT NULL,
  leave_type_id  INT NOT NULL,
  from_date      DATE NOT NULL,
  to_date        DATE NOT NULL,
  days           INT  NOT NULL,
  reason         VARCHAR(255) NOT NULL,
  status         ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  applied_on     DATE NOT NULL DEFAULT (CURRENT_DATE),
  reviewed_by    INT  NULL,
  reviewed_on    DATE NULL,
  remarks        VARCHAR(255) NOT NULL DEFAULT '',
  CONSTRAINT chk_dates CHECK (to_date >= from_date),
  CONSTRAINT fk_req_emp  FOREIGN KEY (employee_id)   REFERENCES employees(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_req_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  CONSTRAINT fk_req_rev  FOREIGN KEY (reviewed_by)   REFERENCES employees(id)   ON DELETE SET NULL,
  INDEX idx_req_emp_status (employee_id, status),
  INDEX idx_req_dates (from_date, to_date)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  employee_id  INT NOT NULL,
  message      VARCHAR(255) NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_note_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_note_emp_read (employee_id, is_read)
) ENGINE=InnoDB;

-- Rule: calculate days automatically and block overlapping leave
DELIMITER //
CREATE TRIGGER trg_leave_before_insert BEFORE INSERT ON leave_requests
FOR EACH ROW
BEGIN
  SET NEW.days = DATEDIFF(NEW.to_date, NEW.from_date) + 1;
  IF NEW.status IN ('Pending','Approved') AND EXISTS (
       SELECT 1 FROM leave_requests
       WHERE employee_id = NEW.employee_id AND status IN ('Pending','Approved')
         AND from_date <= NEW.to_date AND to_date >= NEW.from_date) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Leave dates overlap with an existing request';
  END IF;
END//

-- Rule: notify every active administrator when a new request is submitted
CREATE TRIGGER trg_leave_after_insert AFTER INSERT ON leave_requests
FOR EACH ROW
BEGIN
  IF NEW.status = 'Pending' THEN
    INSERT INTO notifications (employee_id, message)
    SELECT a.id, CONCAT((SELECT name FROM employees WHERE id = NEW.employee_id), ' applied for ',
                        (SELECT name FROM leave_types WHERE id = NEW.leave_type_id))
    FROM employees a WHERE a.role = 'Administrator' AND a.status = 'Active';
  END IF;
END//

-- Rule: notify the employee when the decision changes
CREATE TRIGGER trg_leave_after_update AFTER UPDATE ON leave_requests
FOR EACH ROW
BEGIN
  IF OLD.status = 'Pending' AND NEW.status IN ('Approved','Rejected') THEN
    INSERT INTO notifications (employee_id, message)
    VALUES (NEW.employee_id, CONCAT('Your leave request was ', LOWER(NEW.status)));
  END IF;
END//
DELIMITER ;

-- View: yearly balance per active employee and leave type
CREATE VIEW v_leave_balance AS
SELECT e.id AS employee_id, e.name AS employee, lt.id AS leave_type_id, lt.name AS leave_type,
       lt.days_per_year AS allowed,
       COALESCE(SUM(CASE WHEN r.status = 'Approved' THEN r.days END), 0) AS used,
       COALESCE(SUM(CASE WHEN r.status = 'Pending'  THEN r.days END), 0) AS pending,
       lt.days_per_year - COALESCE(SUM(CASE WHEN r.status IN ('Approved','Pending') THEN r.days END), 0) AS remaining
FROM employees e
CROSS JOIN leave_types lt
LEFT JOIN leave_requests r ON r.employee_id = e.id AND r.leave_type_id = lt.id AND YEAR(r.from_date) = YEAR(CURDATE())
WHERE e.status = 'Active'
GROUP BY e.id, e.name, lt.id, lt.name, lt.days_per_year;
