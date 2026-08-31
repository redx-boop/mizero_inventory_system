/**
 * Run Migration 022: Request Allocation Tracking
 *
 * Adds allocated_quantity and remaining_quantity columns to the requests table.
 * Checks if columns already exist before applying.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const DB = process.env.DB_NAME || 'mizero_inventory';

async function main() {
  console.log('📦 Migration 022 — Request Allocation Tracking\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB,
    multipleStatements: true
  });

  try {
    // Check if allocated_quantity column already exists
    const [columns] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'allocated_quantity'`,
      [DB]
    );

    if (columns.length > 0) {
      console.log('  ✅ allocated_quantity column already exists — skipping');
    } else {
      // Run the migration
      await conn.query(`
        ALTER TABLE requests
          ADD COLUMN allocated_quantity INT NOT NULL DEFAULT 0
            COMMENT 'Actual quantity allocated (may be less than requested for partial allocation).'
          AFTER quantity,
          ADD COLUMN remaining_quantity INT GENERATED ALWAYS AS (quantity - allocated_quantity) STORED
            COMMENT 'Quantity still pending allocation.'
          AFTER allocated_quantity
      `);
      console.log('  ✅ allocated_quantity and remaining_quantity columns added to requests table');
    }

    console.log('\n✅ Migration 022 completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
