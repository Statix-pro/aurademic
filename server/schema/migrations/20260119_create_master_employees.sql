-- Migration: Create Master Employees Table
-- Author: System
-- Date: 2026-01-19
-- Description: Comprehensive employee master table - single source of truth for all staff
-- Run Order: 2 of 3 (Requires master_departments to exist)

-- ============================================
-- MASTER EMPLOYEES TABLE
-- ============================================
-- This is THE source of truth for all employee/staff information.
-- Any module needing employee data should reference this table.
-- 
-- Mapped from Excel columns:
-- Title, First Name, Last Name, Designation, Mobile, Gender, DoB, DoJ, DoR, 
-- Status, ERP ID, Email, Dept., Parent Dept., ORCID_ID, WoS Researcher_ID, 
-- Scopus_ID, Google_Scholar_ID

CREATE TABLE IF NOT EXISTS master_employees (
    id INT NOT NULL AUTO_INCREMENT,
    
    -- ========================================
    -- IDENTIFICATION
    -- ========================================
    erp_id VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique ERP/Employee ID from college system',
    
    -- ========================================
    -- BASIC INFORMATION
    -- (From Excel: Title, First Name, Last Name, Gender)
    -- ========================================
    title VARCHAR(20) COMMENT 'Dr., Mr., Mrs., Ms., Prof.',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    gender ENUM('Male', 'Female', 'Other'),
    
    -- ========================================
    -- CONTACT INFORMATION
    -- (From Excel: Mobile, Email)
    -- ========================================
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile VARCHAR(20),
    alternate_email VARCHAR(255) COMMENT 'Personal email',
    
    -- ========================================
    -- PROFESSIONAL DETAILS
    -- (From Excel: Designation, Dept., Parent Dept.)
    -- ========================================
    designation VARCHAR(150) COMMENT 'Professor, Associate Professor, Assistant Professor, etc.',
    department_id INT COMMENT 'FK to master_departments',
    parent_department_id INT COMMENT 'Employee-level parent department from source data',
    employee_type ENUM('Teaching', 'Non-Teaching', 'Contract', 'Visiting', 'Guest Faculty') DEFAULT 'Teaching',
    
    -- ========================================
    -- IMPORTANT DATES
    -- (From Excel: DoB, DoJ, DoR)
    -- ========================================
    dob DATE COMMENT 'Date of Birth',
    doj DATE COMMENT 'Date of Joining',
    dor DATE COMMENT 'Date of Retirement (can be calculated or entered)',
    
    -- ========================================
    -- EMPLOYMENT STATUS
    -- (From Excel: Status)
    -- ========================================
    status ENUM('Active', 'Retired', 'Resigned', 'On Leave', 'Deputation', 'Terminated', 'Deceased') DEFAULT 'Active',
    
    -- ========================================
    -- RESEARCH IDENTIFIERS
    -- (From Excel: ORCID_ID, WoS Researcher_ID, Scopus_ID, Google_Scholar_ID)
    -- ========================================
    orcid_id VARCHAR(50) COMMENT 'ORCID ID (format: 0000-0000-0000-0000)',
    wos_researcher_id VARCHAR(50) COMMENT 'Web of Science Researcher ID',
    scopus_id VARCHAR(50) COMMENT 'Scopus Author ID',
    google_scholar_id VARCHAR(100) COMMENT 'Google Scholar Profile ID',
    research_gate_id VARCHAR(100) COMMENT 'ResearchGate profile',
    
    -- -- ========================================
    -- -- QUALIFICATIONS (Basic - expandable later)
    -- -- ========================================
    -- highest_qualification VARCHAR(100) COMMENT 'Ph.D., M.Tech, MBA, M.E., etc.',
    -- specialization VARCHAR(255) COMMENT 'Area of specialization/expertise',
    
    -- -- ========================================
    -- -- ADDRESS (For future use)
    -- -- ========================================
    -- address_line1 VARCHAR(255),
    -- address_line2 VARCHAR(255),
    -- city VARCHAR(100),
    -- state VARCHAR(100),
    -- pincode VARCHAR(10),
    -- country VARCHAR(100) DEFAULT 'India',
    
    -- -- ========================================
    -- -- EMERGENCY CONTACT (For future use)
    -- -- ========================================
    -- emergency_contact_name VARCHAR(255),
    -- emergency_contact_phone VARCHAR(20),
    -- emergency_contact_relation VARCHAR(50),
    
    -- -- ========================================
    -- -- FINANCIAL DETAILS (For future use - salary/reimbursements)
    -- -- ========================================
    -- bank_name VARCHAR(255),
    -- bank_account_no VARCHAR(50),
    -- bank_ifsc VARCHAR(20),
    -- pan_number VARCHAR(20),
    -- aadhar_number VARCHAR(20) COMMENT 'Masked: Store only last 4 digits or encrypted',
    
    -- -- ========================================
    -- -- PROFILE
    -- -- ========================================
    -- photo_url VARCHAR(512) COMMENT 'Profile photo path',
    -- bio TEXT COMMENT 'Short biography for profile display',
    
    -- ========================================
    -- SYSTEM FIELDS
    -- ========================================
    user_id INT COMMENT 'FK to users table if they have login access',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT 'User who created this record',
    
    PRIMARY KEY (id),
    
    -- ========================================
    -- INDEXES
    -- ========================================
    KEY idx_emp_erp (erp_id),
    KEY idx_emp_email (email),
    KEY idx_emp_dept (department_id),
    KEY idx_emp_parent_dept (parent_department_id),
    KEY idx_emp_status (status),
    KEY idx_emp_designation (designation),
    KEY idx_emp_name (first_name, last_name),
    KEY idx_emp_doj (doj),
    KEY idx_emp_orcid (orcid_id),
    KEY idx_emp_scopus (scopus_id),
    
    -- ========================================
    -- FOREIGN KEYS
    -- ========================================
    CONSTRAINT fk_emp_department FOREIGN KEY (department_id) 
        REFERENCES master_departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_emp_parent_department FOREIGN KEY (parent_department_id)
        REFERENCES master_departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_emp_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
        
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================
-- HELPER TABLES FOR COMPLEX EMPLOYEE DATA
-- ============================================

-- -- Education History (Multiple degrees per employee)
-- CREATE TABLE IF NOT EXISTS employee_education (
--     id INT NOT NULL AUTO_INCREMENT,
--     employee_id INT NOT NULL,
    
--     degree VARCHAR(100) NOT NULL COMMENT 'B.E., M.Tech, Ph.D., MBA, etc.',
--     specialization VARCHAR(255) COMMENT 'Computer Science, Power Systems, etc.',
--     institution VARCHAR(255) NOT NULL COMMENT 'College/University name',
--     university VARCHAR(255) COMMENT 'Affiliating university',
    
--     year_of_passing YEAR,
--     percentage DECIMAL(5,2) COMMENT 'Percentage or CGPA',
--     grade_type ENUM('Percentage', 'CGPA', 'Grade') DEFAULT 'Percentage',
    
--     is_highest BOOLEAN DEFAULT FALSE COMMENT 'Mark as highest qualification',
    
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
--     PRIMARY KEY (id),
--     KEY idx_edu_employee (employee_id),
--     CONSTRAINT fk_edu_employee FOREIGN KEY (employee_id) 
--         REFERENCES master_employees(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -- Work Experience History (Multiple jobs per employee)
-- CREATE TABLE IF NOT EXISTS employee_experience (
--     id INT NOT NULL AUTO_INCREMENT,
--     employee_id INT NOT NULL,
    
--     organization VARCHAR(255) NOT NULL,
--     designation VARCHAR(150),
    
--     from_date DATE,
--     to_date DATE COMMENT 'NULL if current position',
--     is_current BOOLEAN DEFAULT FALSE,
    
--     experience_type ENUM('Teaching', 'Industry', 'Research', 'Administrative') DEFAULT 'Teaching',
--     description TEXT COMMENT 'Role description',
    
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
--     PRIMARY KEY (id),
--     KEY idx_exp_employee (employee_id),
--     KEY idx_exp_dates (from_date, to_date),
--     CONSTRAINT fk_exp_employee FOREIGN KEY (employee_id) 
--         REFERENCES master_employees(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- -- Employee Documents (Certificates, ID proofs, etc.)
-- CREATE TABLE IF NOT EXISTS employee_documents (
--     id INT NOT NULL AUTO_INCREMENT,
--     employee_id INT NOT NULL,
    
--     doc_type ENUM('Resume', 'ID Proof', 'Degree Certificate', 'Experience Letter', 
--                   'Photo', 'PAN Card', 'Aadhar', 'Other') NOT NULL,
--     doc_name VARCHAR(255) COMMENT 'Custom name for the document',
    
--     file_path VARCHAR(512) NOT NULL,
--     original_name VARCHAR(255),
--     mime_type VARCHAR(100),
--     file_size BIGINT,
    
--     is_verified BOOLEAN DEFAULT FALSE,
--     verified_by INT,
--     verified_at TIMESTAMP NULL,
    
--     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
--     PRIMARY KEY (id),
--     KEY idx_doc_employee (employee_id),
--     KEY idx_doc_type (doc_type),
--     CONSTRAINT fk_doc_employee FOREIGN KEY (employee_id) 
--         REFERENCES master_employees(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Full employee details with department name
CREATE OR REPLACE VIEW v_employees AS
SELECT 
    e.id,
    e.erp_id,
    CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name,
    e.first_name,
    e.last_name,
    e.email,
    e.mobile,
    e.designation,
    e.department_id,
    d.name AS department_name,
    d.code AS department_code,
    COALESCE(pd_emp.name, pd_dept.name) AS parent_department_name,
    e.status,
    e.doj,
    e.orcid_id,
    e.scopus_id
FROM master_employees e
LEFT JOIN master_departments d ON e.department_id = d.id
LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run after migration:
-- DESCRIBE master_employees;
-- SELECT COUNT(*) FROM master_employees;
-- SELECT * FROM v_employees LIMIT 5;
