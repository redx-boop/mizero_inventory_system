/**
 * Password Migration Script
 *
 * Audits all user passwords in the database and hashes any plain text passwords
 * that were stored before bcrypt was properly implemented.
 *
 * Usage: node scripts/migrate-passwords.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function migratePasswords() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'mizero_inventory',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log('🔍 Auditing user passwords...\n');

    const [users] = await pool.query('SELECT id, full_name, email, password FROM users');

    let hashedCount = 0;
    let plainCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const pw = user.password;

      // Check if password is already a valid bcrypt hash
      // bcrypt hashes start with $2a$, $2b$, or $2y$
      if (pw.startsWith('$2a$') || pw.startsWith('$2b$') || pw.startsWith('$2y$')) {
        console.log(`  ✅ ${user.email} - already hashed (${user.full_name})`);
        hashedCount++;
        continue;
      }

      // This is a plain text password — hash it
      console.log(`  ⚠️  ${user.email} - PLAIN TEXT password detected (${user.full_name})`);
      const hashedPassword = bcrypt.hashSync(pw, 12);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
      console.log(`     → Hashed and updated`);
      plainCount++;
    }

    console.log('\n========================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('========================================');
    console.log(`  Already hashed:  ${hashedCount} users`);
    console.log(`  Plain → Hashed:  ${plainCount} users`);
    console.log(`  Total checked:   ${hashedCount + plainCount} users`);
    console.log('========================================\n');

    if (plainCount > 0) {
      console.log('✅ All plain text passwords have been hashed with bcrypt.');
    } else {
      console.log('✅ No plain text passwords found. All passwords are already hashed.');
    }

    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migratePasswords();
