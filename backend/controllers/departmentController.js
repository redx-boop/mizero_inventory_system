const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');

const getDepartments = async (req, res) => {
  try {
    const [departments] = await pool.query(
      `SELECT d.*, u.full_name as manager_name
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       ORDER BY d.name`
    );
    res.json(departments);
  } catch (error) {
    req.log.error({ err: error }, 'Get departments error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getDepartment = async (req, res) => {
  try {
    const [departments] = await pool.query(
      `SELECT d.*, u.full_name as manager_name
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!departments.length) return res.status(404).json({ message: 'Department not found.' });
    res.json(departments[0]);
  } catch (error) {
    req.log.error({ err: error }, 'Get department error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, description, manager_id } = req.body;

    // Prevent assigning a staff-role user as department manager
    if (manager_id) {
      const [users] = await pool.query(
        'SELECT u.role_id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
        [manager_id]
      );
      if (users.length && users[0].role_name === 'staff') {
        return res.status(400).json({ message: 'Staff role users cannot be assigned as department managers.' });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO departments (name, description, manager_id) VALUES (?, ?, ?)',
      [name, description, manager_id || null]
    );
    await logActivity(req.user.id, 'create', 'departments', `Created department: ${name}`);
    res.status(201).json({ id: result.insertId, name, description, manager_id });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Department name already exists.' });
    req.log.error({ err: error }, 'Create department error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { name, description, manager_id } = req.body;

    // Prevent assigning a staff-role user as department manager
    if (manager_id) {
      const [users] = await pool.query(
        'SELECT u.role_id, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
        [manager_id]
      );
      if (users.length && users[0].role_name === 'staff') {
        return res.status(400).json({ message: 'Staff role users cannot be assigned as department managers.' });
      }
    }

    await pool.query(
      'UPDATE departments SET name = ?, description = ?, manager_id = ? WHERE id = ?',
      [name, description, manager_id || null, req.params.id]
    );
    await logActivity(req.user.id, 'update', 'departments', `Updated department ID: ${req.params.id}`);
    res.json({ message: 'Department updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Department name already exists.' });
    req.log.error({ err: error }, 'Update department error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const [items] = await pool.query('SELECT COUNT(*) as count FROM items WHERE department_id = ?', [req.params.id]);
    if (items[0].count > 0) {
      return res.status(400).json({ message: 'Cannot delete department with existing inventory.' });
    }
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'delete', 'departments', `Deleted department ID: ${req.params.id}`);
    res.json({ message: 'Department deleted successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Delete department error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment };
