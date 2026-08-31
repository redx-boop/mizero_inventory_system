const pool = require('../config/db');

const getDashboard = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // Run all dashboard queries in parallel via Promise.allSettled
    // Each query has a fallback to prevent one failure from killing the whole dashboard
    const results = await Promise.allSettled([

      // 1. Items summary — combines count, total stock, total value, low stock, borrowed, pending requests
      // NOTE: Every items subquery MUST include deleted_at IS NULL to exclude soft-deleted items
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM items WHERE deleted_at IS NULL) as total_items,
          (SELECT COALESCE(SUM(quantity), 0) FROM items WHERE deleted_at IS NULL) as total_stock_quantity,
          (SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM items WHERE deleted_at IS NULL) as total_inventory_value,
          (SELECT COALESCE(MAX(currency), 'RWF') FROM items WHERE deleted_at IS NULL) as currency,
          (SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND quantity <= minimum_stock) as low_stock_items,
          (SELECT COUNT(*) FROM borrowings WHERE status = 'borrowed') as borrowed_items,
          (SELECT COUNT(*) FROM requests WHERE status = 'pending') as pending_requests
      `),

      // 2. Department summary — includes low_stock_count per department
      pool.query(`
        SELECT d.id, d.name, COUNT(i.id) as items,
               COALESCE(SUM(i.quantity), 0) as total_quantity,
               COALESCE(SUM(i.quantity * i.unit_cost), 0) as total_value,
               COALESCE(SUM(CASE WHEN i.quantity <= i.minimum_stock THEN 1 ELSE 0 END), 0) as low_stock_count
        FROM departments d
        LEFT JOIN items i ON i.department_id = d.id AND i.deleted_at IS NULL
        GROUP BY d.id, d.name
      `),

      // 3. Recent activities (limited to 10)
      pool.query(`
        SELECT al.*, u.full_name as user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC LIMIT 10
      `),

      // 4. Stock-in/out chart (last 7 days)
      pool.query(`
        SELECT DATE(date) as date,
               SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as stock_in,
               SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as stock_out
        FROM (
          SELECT date, quantity, 'in' as type FROM stock_in
          UNION ALL
          SELECT date, quantity, 'out' as type FROM stock_out
        ) combined
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(date) ORDER BY date
      `),

      // 5. Category distribution — exclude soft-deleted items
      pool.query(`
        SELECT category, COUNT(*) as count
        FROM items WHERE category IS NOT NULL AND deleted_at IS NULL
        GROUP BY category ORDER BY count DESC
      `),

      // 6. Monthly financials — COGS, stock-in value, borrowed asset value,
      //    damaged cost, lost cost — all in one query
      pool.query(`
        SELECT
          (SELECT COALESCE(SUM(quantity * unit_cost_at_time), 0)
           FROM stock_out
           WHERE MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())) as cogs_this_month,
          (SELECT COALESCE(SUM(total_cost), 0)
           FROM stock_in
           WHERE MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())) as stock_in_value_month,
          (SELECT COALESCE(SUM(total_replacement_value), 0)
           FROM borrowings WHERE status = 'borrowed') as borrowed_asset_value,
          (SELECT COALESCE(SUM(replacement_cost), 0)
           FROM damage_liabilities WHERE liability_type = 'damaged') as damaged_item_cost,
          (SELECT COALESCE(SUM(replacement_cost), 0)
           FROM damage_liabilities WHERE liability_type = 'lost') as lost_item_cost
      `),

      // 7. Liability metrics — all in one query
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status IN ('pending','unpaid','partially_paid') THEN liability_amount ELSE 0 END), 0) as outstanding_value,
          COUNT(CASE WHEN status IN ('pending','unpaid','partially_paid') THEN 1 END) as outstanding_count,
          COALESCE(SUM(CASE WHEN status IN ('pending','unpaid','partially_paid') THEN amount_paid ELSE 0 END), 0) as outstanding_paid,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paid ELSE 0 END), 0) as paid_total,
          COUNT(CASE WHEN liability_type = 'damaged' AND status IN ('pending','unpaid','partially_paid') THEN 1 END) as damage_cases,
          COUNT(CASE WHEN liability_type = 'lost' AND status IN ('pending','unpaid','partially_paid') THEN 1 END) as loss_cases,
          COALESCE(SUM(liability_amount), 0) as total_liability_value,
          COUNT(CASE WHEN status IN ('pending','unpaid') THEN 1 END) as unpaid_count
        FROM damage_liabilities
      `),

      // 8. Adjustment costs this month
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN adjustment_type = 'decrease' THEN total_cost ELSE 0 END), 0) as decrease_total,
          COALESCE(SUM(CASE WHEN adjustment_type = 'increase' THEN total_cost ELSE 0 END), 0) as increase_total
        FROM stock_adjustments
        WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
      `),

      // 9. Budget summary
      pool.query(`
        SELECT
          COALESCE(SUM(total_budget), 0) as total_budget,
          COALESCE(SUM(budget_used.used), 0) as total_used
        FROM budgets b
        LEFT JOIN (
          SELECT i.department_id, SUM(so.total_cost) as used
          FROM stock_out so
          JOIN items i ON so.item_id = i.id
          WHERE YEAR(so.date) = ?
          GROUP BY i.department_id
        ) budget_used ON budget_used.department_id = b.department_id
        WHERE b.fiscal_year = ?
      `, [currentYear, currentYear]),

      // 10. Per-department budget usage (for department analytics cards)
      pool.query(`
        SELECT
          b.department_id,
          b.total_budget,
          COALESCE(so_cost.total_used, 0) as amount_used
        FROM budgets b
        LEFT JOIN (
          SELECT i.department_id, SUM(so.quantity * so.unit_cost_at_time) as total_used
          FROM stock_out so
          JOIN items i ON so.item_id = i.id
          WHERE YEAR(so.date) = ?
          GROUP BY i.department_id
        ) so_cost ON so_cost.department_id = b.department_id
        WHERE b.fiscal_year = ?
      `, [currentYear, currentYear])
    ]);

    // Helper to extract query result with fallback for rejected promises
    // MySQL2 returns [rows, fields] from query() — we only need the rows
    const extract = (result, defaultVal) => {
      if (result.status === 'fulfilled') {
        const [rows] = result.value;
        return rows ?? defaultVal;
      }
      return defaultVal;
    };

    // Safe extraction with fallback defaults
    const rawItems = extract(results[0], [{}]);
    const deptSummary = extract(results[1], []);
    const recentActivities = extract(results[2], []);
    const stockChart = extract(results[3], []);
    const categoryData = extract(results[4], []);
    const financialMonth = extract(results[5], [[{}]]);
    const liabilityMetrics = extract(results[6], [[{}]]);
    const adjCosts = extract(results[7], [[{}]]);
    const budgetSummary = extract(results[8], [[{}]]);

    // Extract and sanitize values
    const s = rawItems[0] || {};
    const fin = financialMonth[0] || {};
    const liab = liabilityMetrics[0] || {};
    const adj = adjCosts[0] || {};
    const bgt = budgetSummary[0] || {};
    const deptBudgets = extract(results[9], []);

    // Merge budget data into department summary
    const deptBudgetMap = new Map();
    for (const db of deptBudgets) {
      deptBudgetMap.set(db.department_id, {
        total_budget: db.total_budget,
        amount_used: db.amount_used || 0,
        usage_pct: db.total_budget > 0 ? Math.round((db.amount_used / db.total_budget) * 100) : 0,
      });
    }

    const deptSummaryWithBudgets = deptSummary.map(d => ({
      ...d,
      budget: deptBudgetMap.get(d.id) || { total_budget: 0, amount_used: 0, usage_pct: 0 },
    }));

    // 🛡️ STAFF users get department-scoped data + personal counts — no financials
    const isStaff = req.user.role_name === 'staff';
    const deptIds = req.user.department_ids || [];

    if (isStaff) {
      // Query staff's own department items (scoped to their departments)
      let staffItemsQuery = { total_items: 0, total_stock: 0 };
      let staffLowStock = { low_stock_items: 0 };
      if (deptIds.length > 0) {
        const [staffItems] = await pool.query(
          'SELECT COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_stock FROM items WHERE department_id IN (?) AND deleted_at IS NULL',
          [deptIds]
        );
        staffItemsQuery = staffItems[0] || staffItemsQuery;

        const [lowStock] = await pool.query(
          'SELECT COUNT(*) as low_stock_items FROM items WHERE department_id IN (?) AND deleted_at IS NULL AND quantity <= minimum_stock',
          [deptIds]
        );
        staffLowStock = lowStock[0] || staffLowStock;
      }

      // Staff's own requests — per-status breakdown
      const [staffReqs] = await pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'allocated' THEN 1 ELSE 0 END) as allocated
        FROM requests WHERE requester_id = ?
      `, [req.user.id]);
      const [staffBorrows] = await pool.query('SELECT COUNT(*) as count FROM borrowings WHERE borrower_id = ?', [req.user.id]);

      // Filter department summary to staff's departments only
      const staffDeptSummary = deptSummary.filter(d => deptIds.includes(d.id));

      return res.json({
        total_items: Number(staffItemsQuery.total_items) || 0,
        total_stock_quantity: Number(staffItemsQuery.total_stock) || 0,
        low_stock_items: Number(staffLowStock.low_stock_items) || 0,
        my_requests_count: Number(staffReqs[0]?.total) || 0,
        my_pending_requests: Number(staffReqs[0]?.pending) || 0,
        my_approved_requests: Number(staffReqs[0]?.approved) || 0,
        my_rejected_requests: Number(staffReqs[0]?.rejected) || 0,
        my_allocated_requests: Number(staffReqs[0]?.allocated) || 0,
        my_borrowings_count: Number(staffBorrows[0]?.count) || 0,
        // Scoped department summary (staff's own depts only)
        department_summary: staffDeptSummary.map(d => ({
        ...d,
        budget: deptBudgetMap.get(d.id) || { total_budget: 0, amount_used: 0, usage_pct: 0 },
      })),
        // All financial fields explicitly zeroed out
        total_inventory_value: 0,
        borrowed_items: 0,
        pending_requests: 0,
        currency: 'RWF',
        cogs_this_month: 0,
        stock_in_value_month: 0,
        borrowed_asset_value: 0,
        damaged_item_cost: 0,
        lost_item_cost: 0,
        adjustment_decrease_month: 0,
        adjustment_increase_month: 0,
        total_budget: 0,
        total_budget_used: 0,
        // Non-financial chart data (not rendered on staff dashboard)
        stock_in_out_chart: [],
        category_chart: [],
        // Liability metrics zeroed
        outstanding_liabilities_value: 0,
        outstanding_liabilities_count: 0,
        damage_cases: 0,
        loss_cases: 0,
        total_liability_value: 0,
        unpaid_liabilities: 0,
        total_liability_paid: 0,
        // No recent activities, global stats for staff
        recent_activities: []
      });
    }

    res.json({
      total_items: s.total_items || 0,
      total_stock_quantity: Number(s.total_stock_quantity) || 0,
      total_inventory_value: Number(s.total_inventory_value) || 0,
      currency: s.currency || 'RWF',
      low_stock_items: s.low_stock_items || 0,
      borrowed_items: s.borrowed_items || 0,
      pending_requests: s.pending_requests || 0,
      department_summary: deptSummaryWithBudgets,
      recent_activities: recentActivities,
      stock_in_out_chart: stockChart,
      category_chart: categoryData,
      cogs_this_month: Number(fin.cogs_this_month) || 0,
      stock_in_value_month: Number(fin.stock_in_value_month) || 0,
      borrowed_asset_value: Number(fin.borrowed_asset_value) || 0,
      damaged_item_cost: Number(fin.damaged_item_cost) || 0,
      lost_item_cost: Number(fin.lost_item_cost) || 0,
      adjustment_decrease_month: Number(adj.decrease_total) || 0,
      adjustment_increase_month: Number(adj.increase_total) || 0,
      total_budget: Number(bgt.total_budget) || 0,
      total_budget_used: Number(bgt.total_used) || 0,
      // Liability metrics
      outstanding_liabilities_value: Number(liab.outstanding_value) || 0,
      outstanding_liabilities_count: liab.outstanding_count || 0,
      damage_cases: liab.damage_cases || 0,
      loss_cases: liab.loss_cases || 0,
      total_liability_value: Number(liab.total_liability_value) || 0,
      unpaid_liabilities: liab.unpaid_count || 0,
      total_liability_paid: (Number(liab.outstanding_paid) + Number(liab.paid_total)) || 0
    });
  } catch (error) {
    req.log.error({ err: error }, 'Dashboard error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getDashboard };
