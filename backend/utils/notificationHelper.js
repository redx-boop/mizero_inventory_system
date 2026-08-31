const pool = require('../config/db');
const { sendLowStockAlert, sendNotificationEmail } = require('./emailService');

const createNotification = async (userId, title, message, module, referenceId = null, type = 'info', route = null, actor = null) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, module, reference_id, route, actor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, title, message, type, module, referenceId, route, actor]
    );

    // Notification stored in DB; frontend fetches via REST API polling
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
};

const notifyManagement = async (title, message, module, referenceId = null, excludeUserId = null, type = 'info', route = null, actor = null) => {
  try {
    // Single query — fetch all management users with id, email, and full_name
    const [users] = await pool.query(
      `SELECT id, email, full_name FROM users
       WHERE role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'stock_manager'))
       AND status = 'active'`
    );

    for (const user of users) {
      if (excludeUserId && user.id === excludeUserId) continue;

      // Create in-app notification
      await createNotification(user.id, title, message, module, referenceId, type, route, actor);

      // Send email notification if user has an email address
      if (user.email) {
        try {
          await sendNotificationEmail(user.email, user.full_name, title, message);
        } catch (emailErr) {
          console.error('Failed to send email notification:', emailErr.message);
        }
      }
    }
  } catch (error) {
    console.error('Failed to notify management:', error.message);
  }
};

const notifyLowStock = async (item) => {
  try {
    // Resolve department name for context-rich notification
    let deptName = '';
    if (item.department_id) {
      try {
        const [deptRows] = await pool.query('SELECT name FROM departments WHERE id = ?', [item.department_id]);
        if (deptRows.length) deptName = ` in ${deptRows[0].name}`;
      } catch { /* ignore department lookup failure */ }
    }

    const [users] = await pool.query(
      `SELECT id, email, full_name FROM users WHERE role_id IN (SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'stock_manager')) AND status = 'active'`
    );

    const emails = [];
    for (const user of users) {
      await createNotification(
        user.id,
        'Low Stock Alert',
        `Item "${item.name}" (SKU: ${item.sku})${deptName} has low stock. Current quantity: ${item.quantity}, Minimum: ${item.minimum_stock}.`,
        'inventory',
        item.id,
        'warning'
      );
      if (user.email) emails.push(user.email);
    }

    // Send email alert if SMTP is configured
    if (emails.length > 0) {
      await sendLowStockAlert(item, emails);
    }
  } catch (error) {
    console.error('Failed to notify low stock:', error.message);
  }
};

module.exports = { createNotification, notifyLowStock, notifyManagement };
