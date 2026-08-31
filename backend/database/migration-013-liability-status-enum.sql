-- ============================================
-- Migration 013: Extend liability status ENUM
-- ============================================
-- Adds 'pending' and 'waived' to liability statuses.
-- Also adds liability_percentage column.

USE mizero_inventory;

ALTER TABLE damage_liabilities
  MODIFY COLUMN status ENUM('pending','unpaid','partially_paid','paid','waived') NOT NULL DEFAULT 'pending';

ALTER TABLE damage_liabilities
  ADD COLUMN liability_percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00 AFTER total_amount;
