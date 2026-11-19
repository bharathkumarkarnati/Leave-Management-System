-- Sample data. Run AFTER schema.sql:  mysql -u root -p leave_management < database/seed.sql
-- password_hash values are placeholders: the Flask stage will create real hashes
-- (werkzeug generate_password_hash). Demo logins: admin123 / user123.
USE leave_management;

INSERT INTO departments (name) VALUES ('Information Technology'),('Human Resources'),('Finance'),('Administration');
INSERT INTO leave_types (name, days_per_year) VALUES ('Annual Leave',20),('Sick Leave',10),('Personal Leave',5),('Unpaid Leave',30);

INSERT INTO employees (emp_code,name,email,password_hash,role,department_id,phone,designation,join_date,status) VALUES
('EMP000','Alex Morgan', 'admin@demo.com',        'REPLACE_WITH_HASH','Administrator',4,'9876500000','HR Manager',        '2020-01-10','Active'),
('EMP001','Jordan Davis','employee@demo.com',     'REPLACE_WITH_HASH','Employee',1,'9876500001','Software Engineer','2022-03-15','Active'),
('EMP002','Mia Wilson',  'mia.wilson@demo.com',   'REPLACE_WITH_HASH','Employee',2,'9876500002','HR Executive',     '2021-07-01','Active'),
('EMP003','Ryan Thomas', 'ryan.thomas@demo.com',  'REPLACE_WITH_HASH','Employee',3,'9876500003','Accountant',       '2023-01-20','Active'),
('EMP004','Emily Clark', 'emily.clark@demo.com',  'REPLACE_WITH_HASH','Employee',1,'9876500004','QA Engineer',      '2023-09-05','Inactive'),
('EMP005','Sara Khan',   'sara.khan@demo.com',    'REPLACE_WITH_HASH','Employee',1,'9876500005','UI Designer',      '2022-11-12','Active'),
('EMP006','Arjun Rao',   'arjun.rao@demo.com',    'REPLACE_WITH_HASH','Employee',3,'9876500006','Finance Analyst',  '2021-04-08','Active'),
('EMP007','Priya Nair',  'priya.nair@demo.com',   'REPLACE_WITH_HASH','Employee',2,'9876500007','Recruiter',        '2024-02-19','Active');

-- Dates are relative to today so the dashboard always has data. days is set by the trigger.
INSERT INTO leave_requests (employee_id,leave_type_id,from_date,to_date,days,reason,status,applied_on,reviewed_by,reviewed_on,remarks) VALUES
(3,1,CURDATE()-INTERVAL 150 DAY,CURDATE()-INTERVAL 148 DAY,0,'Short break',        'Approved',CURDATE()-INTERVAL 160 DAY,1,CURDATE()-INTERVAL 159 DAY,'Approved'),
(7,1,CURDATE()-INTERVAL 120 DAY,CURDATE()-INTERVAL 117 DAY,0,'Family trip',        'Approved',CURDATE()-INTERVAL 140 DAY,1,CURDATE()-INTERVAL 139 DAY,'Approved'),
(6,3,CURDATE()-INTERVAL 100 DAY,CURDATE()-INTERVAL 100 DAY,0,'Bank work',          'Approved',CURDATE()-INTERVAL 105 DAY,1,CURDATE()-INTERVAL 104 DAY,'Approved'),
(2,2,CURDATE()-INTERVAL 78 DAY, CURDATE()-INTERVAL 78 DAY, 0,'Medical appointment','Rejected',CURDATE()-INTERVAL 80 DAY, 1,CURDATE()-INTERVAL 79 DAY, 'Please attach a medical note'),
(8,1,CURDATE()-INTERVAL 60 DAY, CURDATE()-INTERVAL 56 DAY, 0,'Home town visit',   'Approved',CURDATE()-INTERVAL 75 DAY, 1,CURDATE()-INTERVAL 74 DAY, 'Approved'),
(4,1,CURDATE()-INTERVAL 45 DAY, CURDATE()-INTERVAL 43 DAY, 0,'Vacation',           'Approved',CURDATE()-INTERVAL 60 DAY, 1,CURDATE()-INTERVAL 59 DAY, 'Enjoy your trip'),
(2,3,CURDATE()-INTERVAL 38 DAY, CURDATE()-INTERVAL 38 DAY, 0,'Personal work',      'Approved',CURDATE()-INTERVAL 45 DAY, 1,CURDATE()-INTERVAL 44 DAY, 'Approved'),
(7,2,CURDATE()-INTERVAL 20 DAY, CURDATE()-INTERVAL 19 DAY, 0,'Viral infection',    'Approved',CURDATE()-INTERVAL 21 DAY, 1,CURDATE()-INTERVAL 20 DAY, 'Approved'),
(3,2,CURDATE(),                 CURDATE()+INTERVAL 1 DAY,  0,'Fever and rest',     'Approved',CURDATE()-INTERVAL 1 DAY,  1,CURDATE(),                 'Get well soon');

-- Pending requests: the AFTER INSERT trigger creates admin notifications for these
INSERT INTO leave_requests (employee_id,leave_type_id,from_date,to_date,days,reason,status,applied_on) VALUES
(2,1,CURDATE()+INTERVAL 5 DAY, CURDATE()+INTERVAL 6 DAY, 0,'Family function','Pending',CURDATE()-INTERVAL 2 DAY),
(6,1,CURDATE()+INTERVAL 12 DAY,CURDATE()+INTERVAL 16 DAY,0,'Sister''s wedding','Pending',CURDATE()-INTERVAL 1 DAY),
(4,2,CURDATE()+INTERVAL 10 DAY,CURDATE()+INTERVAL 10 DAY,0,'Dental checkup','Pending',CURDATE());
