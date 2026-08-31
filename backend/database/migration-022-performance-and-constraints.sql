-- ============================================
-- Migration 022: Database Safety & Performance
-- ============================================
-- Adds:
--   1. CHECK constraints to prevent negative stock/quantities/prices
--   2. Performance indexes on commonly queried columns
--   3. Composite indexes for common query patterns
--
-- NOTE: MySQL 8.0+ supports CHECK constraints. If using MariaDB,
-- CHECK constraints are parsed but may not be enforced.
-- Application-level validation is the primary guard.
-- ============================================

-- 1. ITEMS: Prevent negative quantity and unit_cost
ALTER TABLE items
  ADD CONSTRAINT chk_items_quantity_non_negative
  CHECK (quantity >= 0);

ALTER TABLE items
  ADD CONSTRAINT chk_items_unit_cost_non_negative
  CHECK (unit_cost >= 0);

ALTER TABLE items
  ADD CONSTRAINT chk_items_minimum_stock_non_negative
  CHECK (minimum_stock >= 0);

-- 2. STOCK_IN: Prevent negative quantity and price
ALTER TABLE stock_in
  ADD CONSTRAINT chk_stock_in_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE stock_in
  ADD CONSTRAINT chk_stock_in_unit_price_non_negative
  CHECK (unit_price >= 0);

-- 3. STOCK_OUT: Prevent negative quantity
ALTER TABLE stock_out
  ADD CONSTRAINT chk_stock_out_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE stock_out
  ADD CONSTRAINT chk_stock_out_unit_cost_non_negative
  CHECK (unit_cost_at_time >= 0);

-- 4. ADJUSTMENTS: Prevent negative quantity
ALTER TABLE stock_adjustments
  ADD CONSTRAINT chk_adjustment_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE stock_adjustments
  ADD CONSTRAINT chk_adjustment_unit_cost_non_negative
  CHECK (unit_cost_at_time >= 0);

-- 5. BORROWINGS: Prevent negative quantity and unit cost
ALTER TABLE borrowings
  ADD CONSTRAINT chk_borrowing_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE borrowings
  ADD CONSTRAINT chk_borrowing_unit_cost_non_negative
  CHECK (unit_cost_at_time >= 0);

-- 6. RETURNS: Prevent negative returned quantity
ALTER TABLE returns
  ADD CONSTRAINT chk_return_quantity_positive
  CHECK (returned_quantity > 0);

ALTER TABLE returns
  ADD CONSTRAINT chk_return_unit_cost_non_negative
  CHECK (unit_cost_at_time >= 0);

-- 7. LEFTOVERS: Prevent negative returned quantity
ALTER TABLE leftovers
  ADD CONSTRAINT chk_leftover_quantity_positive
  CHECK (returned_quantity > 0);

ALTER TABLE leftovers
  ADD CONSTRAINT chk_leftover_unit_cost_non_negative
  CHECK (unit_cost_at_time >= 0);

-- 8. BUDGETS: Prevent negative budget
ALTER TABLE budgets
  ADD CONSTRAINT chk_budget_total_positive
  CHECK (total_budget >= 0);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Items: Cover index for listing/sorting by creation date (most common query pattern)
ALTER TABLE items
  ADD INDEX idx_items_dept_type (department_id, item_type, deleted_at),
  ADD INDEX idx_items_created_deleted (created_at DESC, deleted_at);

-- Stock In: Cover indexes for date range queries, department joins
ALTER TABLE stock_in
  ADD INDEX idx_stock_in_item_date (item_id, date DESC),
  ADD INDEX idx_stock_in_created (created_at DESC),
  ADD INDEX idx_stock_in_department (department_id);

-- Stock Out: Cover indexes for date range, department, leftover joins
ALTER TABLE stock_out
  ADD INDEX idx_stock_out_item_date (item_id, date DESC),
  ADD INDEX idx_stock_out_created (created_at DESC);

-- Adjustments: Cover index for monthly reports
ALTER TABLE stock_adjustments
  ADD INDEX idx_adjustment_created (created_at DESC),
  ADD INDEX idx_adjustment_type_date (adjustment_type, created_at DESC);

-- Borrowings: Cover indexes for common filters
ALTER TABLE borrowings
  ADD INDEX idx_borrowing_status_created (status, created_at DESC),
  ADD INDEX idx_borrowing_created (created_at DESC);

-- Requests: Cover indexes for staff viewing own requests
ALTER TABLE requests
  ADD INDEX idx_request_requester_status (requester_id, status),
  ADD INDEX idx_request_created (created_at DESC);

-- Damage Liabilities: Cover indexes for financial reports
ALTER TABLE damage_liabilities
  ADD INDEX idx_liability_type_status (liability_type, status),
  ADD INDEX idx_liability_created (created_at DESC);

-- Activity Logs: Cover index for audit trail queries
ALTER TABLE activity_logs
  ADD INDEX idx_activity_module_action (module, action, created_at DESC);

-- Notifications: Cover index for unread notification queries
ALTER TABLE notifications
  ADD INDEX idx_notif_user_read_created (user_id, is_read, created_at DESC);

-- ============================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================
-- SELECT TABLE_NAME, CONSTRAINT_NAME, CHECK_CLAUSE
-- FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
-- WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'CHECK';

-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
-- FROM INFORMATION_SCHEMA.STATISTICS
-- WHERE TABLE_SCHEMA = DATABASE()
-- ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
