const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { notifyManagement } = require('../utils/notificationHelper');

/**
 * Extract pagination params from query
 */
function getPagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * GET /api/suppliers — List suppliers with search & pagination
 */
const getSuppliers = async (req, res) => {
  try {
    const { search, supplier_type, status } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    let where = 'WHERE s.deleted_at IS NULL';
    const params = [];

    if (search) {
      where += ' AND (s.name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ? OR s.phone LIKE ? OR s.city LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (supplier_type) {
      where += ' AND s.supplier_type = ?';
      params.push(supplier_type);
    }
    if (status) {
      where += ' AND s.status = ?';
      params.push(status);
    }

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM suppliers s ${where}`,
      params
    );
    const total = countResult[0].total;

    // Fetch
    const [suppliers] = await pool.query(
      `SELECT s.*, u.full_name as created_by_name,
              (SELECT COUNT(*) FROM stock_in si WHERE si.supplier_id = s.id) as stock_in_count
       FROM suppliers s
       LEFT JOIN users u ON s.created_by = u.id
       ${where}
       ORDER BY s.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      suppliers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    req.log.error({ err: error }, 'Get suppliers error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * GET /api/suppliers/all — Get all active suppliers (for dropdowns, no pagination)
 */
const getAllSuppliers = async (req, res) => {
  try {
    const [suppliers] = await pool.query(
      `SELECT id, name, contact_person, email, phone, city, supplier_type
       FROM suppliers
       WHERE status = 'active' AND deleted_at IS NULL
       ORDER BY name ASC`
    );
    res.json(suppliers);
  } catch (error) {
    req.log.error({ err: error }, 'Get all suppliers error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * GET /api/suppliers/:id — Get single supplier
 */
const getSupplier = async (req, res) => {
  try {
    const [suppliers] = await pool.query(
      `SELECT s.*, u.full_name as created_by_name,
              (SELECT COUNT(*) FROM stock_in WHERE supplier_id = s.id) as stock_in_count
       FROM suppliers s
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = ? AND s.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!suppliers.length) return res.status(404).json({ message: 'Supplier not found.' });
    res.json(suppliers[0]);
  } catch (error) {
    req.log.error({ err: error }, 'Get supplier error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * POST /api/suppliers — Create supplier
 */
const createSupplier = async (req, res) => {
  try {
    const {
      name, contact_person, email, phone, address, city,
      supplier_type, tax_id, payment_terms, notes
    } = req.body;

    const fieldErrors = {};
    if (!name || !name.trim()) fieldErrors.name = 'Supplier name is required';
    if (!email || !email.trim()) fieldErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fieldErrors.email = 'Invalid email format';
    if (!phone || !phone.trim()) fieldErrors.phone = 'Phone is required';
    else if (phone.trim().length < 6) fieldErrors.phone = 'Phone must be at least 6 characters';
    if (!tax_id || !tax_id.trim()) fieldErrors.tax_id = 'Tax ID is required';
    if (!address || !address.trim()) fieldErrors.address = 'Address is required';

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors: fieldErrors });
    }

    const [result] = await pool.query(
      `INSERT INTO suppliers (name, contact_person, email, phone, address, city, supplier_type, tax_id, payment_terms, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        contact_person?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        address?.trim() || null,
        city?.trim() || null,
        supplier_type || 'vendor',
        tax_id?.trim() || null,
        payment_terms?.trim() || null,
        notes?.trim() || null,
        req.user.id
      ]
    );

    await logActivity(req.user.id, 'create', 'suppliers', `Created supplier: ${name.trim()}`);

    await notifyManagement(
      'New Supplier Added',
      `Supplier "${name.trim()}" has been added by ${req.user.full_name}.`,
      'suppliers',
      result.insertId,
      req.user.id,
      'info',
      '/suppliers'
    );

    res.status(201).json({ id: result.insertId, message: 'Supplier created successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Create supplier error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * PUT /api/suppliers/:id — Update supplier
 */
const updateSupplier = async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT id, name FROM suppliers WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ message: 'Supplier not found.' });

    const {
      name, contact_person, email, phone, address, city,
      supplier_type, tax_id, payment_terms, notes, status
    } = req.body;

    const fieldErrors = {};
    if (!name || !name.trim()) fieldErrors.name = 'Supplier name is required';
    if (!email || !email.trim()) fieldErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fieldErrors.email = 'Invalid email format';
    if (!phone || !phone.trim()) fieldErrors.phone = 'Phone is required';
    else if (phone.trim().length < 6) fieldErrors.phone = 'Phone must be at least 6 characters';
    if (!tax_id || !tax_id.trim()) fieldErrors.tax_id = 'Tax ID is required';
    if (!address || !address.trim()) fieldErrors.address = 'Address is required';

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors: fieldErrors });
    }

    await pool.query(
      `UPDATE suppliers SET
        name = ?, contact_person = ?, email = ?, phone = ?, address = ?, city = ?,
        supplier_type = ?, tax_id = ?, payment_terms = ?, notes = ?, status = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        name.trim(),
        contact_person?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        address?.trim() || null,
        city?.trim() || null,
        supplier_type || 'vendor',
        tax_id?.trim() || null,
        payment_terms?.trim() || null,
        notes?.trim() || null,
        status || 'active',
        req.params.id
      ]
    );

    await logActivity(req.user.id, 'update', 'suppliers', `Updated supplier: ${name.trim()}`);

    await notifyManagement(
      'Supplier Updated',
      `Supplier "${name.trim()}" has been updated by ${req.user.full_name}.`,
      'suppliers',
      req.params.id,
      req.user.id,
      'info',
      '/suppliers'
    );

    res.json({ message: 'Supplier updated successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Update supplier error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * DELETE /api/suppliers/:id — Soft-delete supplier
 */
const deleteSupplier = async (req, res) => {
  try {
    const [existing] = await pool.query(
      'SELECT id, name FROM suppliers WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ message: 'Supplier not found.' });

    // Check if supplier has stock_in records
    const [stockCount] = await pool.query(
      'SELECT COUNT(*) as count FROM stock_in WHERE supplier_id = ?',
      [req.params.id]
    );

    await pool.query('UPDATE suppliers SET deleted_at = NOW() WHERE id = ?', [req.params.id]);

    const suffix = stockCount[0].count > 0
      ? ` (had ${stockCount[0].count} stock-in records — historical data preserved)`
      : '';
    await logActivity(req.user.id, 'delete', 'suppliers', `Soft-deleted supplier: ${existing[0].name}${suffix}`);

    res.json({ message: 'Supplier deleted successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Delete supplier error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getSuppliers,
  getAllSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
