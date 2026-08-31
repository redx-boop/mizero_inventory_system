const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { createNotification, notifyManagement } = require('../utils/notificationHelper');
const { parseNumber } = require('../utils/financial');

const getReturns = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      condition, borrower_name, item_id,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Only show 'good' condition returns - damaged & lost go through liabilities
    let query = `
      SELECT r.*, b.borrower_name, b.borrower_phone, b.quantity as borrowing_quantity,
             COALESCE(rt.total_returned, 0) as already_returned,
             COALESCE(dl.total_damaged, 0) as already_damaged,
             (b.quantity - COALESCE(rt.total_returned, 0) - COALESCE(dl.total_damaged, 0)) as remaining_qty,
             i.name as item_name, i.sku as item_sku,
             u.full_name as created_by_name
      FROM returns r
      JOIN borrowings b ON r.borrowing_id = b.id
      JOIN items i ON b.item_id = i.id
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN (
        SELECT borrowing_id, SUM(returned_quantity) as total_returned
        FROM returns
        GROUP BY borrowing_id
      ) rt ON rt.borrowing_id = b.id
      LEFT JOIN (
        SELECT borrowing_id, SUM(quantity) as total_damaged
        FROM damage_liabilities
        GROUP BY borrowing_id
      ) dl ON dl.borrowing_id = b.id
      WHERE r.item_condition = 'good'
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR b.borrower_name LIKE ? OR r.notes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) { query += ' AND r.return_date >= ?'; params.push(from); }
    if (to) { query += ' AND r.return_date <= ?'; params.push(to); }
    if (condition) { query += ' AND r.item_condition = ?'; params.push(condition); }
    if (borrower_name) { query += ' AND b.borrower_name LIKE ?'; params.push(`%${borrower_name}%`); }
    if (item_id) { query += ' AND b.item_id = ?'; params.push(item_id); }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'r.created_at', return_date: 'r.return_date', item_name: 'i.name', borrower_name: 'b.borrower_name', returned_quantity: 'r.returned_quantity' };
    const sortCol = allowedSorts[sortBy] || 'r.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get returns error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createReturn = async (req, res) => {
  let connection;
  try {
    const { borrowing_id, returned_quantity, condition, notes, return_date } = req.body;

    const [borrowings] = await pool.query('SELECT * FROM borrowings WHERE id = ?', [borrowing_id]);
    if (!borrowings.length) return res.status(404).json({ message: 'Borrowing not found.' });

    const borrowing = borrowings[0];

    // BUSINESS RULE: Only GOOD condition items are returns.
    if (condition === 'damaged' || condition === 'lost') {
      const endpoint = condition === 'damaged' ? 'Damaged Items: Use the Damage & Loss Liabilities page' : 'Lost Items: Use the Damage & Loss Liabilities page with liability_type="lost"';
      return res.status(400).json({
        message: `${condition.charAt(0).toUpperCase() + condition.slice(1)} items CANNOT be recorded as returns. ${endpoint}.`
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🔒 Row-level lock on the borrowing and item to prevent concurrent mutations
    const [lockedBorrowing] = await connection.query('SELECT * FROM borrowings WHERE id = ? FOR UPDATE', [borrowing_id]);
    if (!lockedBorrowing.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Borrowing not found.' });
    }

    const [lockedItem] = await connection.query('SELECT * FROM items WHERE id = ? FOR UPDATE', [borrowing.item_id]);

    const [returnsRows] = await connection.query('SELECT COALESCE(SUM(returned_quantity), 0) as total FROM returns WHERE borrowing_id = ?', [borrowing_id]);
    const [damageRows] = await connection.query('SELECT COALESCE(SUM(quantity), 0) as total FROM damage_liabilities WHERE borrowing_id = ?', [borrowing_id]);
    const alreadyReturned = parseNumber(returnsRows[0].total);
    const alreadyDamaged = parseNumber(damageRows[0].total);
    const alreadyAccounted = alreadyReturned + alreadyDamaged;

    if (alreadyAccounted + returned_quantity > borrowing.quantity) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Return quantity exceeds borrowed quantity.',
        borrowed: borrowing.quantity,
        already_returned: alreadyReturned,
        already_damaged: alreadyDamaged,
        attempting_return: returned_quantity
      });
    }

    // CRITICAL: Copy the unit_cost_at_time from the original borrowing for valuation
    const unitCostAtTime = parseNumber(borrowing.unit_cost_at_time);

    const [result] = await connection.query(
      'INSERT INTO returns (borrowing_id, returned_quantity, unit_cost_at_time, item_condition, notes, return_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [borrowing_id, returned_quantity, unitCostAtTime, 'good', notes || null, return_date || new Date(), req.user.id]
    );

    const totalAccounted = alreadyReturned + alreadyDamaged + returned_quantity;
    if (totalAccounted >= borrowing.quantity) {
      await connection.query('UPDATE borrowings SET status = ? WHERE id = ?', ['returned', borrowing_id]);
    }

    // Only GOOD condition items are restored to inventory
    await connection.query('UPDATE items SET quantity = quantity + ? WHERE id = ?', [returned_quantity, borrowing.item_id]);

    await connection.commit();

    const [item] = await pool.query('SELECT name FROM items WHERE id = ?', [borrowing.item_id]);
    await logActivity(req.user.id, 'return', 'returns', `Returned ${returned_quantity} of ${item[0].name} (Good condition)${unitCostAtTime > 0 ? ` @ ${unitCostAtTime}/unit` : ''}`);

    const returnMsg = `${returned_quantity} of ${item[0].name} returned by ${borrowing.borrower_name} in good condition. Inventory restored.`;
    await createNotification(
      req.user.id,
      'Borrowing Returned',
      returnMsg,
      'returns',
      result.insertId,
      'success',
      '/returns'
    );
    await notifyManagement(
      'Borrowing Returned',
      returnMsg,
      'returns',
      result.insertId,
      req.user.id,
      'success',
      '/returns'
    );

    res.status(201).json({ id: result.insertId, message: 'Return recorded successfully. Inventory restored.', unit_cost_at_time: unitCostAtTime });
  } catch (error) {
    if (connection) await connection.rollback();
    req.log.error({ err: error }, 'Create return error');
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getReturns, createReturn };
