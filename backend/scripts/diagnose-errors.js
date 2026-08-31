/**
 * Diagnose backend errors by checking:
 * 1. Database tables and columns
 * 2. Running the actual login query to catch SQL errors
 * 3. Checking for common schema mismatches
 */
require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('=== DATABASE CONNECTED ===');

    // 1. List tables
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('\nTables:', tableNames.join(', '));

    // 2. Check users table columns
    const [userCols] = await conn.query('SHOW COLUMNS FROM users');
    console.log('\n=== USERS COLUMNS ===');
    userCols.forEach(c => console.log(`  ${c.Field}: ${c.Type}${c.Null === 'YES' ? ' NULL' : ' NOT NULL'}${c.Default !== null ? ` DEFAULT ${c.Default}` : ''}`));

    // 3. Check notifications table columns
    const [notifCols] = await conn.query('SHOW COLUMNS FROM notifications');
    console.log('\n=== NOTIFICATIONS COLUMNS ===');
    notifCols.forEach(c => console.log(`  ${c.Field}: ${c.Type}${c.Null === 'YES' ? ' NULL' : ' NOT NULL'}`));

    // 4. Check items table columns (for unit_cost, currency)
    const [itemCols] = await conn.query('SHOW COLUMNS FROM items');
    console.log('\n=== ITEMS COLUMNS ===');
    itemCols.forEach(c => console.log(`  ${c.Field}: ${c.Type}`));

    // 5. Test the actual login query
    console.log('\n=== TESTING LOGIN QUERY ===');
    try {
      const [users] = await conn.query(
        `SELECT u.*, r.name as role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.email = ?`,
        ['admin@mizero.com']
      );
      console.log(`User found: ${users.length > 0}`);
      if (users.length > 0) {
        const user = users[0];
        console.log(`User ID: ${user.id}, Role: ${user.role_name}`);
        console.log(`Has must_change_password: ${'must_change_password' in user}`);
        console.log(`Has password field: ${'password' in user}`);

        // Test bcrypt
        try {
          const isMatch = bcrypt.compareSync('password123', user.password);
          console.log(`Password match: ${isMatch}`);
        } catch (bcErr) {
          console.error(`Bcrypt error: ${bcErr.message}`);
        }

        // Test user_departments
        try {
          const [depts] = await conn.query('SELECT department_id FROM user_departments WHERE user_id = ?', [user.id]);
          console.log(`User departments: ${depts.length} found`);
        } catch (udErr) {
          console.error(`user_departments query error: ${udErr.message}`);
        }

        // Test last_login update
        try {
          await conn.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
          console.log('last_login update: OK');
        } catch (llErr) {
          console.error(`last_login update error: ${llErr.message}`);
        }
      }
    } catch (queryErr) {
      console.error(`Login query error: ${queryErr.message}`);
      console.error(`SQL State: ${queryErr.sqlState}`);
      console.error(`Error code: ${queryErr.code}`);
    }

    // 6. Check if all migrations appear to have run (missing columns check)
    console.log('\n=== MIGRATION CHECK ===');

    // Check expected columns from migrations
    const checks = [
      { table: 'items', column: 'deleted_at', migration: '001 - soft delete' },
      { table: 'items', column: 'unit_cost', migration: '005 - unit price' },
      { table: 'items', column: 'currency', migration: '005 - unit price' },
      { table: 'items', column: 'image_url', migration: '008 - item images' },
      { table: 'stock_in', column: 'unit_price', migration: '005 - unit price' },
      { table: 'stock_in', column: 'total_cost', migration: '005 - unit price (GENERATED)' },
      { table: 'stock_in', column: 'supplier_id', migration: '017 - suppliers' },
      { table: 'stock_out', column: 'unit_cost_at_time', migration: '005 - unit price' },
      { table: 'stock_out', column: 'total_cost', migration: '005 - unit price (GENERATED)' },
      { table: 'stock_adjustments', column: 'unit_cost_at_time', migration: '005 - unit price' },
      { table: 'stock_adjustments', column: 'total_cost', migration: '005 - unit price (GENERATED)' },
      { table: 'borrowings', column: 'unit_cost_at_time', migration: '005 - unit price' },
      { table: 'borrowings', column: 'total_replacement_value', migration: '005 - unit price (GENERATED)' },
      { table: 'notifications', column: 'type', migration: '023 - notification type' },
      { table: 'notifications', column: 'route', migration: '024 - notification route' },
      { table: 'notifications', column: 'actor', migration: '024 - notification route' },
      { table: 'notifications', column: 'read_at', migration: '024 - notification route' },
      { table: 'users', column: 'must_change_password', migration: '016 - force password change' },
      { table: 'suppliers', column: 'id', migration: '017 - suppliers' },
      { table: 'budgets', column: 'id', migration: '007 - budget and reports' },
      { table: 'damage_liabilities', column: 'id', migration: '009 - damage liabilities' },
      { table: 'user_departments', column: 'id', migration: '002 - user departments' },
      { table: 'requests', column: 'allocated_quantity', migration: '022 - request allocation' },
    ];

    for (const check of checks) {
      try {
        const [cols] = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [check.table, check.column]
        );
        if (cols.length === 0) {
          console.log(`❌ MISSING: ${check.table}.${check.column} (migration ${check.migration})`);
        } else {
          console.log(`✅ EXISTS: ${check.table}.${check.column}`);
        }
      } catch (e) {
        console.log(`⚠️  CHECK FAILED: ${check.table}.${check.column} - ${e.message}`);
      }
    }

    conn.release();
    console.log('\n=== DIAGNOSIS COMPLETE ===');
    process.exit(0);
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
})();
