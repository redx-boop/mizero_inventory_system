-- ============================================
-- Migration 014: Liability Monetary Fields
-- ============================================
-- Adds amount-based fields for proper financial tracking:
-- replacement_cost = Full cost of the item(s) before percentage
-- liability_amount = What the borrower actually owes (replacement_cost * percentage)
-- amount_paid = Running total of payments made
-- balance = liability_amount - amount_paid (GENERATED)
-- borrower_id = FK reference to users table (if borrower is a system user)
-- ============================================

USE mizero_inventory;

-- Step 1: Add monetary amount columns
ALTER TABLE damage_liabilities
  ADD COLUMN replacement_cost DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Full replacement cost before liability percentage (qty * unit_cost)' AFTER liability_percentage,
  ADD COLUMN liability_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Actual amount borrower owes (replacement_cost * liability_percentage/100)' AFTER replacement_cost,
  ADD COLUMN amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Total monetary amount paid so far' AFTER liability_amount,
  ADD COLUMN balance DECIMAL(14,2) GENERATED ALWAYS AS (liability_amount - amount_paid) STORED
    COMMENT 'Remaining balance (liability_amount - amount_paid)' AFTER amount_paid,
  ADD COLUMN borrower_id INT DEFAULT NULL
    COMMENT 'FK to users table if borrower is a system user' AFTER borrower_name;

-- Step 2: Add FK for borrower_id
ALTER TABLE damage_liabilities
  ADD CONSTRAINT fk_liability_borrower
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 3: Populate replacement_cost and liability_amount from existing data
-- replacement_cost = quantity * unit_cost (full replacement cost)
-- liability_amount = total_amount (this was already computed as qty * unit_cost * percentage)
UPDATE damage_liabilities
SET
  replacement_cost = quantity * unit_cost,
  liability_amount = total_amount;

-- Step 4: Populate amount_paid based on payment history
-- Sum up all payments for each liability
-- Uses JOIN with a derived table to avoid MySQL Error 1093
-- (can't reference the target table in a subquery during UPDATE)
UPDATE damage_liabilities dl
JOIN (
  SELECT dp.liability_id,
         COALESCE(SUM(dp.payment_quantity * (dl_inner.unit_cost * dl_inner.liability_percentage / 100)), 0) as total_paid
  FROM damage_payments dp
  JOIN damage_liabilities dl_inner ON dp.liability_id = dl_inner.id
  GROUP BY dp.liability_id
) AS payment_totals ON dl.id = payment_totals.liability_id
SET dl.amount_paid = payment_totals.total_paid;

-- Step 5: Modify damage_payments.payment_amount to be non-generated (store explicit values)
ALTER TABLE damage_payments
  MODIFY COLUMN payment_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00
    COMMENT 'Actual payment amount';
ALTER TABLE damage_liabilities
  ADD INDEX idx_liability_borrower (borrower_id),
  ADD INDEX idx_liability_amount (liability_amount),
  ADD INDEX idx_liability_balance (balance),
  ADD INDEX idx_liability_paid (amount_paid);
