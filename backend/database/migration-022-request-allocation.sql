-- ============================================
-- Migration 022: Request Allocation Tracking
-- ============================================
-- Adds allocated_quantity field so partial allocations
-- can be tracked, and remaining_quantity is derived.
-- ============================================

USE mizero_inventory;

-- ============================================
-- 1. REQUESTS: Add allocation tracking columns
-- ============================================
ALTER TABLE requests
  ADD COLUMN allocated_quantity INT NOT NULL DEFAULT 0
    COMMENT 'Actual quantity allocated (may be less than requested for partial allocation).' AFTER quantity,
  ADD COLUMN remaining_quantity INT GENERATED ALWAYS AS (quantity - allocated_quantity) STORED
    COMMENT 'Quantity still pending allocation.' AFTER allocated_quantity;
