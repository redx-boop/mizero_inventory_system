require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration005() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mizero_inventory',
    multipleStatements: false
  });

  try {
    console.log('=== Migration 005: Unit Price & Inventory Valuation ===\n');

    // 1. ITEMS TABLE
    console.log('1/7 - Adding unit_cost and currency to items...');
    const [itemsCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'items' AND COLUMN_NAME = 'unit_cost'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (itemsCol.length === 0) {
      await pool.query(
        "ALTER TABLE items ADD COLUMN unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Current weighted-average unit cost. Auto-calculated on stock-in using AVCO.' AFTER minimum_stock, ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'RWF' COMMENT 'Currency code (RWF, USD, etc.)' AFTER unit_cost"
      );
      console.log('   ✅ unit_cost and currency columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    // 2. STOCK_IN TABLE
    console.log('2/7 - Adding unit_price and total_cost to stock_in...');
    const [stockInCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stock_in' AND COLUMN_NAME = 'unit_price'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (stockInCol.length === 0) {
      await pool.query(
        "ALTER TABLE stock_in ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Unit price paid at time of this stock-in transaction.' AFTER quantity, ADD COLUMN total_cost DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED COMMENT 'Computed total cost for this stock-in line.' AFTER unit_price"
      );
      console.log('   ✅ unit_price and total_cost (GENERATED) columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    // 3. STOCK_OUT TABLE
    console.log('3/7 - Adding unit_cost_at_time and total_cost to stock_out...');
    const [stockOutCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stock_out' AND COLUMN_NAME = 'unit_cost_at_time'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (stockOutCol.length === 0) {
      await pool.query(
        "ALTER TABLE stock_out ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Item unit_cost at the moment this stock-out was created (snapshot for COGS).' AFTER quantity, ADD COLUMN total_cost DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost_at_time) STORED COMMENT 'Computed COGS for this stock-out line.' AFTER unit_cost_at_time"
      );
      console.log('   ✅ unit_cost_at_time and total_cost (GENERATED) columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    // 4. STOCK_ADJUSTMENTS TABLE
    console.log('4/7 - Adding unit_cost_at_time and total_cost to stock_adjustments...');
    const [adjCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stock_adjustments' AND COLUMN_NAME = 'unit_cost_at_time'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (adjCol.length === 0) {
      await pool.query(
        "ALTER TABLE stock_adjustments ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Item unit_cost snapshot at adjustment time.' AFTER quantity, ADD COLUMN total_cost DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost_at_time) STORED COMMENT 'Computed total cost impact of this adjustment.' AFTER unit_cost_at_time"
      );
      console.log('   ✅ unit_cost_at_time and total_cost (GENERATED) columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    // 5. BORROWINGS TABLE
    console.log('5/7 - Adding unit_cost_at_time and total_replacement_value to borrowings...');
    const [borrCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'borrowings' AND COLUMN_NAME = 'unit_cost_at_time'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (borrCol.length === 0) {
      await pool.query(
        "ALTER TABLE borrowings ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Item unit_cost at time of borrowing (for replacement if lost/damaged).' AFTER quantity, ADD COLUMN total_replacement_value DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost_at_time) STORED COMMENT 'Total replacement value of this borrowing.' AFTER unit_cost_at_time"
      );
      console.log('   ✅ unit_cost_at_time and total_replacement_value (GENERATED) columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    // 6. RETURNS TABLE
    console.log('6/7 - Adding unit_cost_at_time and total_value to returns...');
    const [retCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'returns' AND COLUMN_NAME = 'unit_cost_at_time'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (retCol.length === 0) {
      await pool.query(
        "ALTER TABLE returns ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Snapshot from the original borrowing record.' AFTER returned_quantity, ADD COLUMN total_value DECIMAL(14,2) GENERATED ALWAYS AS (returned_quantity * unit_cost_at_time) STORED COMMENT 'Value of returned items at time of original borrowing.' AFTER unit_cost_at_time"
      );
      console.log('   ✅ unit_cost_at_time and total_value (GENERATED) columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    // 7. LEFTOVERS TABLE
    console.log('7/7 - Adding unit_cost_at_time and total_value to leftovers...');
    const [leftCol] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leftovers' AND COLUMN_NAME = 'unit_cost_at_time'",
      [process.env.DB_NAME || 'mizero_inventory']
    );
    if (leftCol.length === 0) {
      await pool.query(
        "ALTER TABLE leftovers ADD COLUMN unit_cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Snapshot from the original stock-out record.' AFTER returned_quantity, ADD COLUMN total_value DECIMAL(14,2) GENERATED ALWAYS AS (returned_quantity * unit_cost_at_time) STORED COMMENT 'Value of returned leftover stock at original issue cost.' AFTER unit_cost_at_time"
      );
      console.log('   ✅ unit_cost_at_time and total_value (GENERATED) columns added');
    } else {
      console.log('   ✅ Already exists - skipping');
    }

    console.log('\n=== Migration 005 completed successfully! ===');
  } catch (error) {
    console.error('\nMigration 005 failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration005();
