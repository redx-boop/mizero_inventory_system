require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigrations() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mizero_inventory',
    multipleStatements: true
  });

  try {
    console.log('Running migration 001: Add deleted_at to items table...');

    // Check if column already exists
    const [columns] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'deleted_at'",
      [process.env.DB_NAME || 'mizero_inventory']
    );

    if (columns.length === 0) {
      await pool.query(
        "ALTER TABLE items ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at, ADD INDEX idx_items_deleted (deleted_at)"
      );
      console.log('  ✅ Column deleted_at added to items table');
    } else {
      console.log('  ✅ Column deleted_at already exists - skipping');
    }

    console.log('\n--- Running migration 002: User-Department pivot table ---');

    const [userDeptTable] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'user_departments'",
      [process.env.DB_NAME || 'mizero_inventory']
    );

    if (userDeptTable.length === 0) {
      await pool.query(`
        CREATE TABLE user_departments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          department_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          UNIQUE KEY uk_user_dept (user_id, department_id),
          INDEX idx_ud_user (user_id),
          INDEX idx_ud_department (department_id)
        )
      `);

      // Migrate existing single department assignments
      await pool.query(
        `INSERT IGNORE INTO user_departments (user_id, department_id)
         SELECT id, department_id FROM users WHERE department_id IS NOT NULL`
      );

      console.log('  ✅ user_departments table created and existing data migrated');
    } else {
      console.log('  ✅ user_departments table already exists - skipping');
    }

    console.log('\n--- Running migration 003: Add supplier_type to stock_in ---');

    const [supplierTypeCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stock_in' AND COLUMN_NAME = 'supplier_type'",
      [process.env.DB_NAME || 'mizero_inventory']
    );

    if (supplierTypeCol.length === 0) {
      await pool.query(`
        ALTER TABLE stock_in
        ADD COLUMN supplier_type ENUM('Donated', 'School Garden', 'Borrowed', 'Supplied', 'Consignment') DEFAULT NULL AFTER supplier,
        ADD COLUMN department_id INT DEFAULT NULL AFTER notes,
        ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      `);
      console.log('  ✅ supplier_type and department_id columns added to stock_in');
    } else {
      console.log('  ✅ Columns already exist - skipping');
    }

    console.log('\n--- Running migration 004: Super Admin Protection ---');

    const [auditTable] = await pool.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'super_admin_audit_log'",
      [process.env.DB_NAME || 'mizero_inventory']
    );

    if (auditTable.length === 0) {
      await pool.query(`
        CREATE TABLE super_admin_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          actor_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          target_user_id INT DEFAULT NULL,
          details TEXT DEFAULT NULL,
          ip_address VARCHAR(45) DEFAULT NULL,
          status ENUM('blocked', 'allowed') NOT NULL DEFAULT 'blocked',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_actor (actor_id),
          INDEX idx_audit_action (action),
          INDEX idx_audit_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ super_admin_audit_log table created');
    } else {
      console.log('  ✅ super_admin_audit_log table already exists - skipping');
    }

    console.log('\nAll migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runMigrations();
