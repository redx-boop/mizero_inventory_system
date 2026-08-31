const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { parseNumber } = require('../utils/financial');

const getLeftovers = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      item_id, recipient, stock_out_id,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT l.*, so.recipient, so.quantity as issued_quantity, i.name as item_name, i.sku as item_sku,
             u.full_name as created_by_name,
             COALESCE(lr.total_returned, 0) as already_returned,
             (so.quantity - COALESCE(lr.total_returned, 0)) as remaining_qty
      FROM leftovers l
      JOIN stock_out so ON l.stock_out_id = so.id
      JOIN items i ON so.item_id = i.id
      LEFT JOIN users u ON l.created_by = u.id
      LEFT JOIN (
        SELECT stock_out_id, SUM(CAST(returned_quantity AS DECIMAL(14,2))) as total_returned
        FROM leftovers
        GROUP BY stock_out_id
      ) lr ON lr.stock_out_id = so.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR so.recipient LIKE ? OR l.notes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) { query += ' AND l.created_at >= ?'; params.push(from); }
    if (to) { query += ' AND l.created_at <= ?'; params.push(`${to} 23:59:59`); }
    if (item_id) { query += ' AND so.item_id = ?'; params.push(item_id); }
    if (recipient) { query += ' AND so.recipient LIKE ?'; params.push(`%${recipient}%`); }
    if (stock_out_id) { query += ' AND so.id = ?'; params.push(stock_out_id); }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'l.created_at', item_name: 'i.name', recipient: 'so.recipient', issued_quantity: 'so.quantity', returned_quantity: 'l.returned_quantity' };
    const sortCol = allowedSorts[sortBy] || 'l.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    // Convert all numeric values to numbers before sending to frontend
    const sanitized = records.map(r => ({
      ...r,
      issued_quantity: Number(r.issued_quantity) || 0,
      already_returned: Number(r.already_returned) || 0,
      remaining_qty: Number(r.remaining_qty) || 0,
      returned_quantity: Number(r.returned_quantity) || 0
    }));

    res.json({ records: sanitized, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get leftovers error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createLeftover = async (req, res) => {
  try {
    const { stock_out_id, returned_quantity, notes } = req.body;

    // STEP 1: Convert input to numbers immediately
    const stockOutIdNum = Number(stock_out_id);
    const returnedQtyNum = Number(returned_quantity);

    // STEP 2: (validation continues below)

    // STEP 3: Load the stock-out record
    const [stockOuts] = await pool.query(
      'SELECT so.*, i.name as item_name FROM stock_out so JOIN items i ON so.item_id = i.id WHERE so.id = ?',
      [stockOutIdNum]
    );
    if (!stockOuts.length) {
      return res.status(404).json({ message: 'Stock out record not found.' });
    }

    // STEP 4: Convert issued quantity to number
    const issuedQuantity = Number(stockOuts[0].quantity) || 0;

    // STEP 5: First validation - single return cannot exceed issued
    if (returnedQtyNum > issuedQuantity) {
      return res.status(400).json({
        message: 'Returned quantity cannot exceed the issued quantity.',
        issued: issuedQuantity,
        attempted_return: returnedQtyNum
      });
    }

    // STEP 6: Calculate already-returned quantity
    const [existingReturns] = await pool.query(
      'SELECT COALESCE(SUM(CAST(returned_quantity AS DECIMAL(14,2))), 0) as total_returned FROM leftovers WHERE stock_out_id = ?',
      [stockOutIdNum]
    );
    const alreadyReturned = Number(existingReturns[0].total_returned) || 0;

    // STEP 7: Calculate projected total
    const totalAfterThisReturn = alreadyReturned + returnedQtyNum;

    if (totalAfterThisReturn > issuedQuantity) {
      return res.status(400).json({
        message: 'Total returned quantity exceeds the issued quantity.',
        issued: issuedQuantity,
        already_returned: alreadyReturned,
        attempting_return: returnedQtyNum
      });
    }

    // STEP 8: Get unit_cost_at_time for valuation
    const unitCostAtTime = parseNumber(stockOuts[0].unit_cost_at_time);

    // STEP 9: Insert the leftover return record
    const [result] = await pool.query(
      'INSERT INTO leftovers (stock_out_id, returned_quantity, unit_cost_at_time, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [stockOutIdNum, returnedQtyNum, unitCostAtTime, notes || null, req.user.id]
    );

    // STEP 10: Update item quantity back to inventory
    await pool.query('UPDATE items SET quantity = quantity + ? WHERE id = ?', [returnedQtyNum, stockOuts[0].item_id]);

    await logActivity(
      req.user.id,
      'leftover_return',
      'inventory',
      `Returned unused stock: ${returnedQtyNum} of ${stockOuts[0].item_name}${unitCostAtTime > 0 ? ` (value: ${(returnedQtyNum * unitCostAtTime).toFixed(2)})` : ''}`
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Leftover return recorded successfully.',
      unit_cost_at_time: unitCostAtTime,
      total_returned_after: totalAfterThisReturn,
      remaining_after: issuedQuantity - totalAfterThisReturn
    });
  } catch (error) {
    req.log.error({ err: error }, 'Create leftover error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getLeftovers, createLeftover };
