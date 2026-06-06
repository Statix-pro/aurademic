CREATE TABLE IF NOT EXISTS finance_carry_forward_allocations (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL,
  source_fiscal_year INT NOT NULL,
  target_fiscal_year INT NOT NULL,
  carry_forward_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  used_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  remarks TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by_user_id INT NULL,
  created_by_email VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_finance_cf_active_target (finance_request_id, target_fiscal_year, status),
  KEY idx_finance_cf_finance (finance_request_id),
  KEY idx_finance_cf_source_fy (source_fiscal_year),
  KEY idx_finance_cf_target_fy (target_fiscal_year),
  CONSTRAINT fk_finance_cf_request
    FOREIGN KEY (finance_request_id) REFERENCES finance_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
