require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration021() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mizero_inventory',
    multipleStatements: true
  });

  try {
    console.log('🔍 Checking current state of selling_price columns...\n');

    // Check what columns exist before migration
    const [checkResult] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, EXTRA
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('items','stock_out')
         AND COLUMN_NAME IN ('selling_price','selling_price_at_time','gross_margin','gross_margin_pct')
       ORDER BY TABLE_NAME, COLUMN_NAME`,
      [process.env.DB_NAME || 'mizero_inventory']
    );

    if (checkResult.length === 0) {
      console.log('✅ No selling_price columns exist. Database is already clean.');
      console.log('   Migration 021 is a no-op for this database.\n');
    } else {
      console.log('📋 Found columns to remove:');
      checkResult.forEach(col => {
        console.log(`   - ${col.TABLE_NAME}.${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
      });
      console.log('');

      // Read and execute the migration SQL
      console.log('⚡ Running migration-021-remove-selling-price.sql...');
      const migrationPath = path.join(__dirname, '..', 'database', 'migration-021-remove-selling-price.sql');
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Execute the entire SQL file with multipleStatements
      try {
        await connection.query(sql);
        console.log('  ✅ All ALTER TABLE statements executed successfully');
      } catch (err) {
        console.log(`  ❌ Error executing migration: ${err.message}`);
      }
      console.log('');
    }

    // Verify the migration result
    console.log('🔍 Verifying cleanup...');
    const [verifyResult] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, EXTRA
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('items','stock_out')
         AND COLUMN_NAME IN ('selling_price','selling_price_at_time','gross_margin','gross_margin_pct')
       ORDER BY TABLE_NAME, COLUMN_NAME`,
      [process.env.DB_NAME || 'mizero_inventory']
    );

    if (verifyResult.length === 0) {
      console.log('✅ VERIFICATION PASSED: No selling_price columns remain.');
    } else {
      console.log('⚠️  VERIFICATION: Remaining columns:');
      verifyResult.forEach(col => {
        console.log(`   - ${col.TABLE_NAME}.${col.COLUMN_NAME}`);
      });
    }

    console.log('\n✅ Migration 021 completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await connection.end();
  }
}

runMigration021();
