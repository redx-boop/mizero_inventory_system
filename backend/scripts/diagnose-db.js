/**
 * Diagnose database table corruption
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    await conn.query('USE mizero_inventory');
    
    const [tables] = await conn.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Checking', tableNames.length, 'tables for corruption...\n');
    
    let good = 0, bad = 0;
    for (const table of tableNames) {
      try {
        const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM `' + table + '`');
        console.log('  ✅', table, ':', rows[0].cnt, 'rows');
        good++;
      } catch(e) {
        if (e.errno === 1932 || e.errno === 1146) {
          console.log('  ❌ CORRUPTED:', table, '-', e.message);
          bad++;
        } else {
          console.log('  ⚠️', table, '-', e.message);
          bad++;
        }
      }
    }

    console.log('\n--- Summary ---');
    console.log('Healthy tables:', good);
    console.log('Corrupted tables:', bad);
    
    if (bad > 0) {
      console.log('\n🔧 To fix: use mysqlcheck or recreate the affected tables from schema.sql');
      console.log('  mysqlcheck -u root --repair mizero_inventory table_name');
    }
  } catch(e) {
    console.error('Fatal error:', e.message);
  }
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
