-- ============================================
-- Migration 011: Add liability_type to damage_liabilities
-- ============================================
-- Differentiates between damaged (pay half price) and lost (pay full price) liabilities.

USE mizero_inventory;

ALTER TABLE damage_liabilities
  ADD COLUMN liability_type ENUM('damaged', 'lost') NOT NULL DEFAULT 'damaged'
  AFTER id;
