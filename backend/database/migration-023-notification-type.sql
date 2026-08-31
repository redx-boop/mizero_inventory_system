-- ============================================
-- Migration 023: Add notification_type column
-- ============================================
-- Adds type/category support to notifications for
-- rich UI rendering with icons and colors.
-- ============================================

USE mizero_inventory;

ALTER TABLE notifications
  ADD COLUMN type ENUM('success', 'warning', 'info', 'danger') NOT NULL DEFAULT 'info'
  AFTER message,
  ADD INDEX idx_notif_type (type);
