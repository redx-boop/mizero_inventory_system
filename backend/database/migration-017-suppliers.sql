-- ============================================
-- Migration 017: Supplier Management Module
-- ============================================
-- Adds a suppliers table for tracking vendors
-- and links stock_in records to suppliers.
-- ============================================

USE mizero_inventory;

-- ============================================
-- 1. SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  supplier_type ENUM('vendor', 'donor', 'school_garden', 'consignment', 'other') DEFAULT 'vendor',
  tax_id VARCHAR(50),
  payment_terms VARCHAR(100),
  notes TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_suppliers_name (name),
  INDEX idx_suppliers_type (supplier_type),
  INDEX idx_suppliers_status (status),
  INDEX idx_suppliers_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. ADD supplier_id FK to stock_in table
-- ============================================
ALTER TABLE stock_in
  ADD COLUMN supplier_id INT DEFAULT NULL AFTER supplier_type,
  ADD FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD INDEX idx_stock_in_supplier_id (supplier_id);

-- ============================================
-- 3. DEFAULT SUPPLIERS (Rwandan context)
-- ============================================
INSERT INTO suppliers (name, contact_person, city, supplier_type, status) VALUES
  ('Rwanda Revenue Authority (RRA) Supplies', 'Official Procurement', 'Kigali', 'vendor', 'active'),
  ('Rwanda Biomedical Center (RBC)', 'Logistics Office', 'Kigali', 'donor', 'active'),
  ('Akagera Business Group', 'Jean Baptiste', 'Kigali', 'vendor', 'active'),
  ('BK TecHouse', 'Patrick Mugisha', 'Kigali', 'vendor', 'active'),
  ('Rwanda Social Security Board (RSSB)', 'Procurement Dept', 'Kigali', 'vendor', 'active'),
  ('MINEDEC Supply Chain', 'School Programs', 'Kigali', 'school_garden', 'active'),
  ('Horizon Logistics', 'Alice Uwimana', 'Kigali', 'vendor', 'active');
