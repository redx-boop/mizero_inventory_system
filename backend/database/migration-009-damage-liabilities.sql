-- ============================================
-- Migration 009: Damaged Items Liability Tracking
-- ============================================
-- Tracks items returned as damaged where the borrower
-- must pay replacement cost. Each record is a debt
-- that can be marked as paid.
-- ============================================

USE mizero_inventory;

CREATE TABLE IF NOT EXISTS damage_liabilities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  borrowing_id INT NOT NULL,
  item_id INT NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  item_sku VARCHAR(50) NOT NULL,
  borrower_name VARCHAR(200) NOT NULL,
  borrower_phone VARCHAR(50) DEFAULT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT 'Replacement cost per unit at time of damage',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT 'quantity * unit_cost',
  status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  notes TEXT DEFAULT NULL,
  created_by INT,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE RESTRICT,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_damage_status (status),
  INDEX idx_damage_borrower (borrower_name),
  INDEX idx_damage_borrowing (borrowing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
