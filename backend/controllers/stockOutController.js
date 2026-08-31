const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { createNotification, notifyManagement } = require('../utils/notificationHelper');
const { getDepartmentScope } = require('../middleware/departmentScope');
const { parseNumber } = require('../utils/financial');

const getStockOut = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      item_id, department_id, recipient,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT so.*, i.name as item_name, i.sku as item_sku, i.department_id as item_department_id,
             COALESCE(l.already_returned, 0) as already_returned,
             (so.quantity - COALESCE(l.already_returned, 0)) as remaining_qty,
             u.full_name as created_by_name
      FROM stock_out so
      JOIN items i ON so.item_id = i.id
      LEFT JOIN users u ON so.created_by = u.id
      LEFT JOIN (SELECT stock_out_id, SUM(CAST(returned_quantity AS DECIMAL(14,2))) as already_returned FROM leftovers GROUP BY stock_out_id) l ON l.stock_out_id = so.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR so.recipient LIKE ? OR so.department LIKE ? OR so.reason LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (from) { query += ' AND so.date >= ?'; params.push(from); }
    if (to) { query += ' AND so.date <= ?'; params.push(to); }
    if (item_id) { query += ' AND so.item_id = ?'; params.push(item_id); }
    if (department_id) { query += ' AND so.department = ?'; params.push(department_id); }
    if (recipient) { query += ' AND so.recipient LIKE ?'; params.push(`%${recipient}%`); }

    // Department scope: stock_managers only see their department items (centralized)
    const scope = getDepartmentScope(req, 'i');
    if (scope.hasScope) {
      query += scope.clause;
      params.push(...scope.params);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'so.created_at', date: 'so.date', item_name: 'i.name', quantity: 'so.quantity', recipient: 'so.recipient', department: 'so.department' };
    const sortCol = allowedSorts[sortBy] || 'so.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get stock out error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createStockOut = async (req, res) => {
  let connection;
  try {
    const { item_id, quantity, recipient, department, reason, date } = req.body;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🔒 Row-level lock on the item to prevent concurrent stock mutations
    const [items] = await connection.query('SELECT * FROM items WHERE id = ? FOR UPDATE', [item_id]);
    if (!items.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (items[0].quantity < quantity) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Insufficient stock.',
        available: items[0].quantity,
        requested: quantity
      });
    }

    // Snapshot the current unit_cost at time of stock-out for cost tracking
    const unitCostAtTime = parseNumber(items[0].unit_cost);

    const [result] = await connection.query(
      'INSERT INTO stock_out (item_id, quantity, unit_cost_at_time, recipient, department, reason, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [item_id, quantity, unitCostAtTime, recipient, department || null, reason || null, date || new Date(), req.user.id]
    );

    await connection.query('UPDATE items SET quantity = quantity - ? WHERE id = ?', [quantity, item_id]);

    await connection.commit();

    await logActivity(req.user.id, 'stock_out', 'inventory', `Stock out: ${quantity} of ${items[0].name} to ${recipient}${unitCostAtTime > 0 ? ` (cost: ${(quantity * unitCostAtTime).toFixed(2)})` : ''}`);

    const stockOutMsg = `${quantity} of ${items[0].name} issued to ${recipient}.${unitCostAtTime > 0 ? ` Unit cost: ${unitCostAtTime.toFixed(2)}.` : ''}`;
    await createNotification(
      req.user.id,
      'Stock Out Recorded',
      stockOutMsg,
      'stock_out',
      result.insertId,
      'warning',
      '/stock-out'
    );
    await notifyManagement(
      'Stock Out Recorded',
      stockOutMsg,
      'stock_out',
      result.insertId,
      req.user.id,
      'warning',
      '/stock-out'
    );

    res.status(201).json({ id: result.insertId, message: 'Stock out recorded successfully.', unit_cost_at_time: unitCostAtTime });
  } catch (error) {
    if (connection) await connection.rollback();
    req.log.error({ err: error }, 'Create stock out error');
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (connection) connection.release();
  }
};

const getStockOutReceipt = async (req, res) => {
  try {
    const [records] = await pool.query(
      `SELECT so.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM stock_out so
       JOIN items i ON so.item_id = i.id
       LEFT JOIN users u ON so.created_by = u.id
       WHERE so.id = ?`,
      [req.params.id]
    );

    if (!records.length) return res.status(404).json({ message: 'Stock out record not found.' });

    res.json(records[0]);
  } catch (error) {
    req.log.error({ err: error }, 'Get stock out receipt error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getStockOut, createStockOut, getStockOutReceipt };
