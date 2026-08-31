require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Global Jest setup
 * Verifies the database is accessible and seeded before running tests.
 */
module.exports = async () => {
  console.log('🔧 Test setup: verifying database...');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mizero_inventory',
      multipleStatements: true
    });

    // Verify users table has data (seeded)
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log(`   Users in DB: ${users[0].count}`);

    if (users[0].count === 0) {
      console.error('❌ Database has no users! Run the seed script first.');
      process.exit(1);
    }

    // Verify test admin exists
    const [admin] = await connection.query(
      "SELECT id, email FROM users WHERE email = 'admin@mizero.com'"
    );
    if (admin.length === 0) {
      console.error('❌ Test admin user (admin@mizero.com) not found. Run the seed script first.');
      process.exit(1);
    }

    console.log(`   ✅ Test admin found: ${admin[0].email} (ID: ${admin[0].id})`);

    // Ensure at least one department exists
    const [depts] = await connection.query('SELECT COUNT(*) as count FROM departments');
    if (depts[0].count === 0) {
      console.error('❌ No departments found. Run the seed script first.');
      process.exit(1);
    }

    // Ensure at least one item exists for stock-in/out tests
    const [items] = await connection.query('SELECT COUNT(*) as count FROM items WHERE deleted_at IS NULL');
    console.log(`   Items in DB: ${items[0].count}`);

    console.log('✅ Test setup complete. Database is ready.');
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
};
