-- ============================================
-- Migration 005: Unit Price & Inventory Valuation
-- ============================================
-- Adds unit price tracking to the entire inventory system
-- using Weighted Average Cost (AVCO) methodology.
-- ============================================

USE mizero_inventory;

-- ============================================
-- 1. ITEMS TABLE: Add unit_cost and currency
-- ============================================
ALTER TABLE items
  ADD COLUMN unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Current weighted-average unit cost. Auto-calculated on stock-in using AVCO.' AFTER minimum_stock,
  ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'RWF'
    COMMENT 'Currency code (RWF, USD, etc.)' AFTER unit_cost;

-- ============================================
-- 2. STOCK_IN TABLE: Add purchase price columns
-- ============================================
ALTER TABLE stock_in
  ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Unit price paid at time of this stock-in transaction.' AFTER quantity,
  ADD COLUMN total_cost DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
    COMMENT 'Computed total cost for this stock-in line.' AFTER unit_price;

-- ============================================
-- 3. STOCK_OUT TABLE: Add COGS snapshot columns
-- ============================================
ALTER TABLE stock_out
  ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Item unit_cost at the moment this stock-out was created (snapshot for COGS).' AFTER quantity,
  ADD COLUMN total_cost DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost_at_time) STORED
    COMMENT 'Computed COGS for this stock-out line.' AFTER unit_cost_at_time;

-- ============================================
-- 4. STOCK_ADJUSTMENTS TABLE: Add snapshot columns
-- ============================================
ALTER TABLE stock_adjustments
  ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Item unit_cost snapshot at adjustment time.' AFTER quantity,
  ADD COLUMN total_cost DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost_at_time) STORED
    COMMENT 'Computed total cost impact of this adjustment.' AFTER unit_cost_at_time;

-- ============================================
-- 5. BORROWINGS TABLE: Add replacement value columns
-- ============================================
ALTER TABLE borrowings
  ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Item unit_cost at time of borrowing (for replacement if lost/damaged).' AFTER quantity,
  ADD COLUMN total_replacement_value DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost_at_time) STORED
    COMMENT 'Total replacement value of this borrowing.' AFTER unit_cost_at_time;

-- ============================================
-- 6. RETURNS TABLE: Add return value columns
-- ============================================
ALTER TABLE returns
  ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Snapshot from the original borrowing record.' AFTER returned_quantity,
  ADD COLUMN total_value DECIMAL(14,2) GENERATED ALWAYS AS (returned_quantity * unit_cost_at_time) STORED
    COMMENT 'Value of returned items at time of original borrowing.' AFTER unit_cost_at_time;

-- ============================================
-- 7. LEFTOVERS TABLE: Add leftover value columns
-- ============================================
ALTER TABLE leftovers
  ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Snapshot from the original stock-out record.' AFTER returned_quantity,
  ADD COLUMN total_value DECIMAL(14,2) GENERATED ALWAYS AS (returned_quantity * unit_cost_at_time) STORED
    COMMENT 'Value of returned leftover stock at original issue cost.' AFTER unit_cost_at_time;
