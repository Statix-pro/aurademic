CREATE TABLE finance_requests (
  id INT NOT NULL AUTO_INCREMENT,

  /* =========================
     Employee Link (for staff applicants)
  ========================== */
  employee_id INT NULL COMMENT 'FK to master_employees for staff applicants',

  /* =========================
     External Applicant fields (used when employee_id is NULL)
  ========================== */
  applicant_name VARCHAR(255) NULL COMMENT 'For external/non-staff applicants',
  designation VARCHAR(150) NULL,
  department VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  mobile VARCHAR(15) NULL,

  /* =========================
     Request metadata
  ========================== */
  request_date DATE NOT NULL,
  description TEXT,

  /* =========================
     Beneficiary details
  ========================== */
  beneficiary_type ENUM(
    'Individual Faculty',
    'Faculty_Team',
    'Student_Team',
    'Department',
    'Centre',
    'Cell',
    'Club',
    'Institution'
  ) NOT NULL,

  beneficiary_value TEXT,

  /* =========================
     Head of account
  ========================== */
  primary_head VARCHAR(255) NOT NULL,
  event_sub_head VARCHAR(255) DEFAULT NULL,

  /* =========================
     Budget proposal
  ========================== */
  is_budget_proposed ENUM('Yes','No') NOT NULL DEFAULT 'No',
  proposed_amount DECIMAL(15,2) DEFAULT NULL,
  balance_amount DECIMAL(15,2) DEFAULT NULL,

  /* =========================
     Financial nature
  ========================== */
  income_type VARCHAR(100) DEFAULT NULL,
  income_status VARCHAR(255) DEFAULT NULL,
  income_amount_type ENUM('Full','Partial') DEFAULT NULL,
  credit_status VARCHAR(100) DEFAULT NULL,
  debit_status ENUM('credited','reimbursement') DEFAULT NULL,
  partial_amount DECIMAL(15,2) DEFAULT NULL,

  /* =========================
     Enclosures
  ========================== */
  enclosures JSON DEFAULT NULL,

  /* =========================
     Calculated fields
  ========================== */
  total_budget DECIMAL(15,2) NOT NULL DEFAULT 0,

  /* =========================
     Approval snapshot
  ========================== */
  director_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  director_comment TEXT DEFAULT NULL,

  principal_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  principal_comment TEXT DEFAULT NULL,
  principal_priority ENUM('High','Medium','Low') DEFAULT NULL,

  chairman_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  chairman_comment TEXT DEFAULT NULL,

  /* =========================
     Ownership & overall state
  ========================== */
  created_by INT NOT NULL,

  overall_status ENUM('pending','approved','rejected') DEFAULT 'pending',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  /* =========================
     Indexes (performance)
  ========================== */
  KEY idx_created_by (created_by),
  KEY idx_employee_id (employee_id),
  KEY idx_overall_status (overall_status),
  KEY idx_request_date (request_date),
  KEY idx_director_status (director_status),
  KEY idx_principal_status (principal_status),
  KEY idx_chairman_status (chairman_status),

  CONSTRAINT fk_finance_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_finance_employee
    FOREIGN KEY (employee_id)
    REFERENCES master_employees(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE finance_budget_breakup (
  id INT NOT NULL AUTO_INCREMENT,

  finance_id INT NOT NULL,

  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_finance_id (finance_id),

  CONSTRAINT fk_budget_finance
    FOREIGN KEY (finance_id)
    REFERENCES finance_requests(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE finance_status_updates (
  id INT NOT NULL AUTO_INCREMENT,

  finance_id INT NOT NULL,
  user_id INT NOT NULL,

  role ENUM('director','principal','chairman','applicant') NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL,

  comment TEXT DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_finance_id (finance_id),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),

  CONSTRAINT fk_status_finance
    FOREIGN KEY (finance_id)
    REFERENCES finance_requests(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_status_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================
-- VIEW: Finance Requests with Applicant Data
-- ============================================
-- Hybrid support: Uses master_employees for staff, falls back to direct fields for external

CREATE OR REPLACE VIEW v_finance_requests AS
SELECT 
    fr.id,
    fr.employee_id,
    fr.created_by,
    
    -- Applicant data: COALESCE for hybrid (staff from master_employees, external from direct fields)
    COALESCE(
        CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')),
        fr.applicant_name
    ) AS applicant_name,
    COALESCE(e.designation, fr.designation) AS designation,
    COALESCE(d.name, fr.department) AS department,
    COALESCE(e.email, fr.email) AS email,
    COALESCE(e.mobile, fr.mobile) AS mobile,
    e.erp_id,
    
    -- Is external applicant flag
    CASE WHEN fr.employee_id IS NULL THEN 1 ELSE 0 END AS is_external,
    
    -- Request details
    fr.request_date,
    fr.description,
    fr.beneficiary_type,
    fr.beneficiary_value,
    fr.primary_head,
    fr.event_sub_head,
    
    -- Budget
    fr.is_budget_proposed,
    fr.proposed_amount,
    fr.balance_amount,
    fr.total_budget,
    
    -- Financial nature
    fr.income_type,
    fr.income_status,
    fr.income_amount_type,
    fr.credit_status,
    fr.debit_status,
    fr.partial_amount,
    
    -- Enclosures
    fr.enclosures,
    
    -- Approval status
    fr.director_status,
    fr.director_comment,
    fr.principal_status,
    fr.principal_comment,
    fr.principal_priority,
    fr.chairman_status,
    fr.chairman_comment,
    fr.overall_status,
    
    -- Timestamps
    fr.created_at,
    fr.updated_at
    
FROM finance_requests fr
LEFT JOIN master_employees e ON fr.employee_id = e.id
LEFT JOIN master_departments d ON e.department_id = d.id;
