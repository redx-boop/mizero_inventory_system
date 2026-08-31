-- ============================================
-- Migration 007: Budget Management & Financial Reports
-- ============================================
-- Adds department budget tracking and financial reporting capabilities.
-- ============================================

USE mizero_inventory;

-- ============================================
-- BUDGETS TABLE: Track department budgets
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  department_id INT NOT NULL,
  fiscal_year YEAR NOT NULL,
  total_budget DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT 'Total allocated budget for the year',
  description VARCHAR(255) DEFAULT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_budget_dept_year (department_id, fiscal_year),
  INDEX idx_budget_year (fiscal_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
