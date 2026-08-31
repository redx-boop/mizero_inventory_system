const pool = require('../config/db');

const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, module, action } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT al.*, u.full_name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (module) { query += ' AND al.module = ?'; params.push(module); }
    if (action) { query += ' AND al.action = ?'; params.push(action); }

    const [countResult] = await pool.query(query.replace('SELECT al.*, u.full_name as user_name', 'SELECT COUNT(*) as total'), params);
    const total = countResult[0].total;

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get activity logs error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const cleanupActivityLogs = async (req, res) => {
  try {
    // Delete activity logs older than 90 days
    const [result] = await pool.query(
      `DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
    );

    res.json({
      message: `Cleaned up ${result.affectedRows} old activity logs.`,
      deleted_count: result.affectedRows
    });
  } catch (error) {
    req.log.error({ err: error }, 'Cleanup activity logs error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getActivityLogs, cleanupActivityLogs };
