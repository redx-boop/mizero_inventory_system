-- ============================================
-- Migration 008: Add image_url to items table
-- ============================================

ALTER TABLE items
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER created_by,
  ADD INDEX idx_items_image (image_url);
