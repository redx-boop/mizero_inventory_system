const pool = require('../config/db');

const logActivity = async (userId, action, module, description, ipAddress = null) => {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, module, description, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, action, module, description, ipAddress]
    );
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = logActivity;
