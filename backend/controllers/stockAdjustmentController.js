const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { notifyLowStock } = require('../utils/notificationHelper');
const { parseNumber } = require('../utils/financial');
const { isLowStock } = require('../services/inventoryRules');

const getAdjustments = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      item_id, type,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT sa.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
      FROM stock_adjustments sa
      JOIN items i ON sa.item_id = i.id
      LEFT JOIN users u ON sa.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR sa.reason LIKE ? OR sa.notes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) { query += ' AND sa.created_at >= ?'; params.push(from); }
    if (to) { query += ' AND sa.created_at <= ?'; params.push(`${to} 23:59:59`); }
    if (item_id) { query += ' AND sa.item_id = ?'; params.push(item_id); }
    if (type) { query += ' AND sa.adjustment_type = ?'; params.push(type); }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'sa.created_at', item_name: 'i.name', adjustment_type: 'sa.adjustment_type', quantity: 'sa.quantity', reason: 'sa.reason' };
    const sortCol = allowedSorts[sortBy] || 'sa.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get adjustments error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createAdjustment = async (req, res) => {
  let connection;
  try {
    const { item_id, adjustment_type, quantity, reason, notes } = req.body;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🔒 Row-level lock on the item to prevent concurrent stock mutations
    const [items] = await connection.query('SELECT * FROM items WHERE id = ? FOR UPDATE', [item_id]);
    if (!items.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (adjustment_type === 'decrease' && items[0].quantity < quantity) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Cannot decrease stock below zero.',
        available: items[0].quantity,
        requested_decrease: quantity
      });
    }

    // CRITICAL: Snapshot the current unit_cost at time of adjustment
    const unitCostAtTime = parseNumber(items[0].unit_cost);

    const [result] = await connection.query(
      'INSERT INTO stock_adjustments (item_id, adjustment_type, quantity, unit_cost_at_time, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item_id, adjustment_type, quantity, unitCostAtTime, reason, notes || null, req.user.id]
    );

    const qtyChange = adjustment_type === 'increase' ? quantity : -quantity;
    await connection.query('UPDATE items SET quantity = quantity + ? WHERE id = ?', [qtyChange, item_id]);

    await connection.commit();

    // NOTE: Stock adjustments do NOT recalculate AVCO.
    // AVCO is only updated by stock-in transactions (new purchases).

    const [updatedItem] = await pool.query('SELECT * FROM items WHERE id = ?', [item_id]);
    await logActivity(req.user.id, 'adjustment', 'inventory', `Stock ${adjustment_type}: ${quantity} of ${items[0].name} - ${reason}${unitCostAtTime > 0 ? ` (value: ${(quantity * unitCostAtTime).toFixed(2)})` : ''}`);

    if (isLowStock(updatedItem[0])) {
      await notifyLowStock(updatedItem[0]);
    }

    res.status(201).json({ id: result.insertId, message: 'Stock adjustment recorded successfully.', unit_cost_at_time: unitCostAtTime });
  } catch (error) {
    if (connection) await connection.rollback();
    req.log.error({ err: error }, 'Create adjustment error');
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAdjustments, createAdjustment };
