-- ============================================
-- Migration 002: User-Department Many-to-Many
-- ============================================
-- Allows a single user (manager, stock_manager, etc.)
-- to manage / be assigned to one or more departments.

CREATE TABLE IF NOT EXISTS user_departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  department_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_dept (user_id, department_id),
  INDEX idx_ud_user (user_id),
  INDEX idx_ud_department (department_id)
);

-- Migrate existing single department assignments from users table
INSERT IGNORE INTO user_departments (user_id, department_id)
SELECT id, department_id FROM users WHERE department_id IS NOT NULL;
