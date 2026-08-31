const pool = require('../config/db');
const { parseNumber, calculateBudgetRemaining } = require('../utils/financial');

/**
 * Extract pagination params from query, with defaults
 */
function getPagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Build standard report response with pagination wrapper
 */
function buildReportResponse(data, pagination) {
  return {
    ...data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit)
    }
  };
}

// ──────────────────────────────────────────────
//  Inventory Status Report
// ──────────────────────────────────────────────
const getInventoryStatusReport = async (req, res) => {
  try {
    const user = req.user;
    const { page, limit, offset } = getPagination(req.query);
    const departmentId = req.query.department_id || null;

    // Build department filter clause
    const deptFilter = departmentId ? ' AND i.department_id = ?' : '';
    const deptParams = departmentId ? [departmentId] : [];

    const [totalItems] = await pool.query(
      'SELECT COUNT(*) as count FROM items WHERE deleted_at IS NULL' + (departmentId ? ' AND department_id = ?' : ''),
      departmentId ? [departmentId] : []
    );
    const [categories] = await pool.query(
      'SELECT COUNT(DISTINCT category) as count FROM items WHERE category IS NOT NULL AND deleted_at IS NULL' + (departmentId ? ' AND department_id = ?' : ''),
      departmentId ? [departmentId] : []
    );
    const [totalStock] = await pool.query(
      'SELECT COALESCE(SUM(quantity), 0) as total FROM items WHERE deleted_at IS NULL' + (departmentId ? ' AND department_id = ?' : ''),
      departmentId ? [departmentId] : []
    );
    const [lowStock] = await pool.query(
      'SELECT COUNT(*) as count FROM items WHERE quantity <= minimum_stock AND deleted_at IS NULL' + (departmentId ? ' AND department_id = ?' : ''),
      departmentId ? [departmentId] : []
    );
    const [outOfStock] = await pool.query(
      'SELECT COUNT(*) as count FROM items WHERE quantity = 0 AND deleted_at IS NULL' + (departmentId ? ' AND department_id = ?' : ''),
      departmentId ? [departmentId] : []
    );

    // Paginated items query with optional department filter
    const countQuery = 'SELECT COUNT(*) as total FROM items i WHERE i.deleted_at IS NULL' + deptFilter;
    const [countResult] = await pool.query(countQuery, deptParams);
    const total = countResult[0].total;

    const [items] = await pool.query(
      `SELECT i.sku, i.name, i.category, i.quantity, i.minimum_stock, i.unit, d.name as department
       FROM items i
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.deleted_at IS NULL${deptFilter}
       ORDER BY i.name ASC
       LIMIT ? OFFSET ?`,
      [...deptParams, limit, offset]
    );

    const [lowStockItems] = await pool.query(
      `SELECT name, quantity, minimum_stock
       FROM items
       WHERE quantity <= minimum_stock AND quantity > 0 AND deleted_at IS NULL${departmentId ? ' AND department_id = ?' : ''}`,
      departmentId ? [departmentId] : []
    );

    // Get department name if filtered
    let departmentName = null;
    if (departmentId) {
      const [deptRows] = await pool.query('SELECT name FROM departments WHERE id = ?', [departmentId]);
      departmentName = deptRows[0]?.name || null;
    }

    res.json(buildReportResponse({
      generatedBy: { full_name: user.full_name, role: user.role_name || user.role },
      generatedAt: new Date().toISOString(),
      department_id: departmentId ? Number(departmentId) : null,
      department_name: departmentName,
      summary: {
        totalItems: totalItems[0].count,
        categories: categories[0].count,
        totalStock: totalStock[0].total,
        lowStock: lowStock[0].count,
        outOfStock: outOfStock[0].count,
      },
      items,
      lowStockItems,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching report data');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Stock In Report
// ──────────────────────────────────────────────
const getStockInReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM stock_in si
       JOIN items i ON si.item_id = i.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT si.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM stock_in si
       JOIN items i ON si.item_id = i.id
       LEFT JOIN users u ON si.created_by = u.id
       ORDER BY si.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_transactions, COALESCE(SUM(si.quantity), 0) as total_quantity,
              COALESCE(SUM(si.total_cost), 0) as total_cost
       FROM stock_in si`
    );

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalTransactions: summary[0].total_transactions,
        totalQuantity: summary[0].total_quantity,
        totalCost: summary[0].total_cost,
      },
      records,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching stock in report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Stock Out Report
// ──────────────────────────────────────────────
const getStockOutReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM stock_out so
       JOIN items i ON so.item_id = i.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT so.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM stock_out so
       JOIN items i ON so.item_id = i.id
       LEFT JOIN users u ON so.created_by = u.id
       ORDER BY so.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_transactions, COALESCE(SUM(so.quantity), 0) as total_quantity,
              COALESCE(SUM(so.total_cost), 0) as total_cogs
       FROM stock_out so`
    );

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalTransactions: summary[0].total_transactions,
        totalQuantity: summary[0].total_quantity,
        totalCogs: summary[0].total_cogs,
      },
      records,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching stock out report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Adjustments Report
// ──────────────────────────────────────────────
const getAdjustmentsReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM stock_adjustments sa
       JOIN items i ON sa.item_id = i.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT sa.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM stock_adjustments sa
       JOIN items i ON sa.item_id = i.id
       LEFT JOIN users u ON sa.created_by = u.id
       ORDER BY sa.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_adjustments,
              COALESCE(SUM(CASE WHEN adjustment_type = 'increase' THEN quantity ELSE 0 END), 0) as total_increase,
              COALESCE(SUM(CASE WHEN adjustment_type = 'decrease' THEN quantity ELSE 0 END), 0) as total_decrease
       FROM stock_adjustments`
    );

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalAdjustments: summary[0].total_adjustments,
        totalIncrease: summary[0].total_increase,
        totalDecrease: summary[0].total_decrease,
      },
      records,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching adjustments report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Borrowings Report
// ──────────────────────────────────────────────
const getBorrowingsReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM borrowings b
       JOIN items i ON b.item_id = i.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT b.*, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM borrowings b
       JOIN items i ON b.item_id = i.id
       LEFT JOIN users u ON b.created_by = u.id
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_borrowings,
              COALESCE(SUM(b.quantity), 0) as total_quantity,
              SUM(CASE WHEN b.status = 'borrowed' THEN 1 ELSE 0 END) as active_count,
              SUM(CASE WHEN b.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
              SUM(CASE WHEN b.status = 'returned' THEN 1 ELSE 0 END) as returned_count
       FROM borrowings b`
    );

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalBorrowings: summary[0].total_borrowings,
        totalQuantity: summary[0].total_quantity,
        active: summary[0].active_count,
        overdue: summary[0].overdue_count,
        returned: summary[0].returned_count,
      },
      records,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching borrowings report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Returns Report
// ──────────────────────────────────────────────
const getReturnsReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM returns r
       JOIN borrowings b ON r.borrowing_id = b.id
       JOIN items i ON b.item_id = i.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT r.*, b.borrower_name, i.name as item_name, i.sku as item_sku, u.full_name as created_by_name
       FROM returns r
       JOIN borrowings b ON r.borrowing_id = b.id
       JOIN items i ON b.item_id = i.id
       LEFT JOIN users u ON r.created_by = u.id
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_returns, COALESCE(SUM(r.returned_quantity), 0) as total_quantity
       FROM returns r`
    );

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalReturns: summary[0].total_returns,
        totalQuantity: summary[0].total_quantity,
      },
      records,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching returns report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Requests Report
// ──────────────────────────────────────────────
const getRequestsReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM requests r
       JOIN items i ON r.item_id = i.id
       JOIN users req ON r.requester_id = req.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT r.*, i.name as item_name, i.sku as item_sku,
              req.full_name as requester_name, rev.full_name as reviewer_name
       FROM requests r
       JOIN items i ON r.item_id = i.id
       JOIN users req ON r.requester_id = req.id
       LEFT JOIN users rev ON r.reviewed_by = rev.id
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_requests,
              COALESCE(SUM(r.quantity), 0) as total_quantity,
              SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
              SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
              SUM(CASE WHEN r.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
              SUM(CASE WHEN r.status = 'allocated' THEN 1 ELSE 0 END) as allocated_count
       FROM requests r`
    );

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalRequests: summary[0].total_requests,
        totalQuantity: summary[0].total_quantity,
        pending: summary[0].pending_count,
        approved: summary[0].approved_count,
        rejected: summary[0].rejected_count,
        allocated: summary[0].allocated_count,
      },
      records,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching requests report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Leftovers Report
