CREATE TABLE finance_requests (
  id INT NOT NULL AUTO_INCREMENT,

  /* =========================
     Applicant details
  ========================== */
  applicant_name VARCHAR(255) NOT NULL,
  designation VARCHAR(150) DEFAULT NULL,
  department VARCHAR(255) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  mobile VARCHAR(15) DEFAULT NULL,

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
  KEY idx_overall_status (overall_status),
  KEY idx_request_date (request_date),
  KEY idx_director_status (director_status),
  KEY idx_principal_status (principal_status),
  KEY idx_chairman_status (chairman_status),

  CONSTRAINT fk_finance_user
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE CASCADE
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
