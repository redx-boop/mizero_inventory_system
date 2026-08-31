const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { createNotification, notifyManagement } = require('../utils/notificationHelper');
const { parseNumber } = require('../utils/financial');

const getBorrowings = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      status, item_id, borrower_name, department_id,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT b.*, i.name as item_name, i.sku as item_sku, i.department_id as item_department_id,
             u.full_name as created_by_name,
             COALESCE(rt.total_returned, 0) as already_returned,
             COALESCE(dl.total_damaged, 0) as already_damaged,
             (b.quantity - COALESCE(rt.total_returned, 0) - COALESCE(dl.total_damaged, 0)) as remaining_qty
      FROM borrowings b
      JOIN items i ON b.item_id = i.id
      LEFT JOIN users u ON b.created_by = u.id
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
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR b.borrower_name LIKE ? OR b.borrower_phone LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) { query += ' AND b.borrow_date >= ?'; params.push(from); }
    if (to) { query += ' AND b.borrow_date <= ?'; params.push(to); }
    if (status) { query += ' AND b.status = ?'; params.push(status); }
    if (item_id) { query += ' AND b.item_id = ?'; params.push(item_id); }
    if (borrower_name) { query += ' AND b.borrower_name LIKE ?'; params.push(`%${borrower_name}%`); }
    if (department_id) { query += ' AND i.department_id = ?'; params.push(department_id); }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'b.created_at', borrow_date: 'b.borrow_date', due_date: 'b.due_date', item_name: 'i.name', quantity: 'b.quantity', status: 'b.status', borrower_name: 'b.borrower_name' };
    const sortCol = allowedSorts[sortBy] || 'b.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get borrowings error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createBorrowing = async (req, res) => {
  let connection;
  try {
    const { item_id, department_id, borrower_name, borrower_phone, quantity, borrow_date, due_date } = req.body;

    // Validate required fields explicitly — helps distinguish 400 from 403
    const missing = [];
    if (!item_id) missing.push('item_id');
    if (!department_id) missing.push('department_id');
    if (!borrower_name) missing.push('borrower_name');
    if (!quantity || quantity < 1) missing.push('quantity (must be > 0)');
    if (!due_date) missing.push('due_date');
    if (missing.length) {
      return res.status(400).json({
        message: `Missing or invalid required fields: ${missing.join(', ')}`,
        missing_fields: missing
      });
    }

    // Validate quantity is numeric
    if (isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
      return res.status(400).json({ message: 'Quantity must be a positive whole number.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🔒 Row-level lock on the item to prevent concurrent stock mutations
    const [items] = await connection.query(
      'SELECT * FROM items WHERE id = ? AND item_type = ? FOR UPDATE',
      [item_id, 'non-consumable']
    );
    if (!items.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'Item not found or not available for borrowing.' });
    }

    // Ensure selected item belongs to the selected department
    if (items[0].department_id !== parseInt(department_id)) {
      await connection.rollback();
      return res.status(400).json({
        message: 'The selected item does not belong to the selected department.',
        item_department: items[0].department_id,
        selected_department: parseInt(department_id)
      });
    }

    if (items[0].quantity < quantity) {
      await connection.rollback();
      return res.status(400).json({ message: 'Insufficient quantity available for borrowing.' });
    }

    // Check if borrower has any overdue items before allowing new borrows
    if (borrower_name) {
      const [overdueBorrowings] = await pool.query(
        `SELECT COUNT(*) as count FROM borrowings
         WHERE borrower_name = ? AND status = 'overdue'`,
        [borrower_name]
      );
      if (overdueBorrowings[0].count > 0) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Borrower has overdue items. Please return them before borrowing again.',
          overdue_count: overdueBorrowings[0].count
        });
      }
    }

    // CRITICAL: Snapshot the current unit_cost at time of borrowing for replacement value
    const unitCostAtTime = parseNumber(items[0].unit_cost);

    const [result] = await connection.query(
      'INSERT INTO borrowings (item_id, borrower_name, borrower_phone, quantity, unit_cost_at_time, borrow_date, due_date, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item_id, borrower_name, borrower_phone, quantity, unitCostAtTime, borrow_date, due_date, 'borrowed', req.user.id]
    );

    await connection.query('UPDATE items SET quantity = quantity - ? WHERE id = ?', [quantity, item_id]);

    await connection.commit();

    await logActivity(req.user.id, 'borrow', 'borrowing', `Borrowed ${quantity} of ${items[0].name} to ${borrower_name}${unitCostAtTime > 0 ? ` (replacement value: ${(quantity * unitCostAtTime).toFixed(2)})` : ''}`);

    // Notify management about the borrowing
    const borrowMsg = `${quantity} of ${items[0].name} borrowed by ${borrower_name}. Due: ${due_date}.${unitCostAtTime > 0 ? ` Replacement value: ${(quantity * unitCostAtTime).toFixed(2)}.` : ''}`;
    await createNotification(
      req.user.id,
      'New Borrowing',
      borrowMsg,
      'borrowing',
      result.insertId,
      'info',
      '/borrowings'
    );
    await notifyManagement(
      'New Borrowing',
      borrowMsg,
      'borrowing',
      result.insertId,
      req.user.id,
      'info',
      '/borrowings'
    );

    res.status(201).json({ id: result.insertId, message: 'Borrowing recorded successfully.', unit_cost_at_time: unitCostAtTime });
  } catch (error) {
    if (connection) await connection.rollback();
    req.log.error({ err: error }, 'Create borrowing error');
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (connection) connection.release();
  }
};

const getBorrowingReceipt = async (req, res) => {
  try {
    const [borrowings] = await pool.query(
      `SELECT b.*, i.name as item_name, i.sku as item_sku
       FROM borrowings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (!borrowings.length) return res.status(404).json({ message: 'Borrowing not found.' });

    res.json(borrowings[0]);
  } catch (error) {
    req.log.error({ err: error }, 'Get borrowing receipt error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const checkOverdue = async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE borrowings
       SET status = 'overdue'
       WHERE status = 'borrowed' AND due_date < CURDATE()`
    );

    const updatedCount = result.affectedRows;

    if (updatedCount > 0) {
      await logActivity(req.user.id, 'system', 'borrowing', `Auto-marked ${updatedCount} borrowings as overdue.`);
    }

    res.json({
      message: `Checked for overdue borrowings. ${updatedCount} updated to overdue.`,
      updated_count: updatedCount
    });
  } catch (error) {
    req.log.error({ err: error }, 'Check overdue error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getBorrowings, createBorrowing, getBorrowingReceipt, checkOverdue };
