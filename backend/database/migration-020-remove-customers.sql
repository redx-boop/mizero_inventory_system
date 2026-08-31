-- ============================================
-- Migration 020: Remove Customers Module
-- ============================================
-- Drops the customers table that was removed
-- from the system as it's no longer needed.
-- ============================================

USE mizero_inventory;

-- Drop the FULLTEXT index if it exists (from migration 019)
ALTER TABLE customers
  DROP INDEX IF EXISTS ft_customers_search;

-- Drop the customers table
DROP TABLE IF EXISTS customers;
