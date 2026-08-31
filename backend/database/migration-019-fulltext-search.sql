-- ============================================
-- Migration 019: Full-Text Search Indexes
-- ============================================
-- Adds FULLTEXT indexes to enable fast,
-- relevance-ranked search across key tables.
-- ============================================

USE mizero_inventory;

-- ============================================
-- 1. ITEMS TABLE — Full-text search across
--    name, sku, category, and description
-- ============================================
ALTER TABLE items
  ADD FULLTEXT INDEX ft_items_search (name, sku, category, description);

-- ============================================
-- 2. SUPPLIERS TABLE — Full-text search
-- ============================================
ALTER TABLE suppliers
  ADD FULLTEXT INDEX ft_suppliers_search (name, contact_person, email, city);
