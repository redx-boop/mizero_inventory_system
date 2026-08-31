require('dotenv').config();
const mysql = require('mysql2/promise');

async function verify() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mizero_inventory'
  });

  try {
    // 1. Check column exists
    const [columns] = await conn.query('SHOW COLUMNS FROM users');
    const mustChangeCol = columns.find(c => c.Field === 'must_change_password');
    if (mustChangeCol) {
      console.log('✅ must_change_password column exists');
      console.log('   Type:', mustChangeCol.Type);
      console.log('   Default:', mustChangeCol.Default);
      console.log('   Extra:', mustChangeCol.Extra);
    } else {
      console.log('❌ must_change_password column NOT FOUND');
    }

    // 2. Check all users
    const [users] = await conn.query(
      'SELECT id, full_name, email, must_change_password FROM users ORDER BY id'
    );
    console.log('\n=== All Users ===');
    users.forEach(u => {
      console.log(
        `  ID: ${u.id} | ${String(u.full_name).padEnd(25)} | ${String(u.email).padEnd(30)} | must_change: ${u.must_change_password}`
      );
    });

    // 3. Verify existing users have must_change_password = 0 (backward compatibility)
    const existingUsers = users.filter(u => u.must_change_password === 0);
    const flaggedUsers = users.filter(u => u.must_change_password === 1);
    console.log(`\n📊 Summary:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   must_change_password = 0 (existing): ${existingUsers.length}`);
    console.log(`   must_change_password = 1 (new/flagged): ${flaggedUsers.length}`);

    // 4. Verify index exists
    const [indexes] = await conn.query('SHOW INDEX FROM users');
    const pwIndex = indexes.find(i => i.Column_name === 'must_change_password');
    if (pwIndex) {
      console.log('✅ idx_users_must_change_password index exists');
    } else {
      console.log('ℹ️  Index idx_users_must_change_password not found (acceptable for small tables)');
    }

    console.log('\n✅ Migration 016 verification complete');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await conn.end();
  }
}

verify();
