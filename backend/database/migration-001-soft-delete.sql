-- ============================================
-- Migration 001: Soft-delete for items
-- ============================================
-- This migration adds a `deleted_at` column to the items table
-- so that deleted items are hidden from listings but their
-- historical data remains accessible for reports and JOINs.
-- ============================================

USE mizero_inventory;

ALTER TABLE items
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at,
  ADD INDEX idx_items_deleted (deleted_at);
