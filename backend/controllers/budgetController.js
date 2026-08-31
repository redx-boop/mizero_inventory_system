const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { parseNumber, calculateBudgetRemaining } = require('../utils/financial');

const getBudgets = async (req, res) => {
  try {
    const { fiscal_year } = req.query;
    let query = `
      SELECT b.*, d.name as department_name,
        COALESCE((
          SELECT SUM(so.quantity * so.unit_cost_at_time)
          FROM stock_out so
          JOIN items i ON so.item_id = i.id
          WHERE i.department_id = b.department_id
          AND YEAR(so.date) = b.fiscal_year
        ), 0) as amount_used
      FROM budgets b
      JOIN departments d ON b.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (fiscal_year) {
      query += ' AND b.fiscal_year = ?';
      params.push(parseInt(fiscal_year));
    }

    const [budgets] = await pool.query(query + ' ORDER BY b.fiscal_year DESC, d.name', params);

    // Add remaining calculation
    const budgetsWithRemaining = budgets.map(b => ({
      ...b,
      amount_used: parseNumber(b.amount_used),
      amount_remaining: calculateBudgetRemaining(b.total_budget, b.amount_used)
    }));

    res.json(budgetsWithRemaining);
  } catch (error) {
    req.log.error({ err: error }, 'Get budgets error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createBudget = async (req, res) => {
  try {
    const { department_id, fiscal_year, total_budget, description } = req.body;

    const [result] = await pool.query(
      'INSERT INTO budgets (department_id, fiscal_year, total_budget, description, created_by) VALUES (?, ?, ?, ?, ?)',
      [department_id, fiscal_year || new Date().getFullYear(), total_budget, description || null, req.user.id]
    );

    await logActivity(req.user.id, 'create_budget', 'budgets', `Created budget: ${total_budget} for dept ${department_id} FY ${fiscal_year}`);
    res.status(201).json({ id: result.insertId, message: 'Budget created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Budget already exists for this department and fiscal year.' });
    req.log.error({ err: error }, 'Create budget error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateBudget = async (req, res) => {
  try {
    const { total_budget, description } = req.body;
    const [budgets] = await pool.query('SELECT * FROM budgets WHERE id = ?', [req.params.id]);
    if (!budgets.length) return res.status(404).json({ message: 'Budget not found.' });

    await pool.query(
      'UPDATE budgets SET total_budget = ?, description = ? WHERE id = ?',
      [total_budget !== undefined ? total_budget : budgets[0].total_budget, description || budgets[0].description, req.params.id]
    );

    await logActivity(req.user.id, 'update_budget', 'budgets', `Updated budget ID: ${req.params.id}`);
    res.json({ message: 'Budget updated successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Update budget error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteBudget = async (req, res) => {
  try {
    await pool.query('DELETE FROM budgets WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'delete_budget', 'budgets', `Deleted budget ID: ${req.params.id}`);
    res.json({ message: 'Budget deleted successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Delete budget error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getBudgetSummary = async (req, res) => {
  try {
    const { fiscal_year } = req.query;
    const year = fiscal_year || new Date().getFullYear();

    const [results] = await pool.query(`
      SELECT
        COALESCE(SUM(b.total_budget), 0) as total_budget,
        COALESCE(SUM(so_cost.total), 0) as total_used
      FROM budgets b
      LEFT JOIN (
        SELECT i.department_id, SUM(so.quantity * so.unit_cost_at_time) as total
        FROM stock_out so
        JOIN items i ON so.item_id = i.id
        WHERE YEAR(so.date) = ?
        GROUP BY i.department_id
      ) so_cost ON so_cost.department_id = b.department_id
      WHERE b.fiscal_year = ?
    `, [year, year]);

    const totalBudget = parseNumber(results[0].total_budget);
    const totalUsed = parseNumber(results[0].total_used);

    res.json({
      fiscal_year: year,
      total_budget: totalBudget,
      total_used: totalUsed,
      total_remaining: Math.max(0, totalBudget - totalUsed),
      usage_pct: totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0
    });
  } catch (error) {
    req.log.error({ err: error }, 'Budget summary error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetSummary };
