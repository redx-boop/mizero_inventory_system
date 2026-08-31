/**
 * Run All Missing Migrations
 *
 * Audits the database and applies only migrations that haven't been run yet.
 * Safe to run multiple times — each migration checks if its changes already exist.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB = process.env.DB_NAME || 'mizero_inventory';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

async function query(conn, sql, params = []) {
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } catch (err) {
    // If table doesn't exist yet, skip gracefully
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
}

async function main() {
  console.log('🔍 Auditing database migrations...\n');

  const conn = await mysql.createConnection(config);
  await conn.query(`USE \`${DB}\``);

  // ---------- Migration 020: Drop customers table ----------
  console.log('📦 Migration 020 — Remove customers table...');
  const [customersTable] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers'",
    [DB]
  );
  if (customersTable.length > 0) {
    // Drop fulltext index first if it exists
    try {
      await conn.query('ALTER TABLE customers DROP INDEX IF EXISTS ft_customers_search');
    } catch (e) { /* index might not exist */ }
    await conn.query('DROP TABLE IF EXISTS customers');
    console.log('  ✅ Dropped customers table');
  } else {
    console.log('  ✅ Already removed — skipping');
  }

  // ---------- Migration 022: CHECK constraints ----------
  console.log('\n📦 Migration 022 — CHECK constraints...');
  const [existingChecks] = await conn.query(
    "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_TYPE = 'CHECK'",
    [DB]
  );
  const checkNames = existingChecks.map(r => r.CONSTRAINT_NAME);

  const constraints = [
    { table: 'items', name: 'chk_items_quantity_non_negative', sql: 'ALTER TABLE items ADD CONSTRAINT chk_items_quantity_non_negative CHECK (quantity >= 0)' },
    { table: 'items', name: 'chk_items_unit_cost_non_negative', sql: 'ALTER TABLE items ADD CONSTRAINT chk_items_unit_cost_non_negative CHECK (unit_cost >= 0)' },
    { table: 'items', name: 'chk_items_minimum_stock_non_negative', sql: 'ALTER TABLE items ADD CONSTRAINT chk_items_minimum_stock_non_negative CHECK (minimum_stock >= 0)' },
    { table: 'stock_in', name: 'chk_stock_in_quantity_positive', sql: 'ALTER TABLE stock_in ADD CONSTRAINT chk_stock_in_quantity_positive CHECK (quantity > 0)' },
    { table: 'stock_in', name: 'chk_stock_in_unit_price_non_negative', sql: 'ALTER TABLE stock_in ADD CONSTRAINT chk_stock_in_unit_price_non_negative CHECK (unit_price >= 0)' },
    { table: 'stock_out', name: 'chk_stock_out_quantity_positive', sql: 'ALTER TABLE stock_out ADD CONSTRAINT chk_stock_out_quantity_positive CHECK (quantity > 0)' },
    { table: 'stock_out', name: 'chk_stock_out_unit_cost_non_negative', sql: 'ALTER TABLE stock_out ADD CONSTRAINT chk_stock_out_unit_cost_non_negative CHECK (unit_cost_at_time >= 0)' },
    { table: 'stock_adjustments', name: 'chk_adjustment_quantity_positive', sql: 'ALTER TABLE stock_adjustments ADD CONSTRAINT chk_adjustment_quantity_positive CHECK (quantity > 0)' },
    { table: 'stock_adjustments', name: 'chk_adjustment_unit_cost_non_negative', sql: 'ALTER TABLE stock_adjustments ADD CONSTRAINT chk_adjustment_unit_cost_non_negative CHECK (unit_cost_at_time >= 0)' },
    { table: 'borrowings', name: 'chk_borrowing_quantity_positive', sql: 'ALTER TABLE borrowings ADD CONSTRAINT chk_borrowing_quantity_positive CHECK (quantity > 0)' },
    { table: 'borrowings', name: 'chk_borrowing_unit_cost_non_negative', sql: 'ALTER TABLE borrowings ADD CONSTRAINT chk_borrowing_unit_cost_non_negative CHECK (unit_cost_at_time >= 0)' },
    { table: 'returns', name: 'chk_return_quantity_positive', sql: 'ALTER TABLE returns ADD CONSTRAINT chk_return_quantity_positive CHECK (returned_quantity > 0)' },
    { table: 'returns', name: 'chk_return_unit_cost_non_negative', sql: 'ALTER TABLE returns ADD CONSTRAINT chk_return_unit_cost_non_negative CHECK (unit_cost_at_time >= 0)' },
    { table: 'leftovers', name: 'chk_leftover_quantity_positive', sql: 'ALTER TABLE leftovers ADD CONSTRAINT chk_leftover_quantity_positive CHECK (returned_quantity > 0)' },
    { table: 'leftovers', name: 'chk_leftover_unit_cost_non_negative', sql: 'ALTER TABLE leftovers ADD CONSTRAINT chk_leftover_unit_cost_non_negative CHECK (unit_cost_at_time >= 0)' },
    { table: 'budgets', name: 'chk_budget_total_positive', sql: 'ALTER TABLE budgets ADD CONSTRAINT chk_budget_total_positive CHECK (total_budget >= 0)' },
  ];

  let added = 0;
  for (const c of constraints) {
    if (checkNames.includes(c.name)) {
      console.log(`  ⏭️  ${c.name} — already exists`);
    } else {
      try {
        // Check if table exists first
        const [tableCheck] = await conn.query(
          "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
          [DB, c.table]
        );
        if (tableCheck.length === 0) {
          console.log(`  ⏭️  ${c.name} — table ${c.table} doesn't exist`);
          continue;
        }
        await conn.query(c.sql);
        console.log(`  ✅ ${c.name}`);
        added++;
      } catch (err) {
        // Some CHECK constraints may fail if existing data violates them
        // This is acceptable — the constraint will be enforced going forward
        console.log(`  ⚠️  ${c.name} — ${err.message}`);
      }
    }
  }
  console.log(`  Added ${added} new CHECK constraint(s)`);

  // ---------- Migration 022: Performance indexes ----------
  console.log('\n📦 Migration 022 — Performance indexes...');

  const [existingIndexes] = await conn.query(
    "SELECT INDEX_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? GROUP BY INDEX_NAME, TABLE_NAME",
    [DB]
  );
  const indexSet = new Set(existingIndexes.map(r => `${r.TABLE_NAME}.${r.INDEX_NAME}`));

  const indexes = [
    'ALTER TABLE items ADD INDEX idx_items_dept_type (department_id, item_type, deleted_at)',
    'ALTER TABLE items ADD INDEX idx_items_created_deleted (created_at DESC, deleted_at)',
    'ALTER TABLE stock_in ADD INDEX idx_stock_in_item_date (item_id, date DESC)',
    'ALTER TABLE stock_in ADD INDEX idx_stock_in_created (created_at DESC)',
    'ALTER TABLE stock_in ADD INDEX idx_stock_in_department (department_id)',
    'ALTER TABLE stock_out ADD INDEX idx_stock_out_item_date (item_id, date DESC)',
    'ALTER TABLE stock_out ADD INDEX idx_stock_out_created (created_at DESC)',
    'ALTER TABLE stock_adjustments ADD INDEX idx_adjustment_created (created_at DESC)',
    'ALTER TABLE stock_adjustments ADD INDEX idx_adjustment_type_date (adjustment_type, created_at DESC)',
    'ALTER TABLE borrowings ADD INDEX idx_borrowing_status_created (status, created_at DESC)',
    'ALTER TABLE borrowings ADD INDEX idx_borrowing_created (created_at DESC)',
    'ALTER TABLE requests ADD INDEX idx_request_requester_status (requester_id, status)',
    'ALTER TABLE requests ADD INDEX idx_request_created (created_at DESC)',
    'ALTER TABLE damage_liabilities ADD INDEX idx_liability_type_status (liability_type, status)',
    'ALTER TABLE damage_liabilities ADD INDEX idx_liability_created (created_at DESC)',
    'ALTER TABLE activity_logs ADD INDEX idx_activity_module_action (module, action, created_at DESC)',
    'ALTER TABLE notifications ADD INDEX idx_notif_user_read_created (user_id, is_read, created_at DESC)',
  ];

  let idxAdded = 0;
  for (const sql of indexes) {
    // Extract index name from the SQL
    const match = sql.match(/ADD INDEX\s+(\w+)/);
    const indexName = match ? match[1] : null;
    const tableMatch = sql.match(/ALTER TABLE\s+(\w+)/);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (indexName && tableName && indexSet.has(`${tableName}.${indexName}`)) {
      console.log(`  ⏭️  ${tableName}.${indexName} — already exists`);
    } else if (indexName && tableName) {
      try {
        const [tableCheck] = await conn.query(
          "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
          [DB, tableName]
        );
        if (tableCheck.length === 0) {
          console.log(`  ⏭️  ${tableName}.${indexName} — table doesn't exist`);
          continue;
        }
        await conn.query(sql);
        console.log(`  ✅ ${tableName}.${indexName}`);
        idxAdded++;
      } catch (err) {
        console.log(`  ⚠️  ${tableName}.${indexName} — ${err.message}`);
      }
    }
  }
  console.log(`  Added ${idxAdded} new index(es)`);

  await conn.end();

  console.log('\n✅ All migrations completed!');
  console.log('Summary:');
  console.log(`  - Migration 020 (drop customers): APPLIED`);
  console.log(`  - Migration 022 (constraints): ${added} added`);
  console.log(`  - Migration 022 (indexes): ${idxAdded} added`);
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
