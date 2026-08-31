/**
 * Setup Admin User Script
 * Run this if the seed data's bcrypt hash doesn't match.
 * This will create/reset the admin user with password: password123
 *
 * Usage: node scripts/setup-admin.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setup() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'mizero_inventory',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    // CRITICAL: Prevent creating a second Super Admin
    const [existingSuperAdmins] = await pool.query(
      `SELECT COUNT(*) as count FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'super_admin' AND u.status = 'active'`
    );
    if (existingSuperAdmins[0].count > 0) {
      console.log('\n⚠️  A Super Admin account already exists in the system.');
      console.log('   This script will only update the password for admin@mizero.com.');
      console.log('   It will NOT create a new Super Admin account.\n');
    }

    // Check if admin user exists
    const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', ['admin@mizero.com']);

    if (users.length > 0) {
      const hashedPassword = bcrypt.hashSync('password123', 12);
      await pool.query('UPDATE users SET password = ?, status = ? WHERE email = ?', [hashedPassword, 'active', 'admin@mizero.com']);
      console.log('✅ Admin password updated successfully!');
    } else if (existingSuperAdmins[0].count === 0) {
      // Only create admin user if no super admin exists (role_id 1 = super_admin)
      const hashedPassword = bcrypt.hashSync('password123', 12);
      await pool.query(
        'INSERT INTO users (full_name, email, password, role_id, status) VALUES (?, ?, ?, ?, ?)',
        ['Super Admin', 'admin@mizero.com', hashedPassword, 1, 'active']
      );
      console.log('✅ Admin user created successfully!');
    } else {
      console.log('⚠️  Cannot create new Super Admin account. Only one is permitted.');
      console.log('   The account admin@mizero.com does not exist, but a Super Admin already exists.');
      console.log('   To create a new admin, use the application UI/API instead.');
    }

    console.log('\nYou can now log in with:');
    console.log('  Email:    admin@mizero.com');
    console.log('  Password: password123\n');

    await pool.end();
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
