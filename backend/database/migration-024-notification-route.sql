-- ============================================
-- Migration 024: Add route, read_at, and actor for notification redirects
-- ============================================
-- Enables clicking a notification to navigate to the relevant page.
-- Also tracks read_at timestamp and actor name.
-- ============================================

USE mizero_inventory;

ALTER TABLE notifications
  ADD COLUMN route VARCHAR(100) DEFAULT NULL AFTER reference_id,
  ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL AFTER is_read,
  ADD COLUMN actor VARCHAR(100) DEFAULT NULL AFTER reference_id,
  ADD INDEX idx_notif_route (route);
