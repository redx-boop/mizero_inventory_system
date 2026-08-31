-- ============================================
-- Mizero Inventory Hub - Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS mizero_inventory;
USE mizero_inventory;

-- ============================================
-- ROLES TABLE
-- ============================================
CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  manager_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  department_id INT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role_id),
  INDEX idx_users_department (department_id),
  INDEX idx_users_status (status)
);

-- Add manager FK to departments
ALTER TABLE departments
  ADD FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- ITEMS TABLE (Inventory)
-- ============================================
CREATE TABLE items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
  quantity INT NOT NULL DEFAULT 0,
  minimum_stock INT NOT NULL DEFAULT 0,
  item_type ENUM('consumable', 'non-consumable') NOT NULL DEFAULT 'consumable',
  department_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_items_sku (sku),
  INDEX idx_items_name (name),
  INDEX idx_items_category (category),
  INDEX idx_items_department (department_id),
  INDEX idx_items_type (item_type),
  INDEX idx_items_low_stock (quantity, minimum_stock)
);

-- ============================================
-- STOCK IN TABLE
-- ============================================
CREATE TABLE stock_in (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  supplier VARCHAR(200),
  reference_number VARCHAR(100),
  notes TEXT,
  date DATE NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_stock_in_item (item_id),
  INDEX idx_stock_in_date (date),
  INDEX idx_stock_in_supplier (supplier)
);

-- ============================================
-- STOCK OUT TABLE
-- ============================================
CREATE TABLE stock_out (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  recipient VARCHAR(200) NOT NULL,
  department VARCHAR(100),
  reason TEXT,
  date DATE NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_stock_out_item (item_id),
  INDEX idx_stock_out_date (date),
  INDEX idx_stock_out_recipient (recipient)
);

-- ============================================
-- STOCK ADJUSTMENTS TABLE
-- ============================================
CREATE TABLE stock_adjustments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  adjustment_type ENUM('increase', 'decrease') NOT NULL,
  quantity INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_adjustment_item (item_id),
  INDEX idx_adjustment_type (adjustment_type),
  INDEX idx_adjustment_reason (reason)
);

-- ============================================
-- BORROWINGS TABLE
-- ============================================
CREATE TABLE borrowings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  borrower_name VARCHAR(200) NOT NULL,
  borrower_phone VARCHAR(50),
  quantity INT NOT NULL,
  borrow_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('borrowed', 'returned', 'overdue') DEFAULT 'borrowed',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_borrowing_item (item_id),
  INDEX idx_borrowing_status (status),
  INDEX idx_borrowing_due (due_date),
  INDEX idx_borrowing_borrower (borrower_name)
);

-- ============================================
-- RETURNS TABLE
-- ============================================
CREATE TABLE returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  borrowing_id INT NOT NULL,
  returned_quantity INT NOT NULL,
  item_condition ENUM('good', 'damaged', 'lost') DEFAULT 'good',
  notes TEXT,
  return_date DATE NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrowing_id) REFERENCES borrowings(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_return_borrowing (borrowing_id),
  INDEX idx_return_condition (item_condition),
  INDEX idx_return_date (return_date)
);

-- ============================================
-- STOCK REQUESTS TABLE
-- ============================================
CREATE TABLE requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  requester_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  justification TEXT,
  status ENUM('pending', 'approved', 'rejected', 'allocated') DEFAULT 'pending',
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_request_requester (requester_id),
  INDEX idx_request_item (item_id),
  INDEX idx_request_status (status),
  INDEX idx_request_created (created_at)
);

-- ============================================
-- LEFTOVERS TABLE
-- ============================================
CREATE TABLE leftovers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_out_id INT NOT NULL,
  returned_quantity INT NOT NULL,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stock_out_id) REFERENCES stock_out(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_leftover_stock_out (stock_out_id)
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  module VARCHAR(50),
  reference_id INT,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (is_read, user_id),
  INDEX idx_notif_created (created_at)
);

-- ============================================
-- ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activity_user (user_id),
  INDEX idx_activity_module (module),
  INDEX idx_activity_action (action),
  INDEX idx_activity_created (created_at)
);

-- ============================================
-- INSERT DEFAULT ROLES
-- ============================================
INSERT INTO roles (name, description) VALUES
('super_admin', 'Full system access'),('admin', 'Manage users, departments, and inventory'),
  ('stock_manager', 'Full inventory operations - stock in/out, adjustments, borrowing, requests, activity logs'),
('staff', 'Create requests, view assigned inventory and notifications');
