-- ============================================
-- Migration 010: Partial Payments for Damage Liabilities
-- ============================================
-- Adds partial payment tracking to damage_liabilities
-- and creates a payment_history table for audit trail
-- ============================================

USE mizero_inventory;

-- Step 1: Add paid_quantity and update status ENUM
ALTER TABLE damage_liabilities
  ADD COLUMN paid_quantity INT NOT NULL DEFAULT 0 COMMENT 'Number of items the borrower has paid for' AFTER quantity,
  ADD COLUMN remaining_quantity INT GENERATED ALWAYS AS (quantity - paid_quantity) STORED COMMENT 'Calculated remaining unpaid items' AFTER paid_quantity,
  MODIFY COLUMN status ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid';

-- Step 2: Create payment_history table
CREATE TABLE IF NOT EXISTS damage_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  liability_id INT NOT NULL,
  payment_quantity INT NOT NULL COMMENT 'Number of items paid for in this transaction',
  unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT 'Snapshot of unit cost at time of payment',
  payment_amount DECIMAL(14,2) GENERATED ALWAYS AS (payment_quantity * unit_cost) STORED COMMENT 'Calculated amount paid',
  notes TEXT DEFAULT NULL,
  created_by INT,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (liability_id) REFERENCES damage_liabilities(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payment_liability (liability_id),
  INDEX idx_payment_date (paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Migrate existing paid records to have correct paid_quantity
-- If a record is 'paid', set paid_quantity = quantity (fully paid)
UPDATE damage_liabilities SET paid_quantity = quantity WHERE status = 'paid' AND paid_quantity = 0;

-- Step 4: Create a payment history record for fully-paid liabilities that don't have one
INSERT INTO damage_payments (liability_id, payment_quantity, unit_cost, notes, created_by, paid_at)
SELECT dl.id, dl.quantity, dl.unit_cost, 'Migrated from legacy paid status', dl.created_by, COALESCE(dl.paid_at, NOW())
FROM damage_liabilities dl
WHERE dl.status = 'paid'
AND NOT EXISTS (SELECT 1 FROM damage_payments dp WHERE dp.liability_id = dl.id);
