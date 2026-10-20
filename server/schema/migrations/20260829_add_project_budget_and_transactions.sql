/* ============================================================
   20260829_add_project_budget_and_transactions.sql

   PURPOSE
     Adds the two new tabs of the project form — "Budget" and
     "Transaction" — on top of the module rebuilt by
     20260828_redesign_project_module.sql.

     Budget tab
       - Budget Allotment: a matrix of budget heads (rows) against
         financial years (columns), each intersection holding an
         allotted amount.
       - Transaction Summary: derived, not stored. Budget comes from
         the allotment matrix and Actuals from the ledger below, so
         there is nothing here to persist.

     Transaction tab
       - One or more transaction accounts per project, each with its
         own ledger of credit / debit rows. The running Balance column
         is derived from the rows and is likewise not stored.

   WHY THREE TABLES FOR THE ALLOTMENT
     The matrix is user-built in both directions: a head row with no
     amounts yet, and a year column with no amounts yet, are both real
     editor state the form must reload. Storing only the filled cells
     would silently drop them, so row headers, column headers and cells
     each get their own table.

   SAFETY
     All five tables are new. Nothing existing is altered or dropped.
   ============================================================ */

/* ============================================================
   1. BUDGET ALLOTMENT MATRIX
   ============================================================ */

/* 1.1 COLUMN HEADERS — the financial years the project budgets across.
   Stored even when every cell under them is blank, so an added column
   survives a save. */
CREATE TABLE IF NOT EXISTS project_budget_years (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  financial_year VARCHAR(9) NOT NULL COMMENT 'e.g. 2025-26',
  display_order INT NOT NULL DEFAULT '0' COMMENT 'Left-to-right column order',
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_budget_years (project_id, financial_year),
  KEY idx_project_budget_years_project (project_id, display_order),
  CONSTRAINT fk_project_budget_years_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.2 ROW HEADERS — the budget heads the project allots against, drawn
   from the shared budget catalog. `budget_head_name` snapshots the name
   so a head an admin later retires still reads correctly. */
CREATE TABLE IF NOT EXISTS project_budget_heads (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  budget_head_id INT DEFAULT NULL COMMENT 'FK to budget_heads; NULL keeps a head that was later retired',
  budget_head_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot of the head name at save time',
  display_order INT NOT NULL DEFAULT '0' COMMENT 'Top-to-bottom row order',
  PRIMARY KEY (id),
  /* MySQL treats NULLs as distinct, so this stops the same catalog head
     being added twice without blocking several name-only rows. */
  UNIQUE KEY uq_project_budget_heads (project_id, budget_head_id),
  KEY idx_project_budget_heads_project (project_id, display_order),
  KEY idx_project_budget_heads_head (budget_head_id),
  CONSTRAINT fk_project_budget_heads_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_budget_heads_head
    FOREIGN KEY (budget_head_id) REFERENCES budget_heads (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 1.3 CELLS — the amount at one (head row x year column) intersection.
   `project_id` is carried alongside the two row ids purely so the whole
   matrix loads with one indexed read per project. */
CREATE TABLE IF NOT EXISTS project_budget_allotments (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  budget_head_row_id INT NOT NULL,
  budget_year_id INT NOT NULL,
  amount DECIMAL(15,2) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_budget_allotments (budget_head_row_id, budget_year_id),
  KEY idx_project_budget_allotments_project (project_id),
  KEY idx_project_budget_allotments_year (budget_year_id),
  CONSTRAINT fk_project_budget_allotments_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_budget_allotments_head_row
    FOREIGN KEY (budget_head_row_id) REFERENCES project_budget_heads (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_budget_allotments_year
    FOREIGN KEY (budget_year_id) REFERENCES project_budget_years (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. TRANSACTION LEDGER
   ============================================================ */

/* 2.1 ACCOUNTS — the bank accounts a project's money moves through.
   Each one renders as its own "Transaction Account" block with its own
   ledger. `account_name` snapshots the label so a deactivated account
   still names itself. */
CREATE TABLE IF NOT EXISTS project_transaction_accounts (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  account_option_id INT DEFAULT NULL COMMENT 'FK to account_options; NULL keeps an account that was later removed',
  account_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot of the account label at save time',
  display_order INT NOT NULL DEFAULT '0',
  PRIMARY KEY (id),
  /* One block per account: the same account twice would split a single
     ledger across two tables with two different running balances. */
  UNIQUE KEY uq_project_transaction_accounts (project_id, account_option_id),
  KEY idx_project_transaction_accounts_project (project_id, display_order),
  KEY idx_project_transaction_accounts_option (account_option_id),
  CONSTRAINT fk_project_transaction_accounts_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_transaction_accounts_option
    FOREIGN KEY (account_option_id) REFERENCES account_options (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.2 LEDGER ROWS.

   `head_kind` splits the Transaction Summary into its two sections:
   'expenditure' rows point at the shared budget catalog, 'income' rows
   carry a name from the form's fixed income vocabulary (Deposit,
   Interest, ...) because there is no income catalog to point at.

   Both directions are allowed against either kind — a returned advance
   is a credit against an expenditure head, a reversed deposit a debit
   against an income one — so the summary nets debit against credit
   rather than assuming a direction. */
CREATE TABLE IF NOT EXISTS project_transactions (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  account_id INT NOT NULL,
  financial_year VARCHAR(9) DEFAULT NULL COMMENT 'e.g. 2025-26; derived from the date when left blank',
  transaction_date DATE DEFAULT NULL,
  head_kind ENUM('expenditure', 'income') NOT NULL DEFAULT 'expenditure',
  budget_head_id INT DEFAULT NULL COMMENT 'FK to budget_heads for expenditure rows; always NULL for income rows',
  head_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot for expenditure heads, the value itself for income heads',
  particulars VARCHAR(500) DEFAULT NULL,
  reference_no VARCHAR(150) DEFAULT NULL,
  credit DECIMAL(15,2) DEFAULT NULL COMMENT 'Money in; NULL when the row is a debit',
  debit DECIMAL(15,2) DEFAULT NULL COMMENT 'Money out; NULL when the row is a credit',
  display_order INT NOT NULL DEFAULT '0' COMMENT 'Ledger order; the running Balance is derived from it',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_project_transactions_account (account_id, display_order),
  KEY idx_project_transactions_project (project_id, financial_year),
  KEY idx_project_transactions_head (budget_head_id),
  CONSTRAINT fk_project_transactions_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_transactions_account
    FOREIGN KEY (account_id) REFERENCES project_transaction_accounts (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_transactions_head
    FOREIGN KEY (budget_head_id) REFERENCES budget_heads (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
