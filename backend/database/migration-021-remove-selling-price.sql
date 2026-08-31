-- ============================================
-- Migration 021: Remove Selling Price & Gross Margin
-- ============================================
-- The system is an institutional inventory tracking system
-- that does NOT sell inventory items.
-- This migration removes all sales-related columns:
--   - items.selling_price
--   - stock_out.selling_price_at_time
--   - stock_out.gross_margin (generated, depends on selling_price_at_time)
--   - stock_out.gross_margin_pct (generated, depends on selling_price_at_time)
--
-- SAFETY: Each DROP is guarded by IF EXISTS so this migration
-- is safe to run even if columns were never added.
-- ============================================

USE mizero_inventory;

-- ============================================
-- 1. STOCK_OUT: Drop generated columns first (depend on selling_price_at_time)
-- ============================================
ALTER TABLE stock_out
  DROP COLUMN IF EXISTS gross_margin_pct,
  DROP COLUMN IF EXISTS gross_margin;

-- ============================================
-- 2. STOCK_OUT: Drop selling_price_at_time
-- ============================================
ALTER TABLE stock_out
  DROP COLUMN IF EXISTS selling_price_at_time;

-- ============================================
-- 3. ITEMS: Drop selling_price
-- ============================================
ALTER TABLE items
  DROP COLUMN IF EXISTS selling_price;

-- ============================================
-- 4. Verify cleanup: show any remaining sales columns
-- ============================================
SELECT 'Remaining selling_price columns (should be empty):' as info;
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'mizero_inventory'
  AND COLUMN_NAME IN ('selling_price', 'selling_price_at_time', 'gross_margin', 'gross_margin_pct')
ORDER BY TABLE_NAME, COLUMN_NAME;
