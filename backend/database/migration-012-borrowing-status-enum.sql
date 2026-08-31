-- ============================================
-- Migration 012: Extend borrowing status ENUM
-- ============================================
-- Adds 'damaged' and 'lost' as valid borrowing end states.

USE mizero_inventory;

ALTER TABLE borrowings
  MODIFY COLUMN status ENUM('borrowed','returned','overdue','damaged','lost') NOT NULL DEFAULT 'borrowed';
