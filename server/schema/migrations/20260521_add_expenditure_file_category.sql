ALTER TABLE expenditure_request_bills
  ADD COLUMN file_category ENUM('bill','payment_proof') NOT NULL DEFAULT 'bill' AFTER payee_row_id,
  ADD KEY idx_expenditure_request_bills_category (expenditure_id, file_category);
