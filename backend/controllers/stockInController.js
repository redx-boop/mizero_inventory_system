const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { createNotification, notifyManagement, notifyLowStock } = require('../utils/notificationHelper');
const { getDepartmentScope } = require('../middleware/departmentScope');
const { parseNumber } = require('../utils/financial');
const { isLowStock } = require('../services/inventoryRules');

const getStockIn = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      item_id, department_id, status,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT si.*, i.name as item_name, i.sku as item_sku,
             d.name as department_name, u.full_name as created_by_name,
             s.name as supplier_name, s.supplier_type as supplier_type_name,
             s.contact_person as supplier_contact, s.email as supplier_email
      FROM stock_in si
      JOIN items i ON si.item_id = i.id
      LEFT JOIN departments d ON si.department_id = d.id
      LEFT JOIN users u ON si.created_by = u.id
      LEFT JOIN suppliers s ON si.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR si.supplier LIKE ? OR s.name LIKE ? OR si.reference_number LIKE ? OR si.notes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }
    if (from) { query += ' AND si.date >= ?'; params.push(from); }
    if (to) { query += ' AND si.date <= ?'; params.push(to); }
    if (item_id) { query += ' AND si.item_id = ?'; params.push(item_id); }
    if (department_id) { query += ' AND si.department_id = ?'; params.push(department_id); }

    // Department scope: stock_managers only see their department items (centralized)
    const scope = getDepartmentScope(req, 'i');
    if (scope.hasScope) {
      query += scope.clause;
      params.push(...scope.params);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns to prevent SQL injection
    const allowedSorts = { created_at: 'si.created_at', date: 'si.date', item_name: 'i.name', quantity: 'si.quantity', supplier: 'si.supplier', unit_price: 'si.unit_price', total_cost: 'si.total_cost', reference_number: 'si.reference_number' };
    const sortCol = allowedSorts[sortBy] || 'si.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get stock in error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createStockIn = async (req, res) => {
  let connection;
  try {
    const { item_id, quantity, unit_price, supplier_id, supplier, supplier_type, reference_number, notes, date, department_id } = req.body;

    // Validate unit_price is a positive number
    const price = parseNumber(unit_price);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'Unit price must be a non-negative number.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🔒 Row-level lock on the item to prevent concurrent stock mutations
    const [items] = await connection.query('SELECT * FROM items WHERE id = ? FOR UPDATE', [item_id]);
    if (!items.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Item not found.' });
    }

    // If supplier_id is provided, resolve its name and type for backward-compatible columns
    let resolvedSupplier = supplier || null;
    let resolvedSupplierType = supplier_type || null;
    if (supplier_id) {
      const [suppliers] = await pool.query('SELECT name, supplier_type FROM suppliers WHERE id = ?', [supplier_id]);
      if (suppliers.length) {
        resolvedSupplier = suppliers[0].name;
        resolvedSupplierType = resolvedSupplierType || suppliers[0].supplier_type || resolvedSupplierType;
      }
    }

    const [result] = await connection.query(
      'INSERT INTO stock_in (item_id, quantity, unit_price, supplier_id, supplier, supplier_type, reference_number, notes, date, department_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [item_id, quantity, price, supplier_id || null, resolvedSupplier, resolvedSupplierType, reference_number || null, notes || null, date || new Date(), department_id || null, req.user.id]
    );

    // Update item quantity
    await connection.query('UPDATE items SET quantity = quantity + ? WHERE id = ?', [quantity, item_id]);

    // CRITICAL: Weighted Average Cost (AVCO) recalculation
    await connection.query(`
      UPDATE items i
      JOIN (
        SELECT
          item_id,
          ROUND(COALESCE(SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0), 0), 2) AS new_avg
        FROM stock_in
        WHERE item_id = ?
        GROUP BY item_id
      ) avg ON avg.item_id = i.id
      SET i.unit_cost = avg.new_avg
      WHERE i.id = ?
    `, [item_id, item_id]);

    await connection.commit();

    const [updatedItem] = await pool.query('SELECT * FROM items WHERE id = ?', [item_id]);
    await logActivity(req.user.id, 'stock_in', 'inventory', `Stock in: ${quantity} of ${updatedItem[0].name} @ ${price}/${updatedItem[0].currency || 'RWF'}`);

    const stockInMsg = `${quantity} ${updatedItem[0].unit}(s) of ${updatedItem[0].name} recorded as stock in. New quantity: ${updatedItem[0].quantity + quantity}.`;
    await createNotification(
      req.user.id,
      'Stock In Recorded',
      stockInMsg,
      'stock_in',
      result.insertId,
      'success',
      '/stock-in'
    );
    await notifyManagement(
      'Stock In Recorded',
      stockInMsg,
      'stock_in',
      result.insertId,
      req.user.id,
      'success',
      '/stock-in'
    );

    if (isLowStock(updatedItem[0])) {
      await notifyLowStock(updatedItem[0]);
    }

    res.status(201).json({ id: result.insertId, message: 'Stock in recorded successfully.', unit_cost: updatedItem[0].unit_cost });
  } catch (error) {
    if (connection) await connection.rollback();
    req.log.error({ err: error }, 'Create stock in error');
    res.status(500).json({ message: 'Server error.' });
  } finally {
    if (connection) connection.release();
  }
};

const getStockInReceipt = async (req, res) => {
  try {
    const [records] = await pool.query(
      `SELECT si.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM stock_in si
       JOIN items i ON si.item_id = i.id
       LEFT JOIN users u ON si.created_by = u.id
       WHERE si.id = ?`,
      [req.params.id]
    );

    if (!records.length) return res.status(404).json({ message: 'Stock in record not found.' });

    res.json(records[0]);
  } catch (error) {
    req.log.error({ err: error }, 'Get stock in receipt error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getStockIn, createStockIn, getStockInReceipt };
