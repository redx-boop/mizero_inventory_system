require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigrations() {
  const dbName = process.env.DB_NAME || 'mizero_inventory';
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true
  });

  try {
    // ──────────────────────────────────────────
    // Migration 018: Customers Table
    // ──────────────────────────────────────────
    console.log('\n--- Running Migration 018: Customers Table ---');

    const [customerTable] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers'",
      [dbName]
    );

    if (customerTable.length === 0) {
      await pool.query(`
        CREATE TABLE customers (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(200) NOT NULL,
          contact_person VARCHAR(100),
          email VARCHAR(100),
          phone VARCHAR(50),
          address TEXT,
          city VARCHAR(100),
          customer_type ENUM('individual', 'organization', 'school', 'government', 'ngo', 'other') DEFAULT 'individual',
          tax_id VARCHAR(50),
          notes TEXT,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP NULL DEFAULT NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_customers_name (name),
          INDEX idx_customers_type (customer_type),
          INDEX idx_customers_status (status),
          INDEX idx_customers_deleted (deleted_at),
          INDEX idx_customers_email (email),
          INDEX idx_customers_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ customers table created');
    } else {
      console.log('  ✅ customers table already exists - skipping');
    }

    // ──────────────────────────────────────────
    // Migration 019: Full-Text Search Indexes
    // ──────────────────────────────────────────
    console.log('\n--- Running Migration 019: Full-Text Search Indexes ---');

    // 1. Items FULLTEXT index
    const [itemsFtIndex] = await pool.query(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND INDEX_NAME = 'ft_items_search'",
      [dbName]
    );
    if (itemsFtIndex.length === 0) {
      await pool.query('ALTER TABLE items ADD FULLTEXT INDEX ft_items_search (name, sku, category, description)');
      console.log('  ✅ FULLTEXT index ft_items_search added to items');
    } else {
      console.log('  ✅ FULLTEXT index ft_items_search already exists on items - skipping');
    }

    // 2. Suppliers FULLTEXT index
    const [suppliersFtIndex] = await pool.query(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'suppliers' AND INDEX_NAME = 'ft_suppliers_search'",
      [dbName]
    );
    if (suppliersFtIndex.length === 0) {
      await pool.query('ALTER TABLE suppliers ADD FULLTEXT INDEX ft_suppliers_search (name, contact_person, email, city)');
      console.log('  ✅ FULLTEXT index ft_suppliers_search added to suppliers');
    } else {
      console.log('  ✅ FULLTEXT index ft_suppliers_search already exists on suppliers - skipping');
    }

    // 3. Customers FULLTEXT index (only if customers table exists)
    if (customerTable.length > 0 || true) {
      const [customersFtIndex] = await pool.query(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND INDEX_NAME = 'ft_customers_search'",
        [dbName]
      );
      if (customersFtIndex.length === 0) {
        await pool.query('ALTER TABLE customers ADD FULLTEXT INDEX ft_customers_search (name, contact_person, email, city)');
        console.log('  ✅ FULLTEXT index ft_customers_search added to customers');
      } else {
        console.log('  ✅ FULLTEXT index ft_customers_search already exists on customers - skipping');
      }
    }

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigrations();