// ──────────────────────────────────────────────
const getLeftoversReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM leftovers l
       JOIN stock_out so ON l.stock_out_id = so.id
       JOIN items i ON so.item_id = i.id`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT l.*, so.recipient, so.quantity as issued_quantity, i.name as item_name, i.sku as item_sku,
              u.full_name as created_by_name,
              COALESCE(lr.total_returned, 0) as already_returned
       FROM leftovers l
       JOIN stock_out so ON l.stock_out_id = so.id
       JOIN items i ON so.item_id = i.id
       LEFT JOIN users u ON l.created_by = u.id
       LEFT JOIN (
         SELECT stock_out_id, SUM(CAST(returned_quantity AS DECIMAL(14,2))) as total_returned
         FROM leftovers
         GROUP BY stock_out_id
       ) lr ON lr.stock_out_id = so.id
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_returns, COALESCE(SUM(l.returned_quantity), 0) as total_quantity
       FROM leftovers l`
    );

    const sanitized = records.map(r => ({
      ...r,
      issued_quantity: Number(r.issued_quantity) || 0,
      already_returned: Number(r.already_returned) || 0,
      returned_quantity: Number(r.returned_quantity) || 0,
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalReturns: summary[0].total_returns,
        totalQuantity: summary[0].total_quantity,
      },
      records: sanitized,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching leftovers report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Damage Liabilities Report
// ──────────────────────────────────────────────
const getDamageLiabilitiesReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM damage_liabilities dl`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT dl.*, u.full_name as created_by_name
       FROM damage_liabilities dl
       LEFT JOIN users u ON dl.created_by = u.id
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total_liabilities,
              COALESCE(SUM(dl.total_amount), 0) as total_amount,
              COALESCE(SUM(dl.paid_quantity * dl.unit_cost), 0) as total_paid,
              SUM(CASE WHEN dl.status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
              SUM(CASE WHEN dl.status = 'partially_paid' THEN 1 ELSE 0 END) as partially_paid_count,
              SUM(CASE WHEN dl.status = 'paid' THEN 1 ELSE 0 END) as paid_count
       FROM damage_liabilities dl`
    );

    const sanitized = records.map(r => ({
      ...r,
      quantity: Number(r.quantity) || 0,
      paid_quantity: Number(r.paid_quantity) || 0,
      remaining_quantity: Number(r.remaining_quantity) || 0,
      unit_cost: Number(r.unit_cost) || 0,
      total_amount: Number(r.total_amount) || 0,
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalLiabilities: summary[0].total_liabilities,
        totalAmount: summary[0].total_amount,
        totalPaid: summary[0].total_paid,
        unpaid: summary[0].unpaid_count,
        partiallyPaid: summary[0].partially_paid_count,
        paid: summary[0].paid_count,
      },
      records: sanitized,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching damage liabilities report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Single Department Report
// ──────────────────────────────────────────────
const getSingleDepartmentReport = async (req, res) => {
  try {
    const user = req.user;
    const deptId = req.params.departmentId;
    const currentYear = new Date().getFullYear();

    // 🛡️ Staff users can only access their own department
    const isStaff = user.role_name === 'staff';
    const userDeptIds = user.department_ids || [];
    if (isStaff && !userDeptIds.includes(Number(deptId))) {
      return res.status(403).json({ message: 'Access denied. You can only view reports for your own department.' });
    }

    // 1. Department info
    const [deptRows] = await pool.query('SELECT * FROM departments WHERE id = ?', [deptId]);
    if (!deptRows.length) return res.status(404).json({ message: 'Department not found.' });
    const department = deptRows[0];

    // 2. Inventory summary for this department
    const [summaryRow] = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        COALESCE(SUM(quantity), 0) as total_stock,
        COALESCE(SUM(quantity * unit_cost), 0) as total_value,
        COUNT(DISTINCT category) as total_categories,
        SUM(CASE WHEN quantity <= minimum_stock THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM items WHERE deleted_at IS NULL AND department_id = ?
    `, [deptId]);

    // 3. All items in this department
    const [items] = await pool.query(`
      SELECT i.*, d.name as department_name
      FROM items i
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE i.deleted_at IS NULL AND i.department_id = ?
      ORDER BY i.category, i.name
    `, [deptId]);

    // 4. Low stock items
    const [lowStockItems] = await pool.query(`
      SELECT name, sku, quantity, minimum_stock, category, unit,
             (unit_cost * quantity) as total_value
      FROM items
      WHERE deleted_at IS NULL AND department_id = ?
        AND quantity <= minimum_stock
      ORDER BY name
    `, [deptId]);

    // 5. Consumables vs non-consumables breakdown
    const [typeBreakdown] = await pool.query(`
      SELECT
        COALESCE(item_type, 'consumable') as item_type,
        COUNT(*) as item_count,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(quantity * unit_cost), 0) as total_value
      FROM items
      WHERE deleted_at IS NULL AND department_id = ?
      GROUP BY item_type
    `, [deptId]);

    // 6. Stock movement summary (stock-in count + total qty, stock-out count + total qty)
    const [movementSummary] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM stock_in si JOIN items i ON si.item_id = i.id
         WHERE i.department_id = ?) as stock_in_count,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM stock_in si JOIN items i ON si.item_id = i.id
         WHERE i.department_id = ?) as stock_in_qty,
        (SELECT COALESCE(SUM(si.total_cost), 0) FROM stock_in si JOIN items i ON si.item_id = i.id
         WHERE i.department_id = ?) as stock_in_cost,
        (SELECT COUNT(*) FROM stock_out so JOIN items i ON so.item_id = i.id
         WHERE i.department_id = ?) as stock_out_count,
        (SELECT COALESCE(SUM(so.quantity), 0) FROM stock_out so JOIN items i ON so.item_id = i.id
         WHERE i.department_id = ?) as stock_out_qty,
        (SELECT COALESCE(SUM(so.total_cost), 0) FROM stock_out so JOIN items i ON so.item_id = i.id
         WHERE i.department_id = ?) as stock_out_cogs
    `, [deptId, deptId, deptId, deptId, deptId, deptId]);

    // 7. Budget utilization
    const [budgetData] = await pool.query(`
      SELECT
        b.total_budget,
        b.fiscal_year,
        COALESCE(so_cost.total_used, 0) as amount_used
      FROM budgets b
      LEFT JOIN (
        SELECT i.department_id, SUM(so.quantity * so.unit_cost_at_time) as total_used
        FROM stock_out so
        JOIN items i ON so.item_id = i.id
        WHERE i.department_id = ? AND YEAR(so.date) = ?
        GROUP BY i.department_id
      ) so_cost ON so_cost.department_id = b.department_id
      WHERE b.department_id = ? AND b.fiscal_year = ?
    `, [deptId, currentYear, deptId, currentYear]);

    // 8. Recent transactions (last 20)
    const [recentTransactions] = await pool.query(`
      SELECT 'Stock In' as type, si.date, i.name as item_name, si.quantity, si.total_cost, u.full_name as user_name
      FROM stock_in si
      JOIN items i ON si.item_id = i.id
      LEFT JOIN users u ON si.created_by = u.id
      WHERE i.department_id = ?
      UNION ALL
      SELECT 'Stock Out' as type, so.date, i.name as item_name, so.quantity, so.total_cost, u.full_name as user_name
      FROM stock_out so
      JOIN items i ON so.item_id = i.id
      LEFT JOIN users u ON so.created_by = u.id
      WHERE i.department_id = ?
      ORDER BY date DESC
      LIMIT 20
    `, [deptId, deptId]);

    res.json({
      generatedBy: { full_name: user.full_name, role: user.role_name || user.role },
      generatedAt: new Date().toISOString(),
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
      },
      summary: {
        totalItems: summaryRow[0].total_items,
        totalStock: summaryRow[0].total_stock,
        totalValue: summaryRow[0].total_value,
        totalCategories: summaryRow[0].total_categories,
        lowStockCount: summaryRow[0].low_stock_count,
        outOfStockCount: summaryRow[0].out_of_stock_count,
      },
      items,
      lowStockItems,
      typeBreakdown,
      movement: movementSummary[0],
      budget: budgetData[0] || { total_budget: 0, amount_used: 0, fiscal_year: currentYear },
      recentTransactions,
    });
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching single department report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Budget Report
// ──────────────────────────────────────────────
const getBudgetReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM budgets b
       JOIN departments d ON b.department_id = d.id`
    );
    const total = countResult[0].total;

    const [budgets] = await pool.query(
      `SELECT b.*, d.name as department_name,
              COALESCE((SELECT SUM(so.quantity * so.unit_cost_at_time)
               FROM stock_out so
               JOIN items i ON so.item_id = i.id
               WHERE i.department_id = b.department_id
               AND YEAR(so.date) = b.fiscal_year), 0) as amount_used
       FROM budgets b
       JOIN departments d ON b.department_id = d.id
       ORDER BY b.fiscal_year DESC, d.name
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT
         COALESCE(SUM(b.total_budget), 0) as total_budget,
         COALESCE(SUM(
           (SELECT COALESCE(SUM(so.quantity * so.unit_cost_at_time), 0)
            FROM stock_out so
            JOIN items i ON so.item_id = i.id
            WHERE i.department_id = b.department_id
              AND YEAR(so.date) = b.fiscal_year)
         ), 0) as total_used
       FROM budgets b`
    );

    const budgetsWithRemaining = budgets.map(b => ({
      ...b,
      total_budget: parseNumber(b.total_budget),
      amount_used: parseNumber(b.amount_used),
      amount_remaining: calculateBudgetRemaining(b.total_budget, b.amount_used),
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalBudget: summary[0].total_budget,
        totalUsed: summary[0].total_used,
        totalRemaining: Math.max(0, summary[0].total_budget - summary[0].total_used),
      },
      records: budgetsWithRemaining,
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching budget report');
    res.status(500).json({ message: 'Server error' });
  }
};

// ──────────────────────────────────────────────
//  Department Inventory Intelligence Report
// ──────────────────────────────────────────────
const getDepartmentInventoryReport = async (req, res) => {
  try {
    const user = req.user;
    const departmentId = req.query.department_id || null;
    const currentYear = new Date().getFullYear();

    // Build department filter (no table prefix — used with unaliased 'items' table)
    const dFilter = departmentId ? ' AND department_id = ?' : '';
    const dParams = departmentId ? [departmentId] : [];

    // SECTION 1: Global Summary
    const [summaryRow] = await pool.query(
      `SELECT
        COUNT(*) as total_items,
        COALESCE(SUM(quantity), 0) as total_stock,
        COALESCE(SUM(quantity * unit_cost), 0) as total_value,
        COUNT(DISTINCT category) as total_categories,
        SUM(CASE WHEN quantity <= minimum_stock THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM items WHERE deleted_at IS NULL${dFilter}`,
      dParams
    );

    // SECTION 2 & 3: Department-level summaries with items
    const [deptData] = await pool.query(
      `SELECT
        d.id as dept_id,
        d.name as dept_name,
        COUNT(i.id) as item_count,
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        COALESCE(SUM(i.quantity * i.unit_cost), 0) as total_value,
        SUM(CASE WHEN i.quantity <= i.minimum_stock THEN 1 ELSE 0 END) as low_stock_count,
        COALESCE(AVG(i.unit_cost), 0) as avg_unit_cost,
        COALESCE(MAX(i.unit_cost), 0) as max_unit_cost,
        COALESCE(MIN(NULLIF(i.unit_cost, 0)), 0) as min_unit_cost
      FROM departments d
      LEFT JOIN items i ON i.department_id = d.id AND i.deleted_at IS NULL
      GROUP BY d.id, d.name
      HAVING item_count > 0
      ORDER BY d.name`
    );

    // SECTION 4: Low stock analysis (with department context)
    let lowStockQuery = `
      SELECT i.name, i.sku, i.quantity, i.minimum_stock,
             d.name as department_name, i.category, i.unit,
             (i.unit_cost * i.quantity) as total_value
      FROM items i
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE i.deleted_at IS NULL AND i.quantity <= i.minimum_stock
    `;
    if (departmentId) lowStockQuery += ' AND i.department_id = ?';
    lowStockQuery += ' ORDER BY d.name, i.name';
    const [lowStockItems] = await pool.query(lowStockQuery, dParams);

    // SECTION 5: Inventory valuation by department
    const [valuation] = await pool.query(
      `SELECT
        d.name as department_name,
        COUNT(i.id) as item_count,
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        COALESCE(SUM(i.quantity * i.unit_cost), 0) as total_value,
        COALESCE(SUM(i.quantity * i.unit_cost) / NULLIF(SUM(i.quantity), 0), 0) as weighted_avg_cost
      FROM departments d
      LEFT JOIN items i ON i.department_id = d.id AND i.deleted_at IS NULL
      GROUP BY d.id, d.name
      HAVING item_count > 0
      ORDER BY total_value DESC`
    );

    // SECTION 6: Budget utilization by department
    const [budgetData] = await pool.query(
      `SELECT
        b.department_id,
        d.name as department_name,
        b.total_budget,
        b.fiscal_year,
        COALESCE(so_cost.total_used, 0) as amount_used
      FROM budgets b
      JOIN departments d ON b.department_id = d.id
      LEFT JOIN (
        SELECT i.department_id, SUM(so.quantity * so.unit_cost_at_time) as total_used
        FROM stock_out so
        JOIN items i ON so.item_id = i.id
        WHERE YEAR(so.date) = ?
        GROUP BY i.department_id
      ) so_cost ON so_cost.department_id = b.department_id
      WHERE b.fiscal_year = ?${departmentId ? ' AND b.department_id = ?' : ''}
      ORDER BY d.name`,
      departmentId ? [currentYear, currentYear, departmentId] : [currentYear, currentYear]
    );

    // Fetch per-department items for SECTION 3
    let itemsQuery = `
      SELECT i.*, d.name as department_name
      FROM items i
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE i.deleted_at IS NULL${dFilter}
      ORDER BY d.name, i.name
    `;
    const [allItems] = await pool.query(itemsQuery, dParams);

    // Group items by department for the PDF generator
    const deptItemsMap = {};
    for (const item of allItems) {
      const key = item.department_name || 'Unassigned';
      if (!deptItemsMap[key]) deptItemsMap[key] = [];
      deptItemsMap[key].push(item);
    }

    // Get department name if filtered
    let departmentName = null;
    if (departmentId) {
      const [deptRows] = await pool.query('SELECT name FROM departments WHERE id = ?', [departmentId]);
      departmentName = deptRows[0]?.name || null;
    }

    res.json({
      generatedBy: { full_name: user.full_name, role: user.role_name || user.role },
      generatedAt: new Date().toISOString(),
      department_id: departmentId ? Number(departmentId) : null,
      department_name: departmentName,
      // Section 1
      summary: {
        totalItems: summaryRow[0].total_items,
        totalStock: summaryRow[0].total_stock,
        totalValue: summaryRow[0].total_value,
        totalCategories: summaryRow[0].total_categories,
        lowStockCount: summaryRow[0].low_stock_count,
        outOfStockCount: summaryRow[0].out_of_stock_count,
      },
      // Section 2
      departmentSummaries: deptData,
      // Section 3
      departmentItems: deptItemsMap,
      // Section 4
      lowStockItems,
      // Section 5
      valuation,
      // Section 6
      budgetUtilization: budgetData,
    });
  } catch (error) {
    req.log.error({ err: error }, 'Error fetching department inventory report');
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getInventoryStatusReport,
  getStockInReport,
  getStockOutReport,
  getAdjustmentsReport,
  getBorrowingsReport,
  getReturnsReport,
  getRequestsReport,
  getLeftoversReport,
  getDamageLiabilitiesReport,
  getBudgetReport,
  getDepartmentInventoryReport,
  getSingleDepartmentReport,
};
