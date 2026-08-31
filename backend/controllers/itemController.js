const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { notifyManagement, notifyLowStock } = require('../utils/notificationHelper');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { sanitizeCsvRow } = require('../utils/csvSanitizer');
const { getDepartmentScope } = require('../middleware/departmentScope');
const { parseNumber, calculateInventoryValue } = require('../utils/financial');
const { isLowStock } = require('../services/inventoryRules');

const generateSku = () => {
  const prefix = 'INV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const getItems = async (req, res) => {
  try {
    const { search, category, department_id, item_type, low_stock, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT i.*, d.name as department_name, u.full_name as created_by_name
      FROM items i
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.deleted_at IS NULL
    `;
    const params = [];

    if (search) {
      // Use LIKE search for now. FULLTEXT with MATCH AGAINST can be enabled after
      // running migration-019-fulltext-search.sql to create FULLTEXT indexes.
      // TODO: Upgrade to: MATCH(i.name, i.sku, i.category, i.description) AGAINST(? IN BOOLEAN MODE)
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR i.category LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category) {
      query += ' AND i.category = ?';
      params.push(category);
    }
    if (department_id) {
      query += ' AND i.department_id = ?';
      params.push(department_id);
    }
    if (item_type) {
      query += ' AND i.item_type = ?';
      params.push(item_type);
    }
    if (low_stock === 'true' || low_stock === '1') {
      query += ' AND i.quantity <= i.minimum_stock';
    }

    // Department scope: stock_managers only see their department items (centralized)
    const scope = getDepartmentScope(req, 'i');
    if (scope.hasScope) {
      query += scope.clause;
      params.push(...scope.params);
    }

    const countQuery = query.replace('SELECT i.*, d.name as department_name, u.full_name as created_by_name', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    let resultItems = await pool.query(query, params);
    let items = resultItems[0];

    // CRITICAL: Staff users must NOT see item quantities
    if (req.user.role_name === 'staff') {
      items = items.map(({ quantity, minimum_stock, unit_cost, ...rest }) => rest);
    }

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    req.log.error({ err: error }, 'Get items error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getItem = async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT i.*, d.name as department_name, u.full_name as created_by_name
       FROM items i
       LEFT JOIN departments d ON i.department_id = d.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = ?`,
      [req.params.id]
    );
    if (!items.length) return res.status(404).json({ message: 'Item not found.' });
    const item = items[0];

    // CRITICAL: Staff users must NOT see item quantities
    if (req.user.role_name === 'staff') {
      const { quantity, minimum_stock, unit_cost, ...rest } = item;
      return res.json(rest);
    }

    res.json(item);
  } catch (error) {
    req.log.error({ err: error }, 'Get item error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createItem = async (req, res) => {
  try {
    const { name, description, category, unit, quantity, minimum_stock, item_type, department_id, unit_cost, currency } = req.body;
    const sku = generateSku();

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }

    const [result] = await pool.query(
      'INSERT INTO items (sku, name, description, category, unit, quantity, minimum_stock, unit_cost, currency, item_type, department_id, created_by, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [sku, name, description, category || null, unit || 'pcs', quantity || 0, minimum_stock || 0, unit_cost || 0, currency || 'RWF', item_type || 'consumable', department_id || null, req.user.id, imageUrl]
    );

    await logActivity(req.user.id, 'create', 'inventory', `Created item: ${name} (SKU: ${sku})${unit_cost ? ` @ ${unit_cost} ${currency || 'RWF'}/unit` : ''}`);

    await notifyManagement(
      'New Item Added',
      `Item "${name}" (SKU: ${sku}) has been added by ${req.user.full_name}.${unit_cost ? ` Cost: ${unit_cost} ${currency || 'RWF'}/unit.` : ''}`,
      'inventory',
      result.insertId,
      req.user.id,
      'info',
      '/inventory'
    );

    if (isLowStock({ quantity, minimum_stock, deleted_at: null })) {
      await notifyLowStock({ name, sku, quantity, minimum_stock });
    }

    res.status(201).json({ id: result.insertId, sku, message: 'Item created successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Create item error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateItem = async (req, res) => {
  try {
    const { name, description, category, unit, minimum_stock, item_type, department_id, unit_cost, currency } = req.body;

    // CRITICAL: quantity is NOT editable via PUT /items/:id.
    // All quantity changes must go through stock-in, stock-out, or adjustments
    // to maintain inventory formula integrity.
    const [items] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!items.length) return res.status(404).json({ message: 'Item not found.' });
    const item = items[0];

    // Handle image upload (only if a new image is provided)
    let imageUrl = item.image_url;
    if (req.file) {
      imageUrl = '/uploads/' + req.file.filename;
    }

    await pool.query(
      'UPDATE items SET name = ?, description = ?, category = ?, unit = ?, minimum_stock = ?, unit_cost = ?, currency = ?, item_type = ?, department_id = ?, image_url = ? WHERE id = ?',
      [name, description, category || null, unit, minimum_stock, unit_cost !== undefined ? unit_cost : item.unit_cost, currency || item.currency, item_type, department_id || null, imageUrl, req.params.id]
    );

    await logActivity(req.user.id, 'update', 'inventory', `Updated item ID: ${req.params.id} - ${name}`);

    await notifyManagement(
      'Item Updated',
      `Item "${name}" (ID: ${req.params.id}) has been updated by ${req.user.full_name}.`,
      'inventory',
      parseInt(req.params.id),
      req.user.id,
      'info',
      '/inventory'
    );

    if (isLowStock(item)) {
      await notifyLowStock(item);
    }

    res.json({ message: 'Item updated successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Update item error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const [item] = await pool.query('SELECT id, name FROM items WHERE id = ?', [req.params.id]);
    if (!item.length) return res.status(404).json({ message: 'Item not found.' });

    // Soft-delete: set deleted_at timestamp instead of removing the row.
    // This preserves historical JOINs in stock_in, stock_out, borrowings, etc.
    await pool.query('UPDATE items SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'delete', 'inventory', `Soft-deleted item: ${item[0].name} (ID: ${req.params.id})`);

    await notifyManagement(
      'Item Deleted',
      `Item "${item[0].name}" (ID: ${req.params.id}) has been deleted by ${req.user.full_name}. Historical data preserved.`,
      'inventory',
      parseInt(req.params.id),
      req.user.id,
      'danger',
      '/inventory'
    );

    res.json({ message: 'Item deleted successfully. Historical data preserved via soft-delete.' });
  } catch (error) {
    req.log.error({ err: error }, 'Delete item error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const exportCsv = async (req, res) => {
  try {
    const { department_id, category } = req.query;
    let query = 'SELECT * FROM items WHERE deleted_at IS NULL';
    const params = [];

    if (department_id) { query += ' AND department_id = ?'; params.push(department_id); }
    if (category) { query += ' AND category = ?'; params.push(category); }

    const [items] = await pool.query(query, params);
    // Add computed total_value to each row
    const itemsWithValue = items.map(item => ({
      ...item,
      total_value: calculateInventoryValue(item.quantity, item.unit_cost)
    }));
    const csv = stringify(itemsWithValue, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
    res.send(csv);
  } catch (error) {
    req.log.error({ err: error }, 'Export CSV error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * Supported currencies for CSV import validation
 */
const SUPPORTED_CURRENCIES = ['RWF', 'USD', 'EUR'];

/**
 * Supported item types for CSV import validation
 */
const VALID_ITEM_TYPES = ['consumable', 'non-consumable'];

/**
 * Official CSV column headers (order-independent)
 * NOTE: SKU is NOT included — it is auto-generated by the system.
 */
const CSV_COLUMNS = ['name', 'category', 'unit', 'quantity', 'minimum_stock', 'item_type', 'department', 'unit_cost', 'currency'];

/**
 * Validate a single CSV import row
 * @returns {Array<{field: string, error: string}>} Array of validation errors
 */
function validateImportRow(row, rowIndex, departmentsByName) {
  const errors = [];
  const rowLabel = `Row ${rowIndex}`;

  // SKU is NOT imported from CSV — it is auto-generated by the system.
  // No SKU validation needed.


  // Name
  if (!row.name || !row.name.trim()) {
    errors.push({ row: rowIndex, field: 'name', error: 'Item name is required.' });
  }

  // Quantity
  const qty = parseInt(row.quantity);
  if (row.quantity === undefined || row.quantity === null || row.quantity === '') {
    errors.push({ row: rowIndex, field: 'quantity', error: 'Quantity is required.' });
  } else if (isNaN(qty) || qty < 0) {
    errors.push({ row: rowIndex, field: 'quantity', error: 'Quantity must be a non-negative number.' });
  }

  // Minimum Stock
  const minStock = parseInt(row.minimum_stock);
  if (row.minimum_stock === undefined || row.minimum_stock === null || row.minimum_stock === '') {
    errors.push({ row: rowIndex, field: 'minimum_stock', error: 'Minimum stock is required.' });
  } else if (isNaN(minStock) || minStock < 0) {
    errors.push({ row: rowIndex, field: 'minimum_stock', error: 'Minimum stock must be a non-negative number.' });
  }

  // Unit Cost
  const cost = parseNumber(row.unit_cost);
  if (row.unit_cost === undefined || row.unit_cost === null || row.unit_cost === '') {
    errors.push({ row: rowIndex, field: 'unit_cost', error: 'Unit cost is required.' });
  } else if (isNaN(cost) || cost < 0) {
    errors.push({ row: rowIndex, field: 'unit_cost', error: 'Unit cost must be a non-negative number.' });
  }

  // Currency
  if (!row.currency || !row.currency.trim()) {
    errors.push({ row: rowIndex, field: 'currency', error: 'Currency is required.' });
  } else if (!SUPPORTED_CURRENCIES.includes(row.currency.trim().toUpperCase())) {
    errors.push({ row: rowIndex, field: 'currency', error: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}. Got: "${row.currency}"` });
  }

  // Item Type
  if (!row.item_type || !row.item_type.trim()) {
    errors.push({ row: rowIndex, field: 'item_type', error: 'Item type is required.' });
  } else if (!VALID_ITEM_TYPES.includes(row.item_type.trim().toLowerCase())) {
    errors.push({ row: rowIndex, field: 'item_type', error: `Item type must be "consumable" or "non-consumable". Got: "${row.item_type}"` });
  }

  // Department (look up by name)
  if (!row.department || !row.department.trim()) {
    errors.push({ row: rowIndex, field: 'department', error: 'Department is required.' });
  } else if (!departmentsByName.has(row.department.trim())) {
    const validDepts = [...departmentsByName.keys()].join(', ');
    errors.push({ row: rowIndex, field: 'department', error: `Department "${row.department.trim()}" not found. Valid departments: ${validDepts}` });
  }

  return errors;
}

/**
 * POST /api/items/import/csv/preview — Validate CSV without importing
 * Returns detailed validation results for frontend preview
 */
const previewImportCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required.' });

    const csvData = req.file.buffer.toString();
    let records;
    try {
      records = parse(csvData, { columns: true, skip_empty_lines: true, relax_column_count: true });
    } catch (parseError) {
      return res.status(400).json({
        message: 'Failed to parse CSV file. Check the file format.',
        error: parseError.message
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty or has no data rows.' });
    }

    if (records.length > 5000) {
      return res.status(400).json({ message: `CSV file contains ${records.length} rows. Maximum allowed is 5000 rows.` });
    }

    // Build department lookup map
    const [deptRows] = await pool.query('SELECT id, name FROM departments');
    const departmentsByName = new Map(deptRows.map(d => [d.name, d.id]));

    // Pre-fetch existing items for duplicate prediction
    const [activeItems] = await pool.query('SELECT id, name, category, department_id, item_type, quantity, unit_cost, sku FROM items WHERE deleted_at IS NULL');
    const [deletedItems] = await pool.query('SELECT id, name, category, department_id, item_type, quantity, sku FROM items WHERE deleted_at IS NOT NULL');

    // Validate each row
    const validRows = [];
    const invalidRows = [];
    let predictedConsumableMerge = 0;
    let predictedNonConsumableWarning = 0;
    let predictedRestored = 0;

    records.forEach((record, idx) => {
      // 🧹 Sanitize the row — strip whitespace, control chars, convert types
      const sanitized = sanitizeCsvRow(record);

      const rowErrors = validateImportRow(sanitized, idx + 2, departmentsByName);

      if (rowErrors.length > 0) {
        const rowWithData = { ...sanitized };
        invalidRows.push({ ...rowErrors[0], data: rowWithData, allErrors: rowErrors });
      } else {
        const deptId = departmentsByName.get(sanitized.department);

        // Predict whether this row will be merged or restored
        const isDuplicate = (item) =>
          item.name.toLowerCase() === sanitized.name.toLowerCase() &&
          (item.category || '') === (sanitized.category || '') &&
          item.department_id === deptId &&
          item.item_type === sanitized.item_type;

        if (activeItems.some(isDuplicate)) {
          // Consumables auto-merge; non-consumables need user decision
          if (sanitized.item_type === 'consumable') {
            predictedConsumableMerge++;
          } else {
            predictedNonConsumableWarning++;
          }
        } else if (deletedItems.some(isDuplicate)) {
          predictedRestored++;
        }

        validRows.push({ row: idx + 2, data: { ...sanitized } });
      }
    });

    return res.json({
      totalRows: records.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows: invalidRows.map(r => ({
        row: r.row,
        field: r.field,
        error: r.error,
        allErrors: r.allErrors,
        data: r.data
      })),
      columns: CSV_COLUMNS,
      skuAutoGenerated: true,
      predictedConsumableMerge,
      predictedNonConsumableWarning,
      predictedRestored
    });
  } catch (error) {
    req.log.error({ err: error }, 'Preview CSV error');
    return res.status(500).json({ message: 'Server error during CSV preview.', error: error.message });
  }
};

/**
 * Find an existing item that matches a CSV row by name, category, department, and type.
 * Used for duplicate detection during import.
 *
 * @param {Object} connection - Database connection (for transaction safety)
 * @param {Object} sanitized - Sanitized CSV row data
 * @param {number} deptId - Resolved department ID
 * @param {boolean} includeDeleted - Whether to search soft-deleted items
 * @returns {Promise<Object|null>} Matching item or null
 */
async function findMatchingItem(connection, sanitized, deptId, includeDeleted = false) {
  const deletedClause = includeDeleted
    ? 'deleted_at IS NOT NULL'
    : 'deleted_at IS NULL';

  const [rows] = await connection.query(
    `SELECT * FROM items
     WHERE LOWER(name) = LOWER(?)
       AND COALESCE(category, '') = COALESCE(?, '')
       AND department_id = ?
       AND item_type = ?
       AND ${deletedClause}
     LIMIT 1`,
    [sanitized.name, sanitized.category || '', deptId, sanitized.item_type]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * POST /api/items/import/csv — Import items from CSV with professional duplicate handling.
 *
 * Duplicate detection: same name + category + department + item_type
 *   - CONSUMABLE duplicates → auto-merge quantity
 *   - NON-CONSUMABLE duplicates → warn (or action if nonConsumableAction param provided)
 *   - SOFT-DELETED duplicates → restore for both types
 *
 * Query params:
 *   nonConsumableAction: 'skip' | 'create' | 'update' — what to do with non-consumable duplicates
 *     If omitted, non-consumable duplicates are skipped and returned as warnings.
 *
 * SKU is always auto-generated — never imported from CSV.
 *
 * Body: multipart/form-data with 'file' field
 */
const importCsv = async (req, res) => {
  let connection;
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required.' });

    const ncAction = req.query.nonConsumableAction || 'warn';
    if (!['warn', 'skip', 'create', 'update'].includes(ncAction)) {
      return res.status(400).json({ message: 'Invalid nonConsumableAction. Must be "warn", "skip", "create", or "update".' });
    }

    const csvData = req.file.buffer.toString();
    let records;
    try {
      records = parse(csvData, { columns: true, skip_empty_lines: true, relax_column_count: true });
    } catch (parseError) {
      return res.status(400).json({
        message: 'Failed to parse CSV file. Check the file format.',
        error: parseError.message
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty or has no data rows.' });
    }

    // Build department lookup map
    const [deptRows] = await pool.query('SELECT id, name FROM departments');
    const departmentsByName = new Map(deptRows.map(d => [d.name, d.id]));

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let inserted = 0;
    let merged = 0;
    let restored = 0;
    let nonConsumableSkipped = 0;
    let invalidSkipped = 0;
    const nonConsumableWarnings = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const sanitized = sanitizeCsvRow(record);
      const rowNum = i + 2; // 1-indexed + header row

      // Validate the row
      const rowErrors = validateImportRow(sanitized, rowNum, departmentsByName);
      if (rowErrors.length > 0) {
        invalidSkipped++;
        errors.push({ row: rowNum, field: rowErrors[0].field, error: rowErrors[0].error });
        continue;
      }

      const deptId = departmentsByName.get(sanitized.department);

      try {
        // STEP 1: Check for active duplicate (same name+category+dept+type)
        const activeMatch = await findMatchingItem(connection, sanitized, deptId, false);

        if (activeMatch) {
          if (sanitized.item_type === 'consumable') {
            // 🔄 CONSUMABLE: Auto-merge quantity
            const newQty = activeMatch.quantity + sanitized.quantity;
            const newUnitCost = sanitized.unit_cost > 0 ? sanitized.unit_cost : activeMatch.unit_cost;

            await connection.query(
              `UPDATE items SET
                quantity = ?,
                unit_cost = ?,
                minimum_stock = ?
               WHERE id = ? AND deleted_at IS NULL`,
              [newQty, newUnitCost, sanitized.minimum_stock, activeMatch.id]
            );

            await logActivity(req.user.id, 'import_csv_merge', 'inventory',
              `CSV import merged ${sanitized.quantity} consumable units into "${sanitized.name}" (${activeMatch.sku}). New qty: ${newQty}`);
            merged++;
          } else {
            // ⚠️ NON-CONSUMABLE: Apply action based on ncAction param
            if (ncAction === 'warn' || ncAction === 'skip') {
              nonConsumableSkipped++;
              if (ncAction === 'warn') {
                nonConsumableWarnings.push({
                  row: rowNum,
                  name: sanitized.name,
                  category: sanitized.category,
                  department: sanitized.department,
                  itemType: sanitized.item_type,
                  existingId: activeMatch.id,
                  existingSku: activeMatch.sku,
                  existingQty: activeMatch.quantity,
                  importQty: sanitized.quantity
                });
              }
            } else if (ncAction === 'create') {
              // Create new item anyway with auto-generated SKU
              const sku = generateSku();
              await connection.query(
                `INSERT INTO items (sku, name, category, unit, quantity, minimum_stock, unit_cost, currency, item_type, department_id, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [sku, sanitized.name, sanitized.category, sanitized.unit, sanitized.quantity,
                 sanitized.minimum_stock, sanitized.unit_cost, sanitized.currency,
                 sanitized.item_type, deptId, req.user.id]
              );
              await logActivity(req.user.id, 'import_csv_insert', 'inventory',
                `CSV import created non-consumable "${sanitized.name}" (SKU: ${sku}) — duplicate existed but was force-created`);
              inserted++;
            } else if (ncAction === 'update') {
              // Update existing item
              const newQty = activeMatch.quantity + sanitized.quantity;
              const newUnitCost = sanitized.unit_cost > 0 ? sanitized.unit_cost : activeMatch.unit_cost;
              await connection.query(
                `UPDATE items SET quantity = ?, unit_cost = ?, minimum_stock = ? WHERE id = ? AND deleted_at IS NULL`,
                [newQty, newUnitCost, sanitized.minimum_stock, activeMatch.id]
              );
              await logActivity(req.user.id, 'import_csv_merge', 'inventory',
                `CSV import updated non-consumable "${sanitized.name}" (${activeMatch.sku}) — added ${sanitized.quantity} units. New qty: ${newQty}`);
              merged++;
            }
          }
          continue;
        }

        // STEP 2: Check for soft-deleted duplicate
        const deletedMatch = await findMatchingItem(connection, sanitized, deptId, true);

        if (deletedMatch) {
          // ♻️ RESTORE: Bring soft-deleted item back and add quantity
          const newQty = deletedMatch.quantity + sanitized.quantity;
          const newUnitCost = sanitized.unit_cost > 0 ? sanitized.unit_cost : deletedMatch.unit_cost;

          await connection.query(
            `UPDATE items SET
              deleted_at = NULL,
              quantity = ?,
              unit_cost = ?,
              minimum_stock = ?,
              unit = ?,
              currency = ?
             WHERE id = ?`,
            [newQty, newUnitCost, sanitized.minimum_stock, sanitized.unit, sanitized.currency, deletedMatch.id]
          );

          await logActivity(req.user.id, 'import_csv_restore', 'inventory',
            `CSV import restored soft-deleted item "${sanitized.name}" (SKU: ${deletedMatch.sku}). Added ${sanitized.quantity} units. New qty: ${newQty}`);
          restored++;
          continue;
        }

        // STEP 3: No match found — create NEW item with auto-generated SKU
        const sku = generateSku();
        await connection.query(
          `INSERT INTO items (sku, name, category, unit, quantity, minimum_stock, unit_cost, currency, item_type, department_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sku, sanitized.name, sanitized.category, sanitized.unit, sanitized.quantity,
           sanitized.minimum_stock, sanitized.unit_cost, sanitized.currency,
           sanitized.item_type, deptId, req.user.id]
        );

        await logActivity(req.user.id, 'import_csv_insert', 'inventory',
          `CSV import created new item "${sanitized.name}" (SKU: ${sku}) with qty ${sanitized.quantity}`);
        inserted++;
      } catch (rowErr) {
        errors.push({ row: rowNum, field: 'general', error: rowErr.message });
      }
    }

    await connection.commit();

    // Log the import activity summary
    const fileName = req.file.originalname || 'unknown.csv';
    let logDesc = `CSV import (${fileName}): ${inserted} inserted, ${merged} merged, ${restored} restored`;
    if (nonConsumableSkipped > 0) logDesc += `, ${nonConsumableSkipped} non-consumable skipped (decision needed)`;
    if (invalidSkipped > 0) logDesc += `, ${invalidSkipped} invalid rows skipped`;
    if (errors.length > 0) logDesc += `, ${errors.length} row errors`;
    await logActivity(req.user.id, 'import_csv', 'inventory', logDesc);

    await notifyManagement(
      'Stock Imported',
      `CSV import completed by ${req.user.full_name}: ${inserted} new, ${merged} merged, ${restored} restored${nonConsumableSkipped > 0 ? `, ${nonConsumableSkipped} non-consumable pending` : ''}${invalidSkipped > 0 ? `, ${invalidSkipped} skipped` : ''}.`,
      'inventory',
      null,
      req.user.id,
      'success',
      '/inventory'
    );

    const parts = [];
    if (inserted > 0) parts.push(`${inserted} inserted`);
    if (merged > 0) parts.push(`${merged} merged`);
    if (restored > 0) parts.push(`${restored} restored`);
    if (nonConsumableSkipped > 0) parts.push(`${nonConsumableSkipped} non-consumable pending`);
    if (invalidSkipped > 0) parts.push(`${invalidSkipped} skipped (invalid)`);
    const message = `Import complete. ${parts.join(', ')}.`;

    return res.json({
      message,
      totalRows: records.length,
      inserted,
      merged,
      restored,
      nonConsumableSkipped,
      nonConsumableWarnings: nonConsumableWarnings.length > 0 ? nonConsumableWarnings : undefined,
      invalidSkipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    if (connection) await connection.rollback();
    req.log.error({ err: error }, 'Import CSV error');
    return res.status(500).json({ message: 'Failed to import CSV. All changes rolled back.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/items/export/csv/template — Download the official CSV template
 * NOTE: SKU column is NOT included — SKUs are auto-generated by the system.
 */
const downloadTemplate = async (req, res) => {
  try {
    const [depts] = await pool.query('SELECT name FROM departments ORDER BY name');
    const deptNames = depts.map(d => d.name);

    // Build the template CSV with the official format (NO sku column — auto-generated)
    const templateData = [
      CSV_COLUMNS,
      ['Dell Latitude Laptop', 'Electronics', 'pcs', '10', '2', 'non-consumable', deptNames[0] || 'General Store', '850000', 'RWF'],
      ['Office Chair', 'Furniture', 'pcs', '25', '5', 'non-consumable', deptNames[1] || 'General Store', '150000', 'RWF'],
      ['Office Paper A4', 'Office Supplies', 'ream', '100', '20', 'consumable', deptNames[0] || 'General Store', '12000', 'RWF'],
      ['Ballpoint Pens Blue', 'Office Supplies', 'box', '200', '10', 'consumable', deptNames[0] || 'General Store', '5000', 'RWF'],
    ];

    const csv = stringify(templateData, { header: false });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-import-template.csv');
    res.send(csv.trim());
  } catch (error) {
    req.log.error({ err: error }, 'Template CSV error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getCategories = async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND deleted_at IS NULL ORDER BY category');
    res.json(categories.map(c => c.category));
  } catch (error) {
    req.log.error({ err: error }, 'Get categories error');
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * GET /api/items/grouped — Returns items grouped by department with summary stats.
 * This powers the department-centered inventory UI.
 *
 * Query params:
 *   search      — Filter by name/SKU/category (across all departments)
 *   category    — Filter by category
 *   item_type   — Filter by item type
 *   low_stock   — 'true' | '1' to filter low stock items
 *   department_id — Filter to a single department
 */
const getGroupedItems = async (req, res) => {
  try {
    const { search, category, item_type, low_stock, department_id } = req.query;

    let query = `
      SELECT i.*, d.name as department_name, u.full_name as created_by_name
      FROM items i
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.deleted_at IS NULL
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR i.category LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category) {
      query += ' AND i.category = ?';
      params.push(category);
    }
    if (item_type) {
      query += ' AND i.item_type = ?';
      params.push(item_type);
    }
    if (low_stock === 'true' || low_stock === '1') {
      query += ' AND i.quantity <= i.minimum_stock';
    }
    if (department_id) {
      query += ' AND i.department_id = ?';
      params.push(department_id);
    }

    // Staff scope — use the already-imported getDepartmentScope
    const scope = getDepartmentScope(req, 'i');
    if (scope.hasScope) {
      query += scope.clause;
      params.push(...scope.params);
    }

    query += ' ORDER BY d.name ASC, i.name ASC';

    let [items] = await pool.query(query, params);

    // Group items by department_id (compute totals BEFORE stripping staff data)
    const departmentsMap = new Map();

    // First, fetch all departments for consistent ordering
    const [deptRows] = await pool.query('SELECT id, name FROM departments ORDER BY name');
    const allDepts = deptRows.reduce((map, d) => {
      map.set(d.id, { id: d.id, name: d.name, items: [], item_count: 0, total_quantity: 0, total_value: 0, low_stock_count: 0 });
      return map;
    }, new Map());

    // Populate items into departments
    for (const item of items) {
      const deptId = item.department_id;
      if (!deptId) continue; // Skip items without department

      if (!allDepts.has(deptId)) {
        // Item belongs to a department not returned by active depts query
        // This shouldn't happen, but handle gracefully
        continue;
      }

      const dept = allDepts.get(deptId);
      dept.items.push(item);
      dept.item_count++;
      dept.total_quantity = Number(dept.total_quantity) + Number(item.quantity);
      dept.total_value = Number(dept.total_value) + (Number(item.quantity) * Number(item.unit_cost || 0));
      if (Number(item.quantity) <= Number(item.minimum_stock)) {
        dept.low_stock_count++;
      }
    }

    // CRITICAL: Staff users must NOT see item quantities — strip AFTER grouping
    if (req.user.role_name === 'staff') {
      for (const [, dept] of allDepts) {
        dept.items = dept.items.map(({ quantity, minimum_stock, unit_cost, ...rest }) => rest);
      }
    }

    // Filter out empty departments if a specific department was requested
    // or if we're searching/filtering (only show departments with matching items)
    let resultDepts;
    if (department_id) {
      // Only return the requested department (even if empty)
      resultDepts = String(department_id).split(',').map(id => allDepts.get(Number(id.trim()))).filter(Boolean);
    } else if (search || category || item_type || low_stock) {
      // Only return departments that have matching items
      resultDepts = Array.from(allDepts.values()).filter(d => d.item_count > 0);
    } else {
      // Return all departments
      resultDepts = Array.from(allDepts.values());
    }

    // Compute totals across all departments
    const totals = {
      total_items: resultDepts.reduce((sum, d) => sum + d.item_count, 0),
      total_quantity: resultDepts.reduce((sum, d) => sum + d.total_quantity, 0),
      total_value: resultDepts.reduce((sum, d) => sum + d.total_value, 0),
      low_stock_count: resultDepts.reduce((sum, d) => sum + d.low_stock_count, 0),
      department_count: resultDepts.length,
    };

    res.json({
      departments: resultDepts,
      totals,
    });
  } catch (error) {
    req.log.error({ err: error }, 'Get grouped items error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getItems, getItem, createItem, updateItem, deleteItem, exportCsv, importCsv, previewImportCsv, downloadTemplate, getCategories, getGroupedItems };
