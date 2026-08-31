-- ============================================
-- Migration 004: Super Admin Protection
-- ============================================
-- Adds audit logging table for security events
-- ============================================

-- Table to track all Super Admin modification attempts
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NOT NULL,
  action VARCHAR(100) NOT NULL COMMENT 'Type of attempted action',
  target_user_id INT DEFAULT NULL,
  details TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  status ENUM('blocked', 'allowed') NOT NULL DEFAULT 'blocked',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
