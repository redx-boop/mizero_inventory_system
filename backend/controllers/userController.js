const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { notifyManagement } = require('../utils/notificationHelper');
const {
  guardCreateSuperAdmin,
  guardUpdateSuperAdmin,
  guardDeleteSuperAdmin,
  getSuperAdminInfo
} = require('../utils/superAdminGuard');

const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [records] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.status, u.last_login, u.created_at,
              r.name as role_name, d.name as department_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    // Attach all department IDs and names for each user
    for (const user of records) {
      const [deptRows] = await pool.query(
        `SELECT d.id, d.name FROM user_departments ud
         JOIN departments d ON ud.department_id = d.id
         WHERE ud.user_id = ?`,
        [user.id]
      );
      user.department_ids = deptRows.map(d => d.id);
      user.department_names = deptRows.map(d => d.name);
    }

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total, pages: Math.ceil(countResult[0].total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get users error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateUserDepartments = async (userId, departmentIds) => {
  // Replace all department assignments for this user
  await pool.query('DELETE FROM user_departments WHERE user_id = ?', [userId]);
  if (departmentIds && departmentIds.length > 0) {
    const values = departmentIds.map(deptId => [userId, deptId]);
    await pool.query('INSERT INTO user_departments (user_id, department_id) VALUES ?', [values]);
  }
};

const getUserDepartmentIds = async (userId) => {
  const [rows] = await pool.query('SELECT department_id FROM user_departments WHERE user_id = ?', [userId]);
  return rows.map(r => r.department_id);
};

const createUser = async (req, res) => {
  try {
    const { full_name, email, password, role_id, department_id, department_ids } = req.body;

    // PROTECT: Prevent creating a second Super Admin
    await guardCreateSuperAdmin(role_id, req.user.id, req.ip);

    // Hash password with bcrypt before storing
    const hashedPassword = bcrypt.hashSync(password, 12);
    // New users must change password on first login
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password, role_id, department_id, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name, email, hashedPassword, role_id, department_id || null, 'active', 1]
    );

    // Handle multi-department assignments
    const deptIds = department_ids || (department_id ? [department_id] : []);
    await updateUserDepartments(result.insertId, deptIds);

    await logActivity(req.user.id, 'create_user', 'users', `Created user: ${full_name} (${email})`);

    const [roleRow] = await pool.query('SELECT name FROM roles WHERE id = ?', [role_id]);
    const roleName = roleRow.length ? roleRow[0].name : 'unknown';
    await notifyManagement(
      'New User Created',
      `User "${full_name}" (${email}) has been created with role "${roleName}" by ${req.user.full_name}.`,
      'users',
      result.insertId,
      req.user.id,
      'info',
      '/users'
    );

    res.status(201).json({ id: result.insertId, message: 'User created successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already exists.' });
    if (error.message?.includes('Super Admin')) return res.status(403).json({ message: error.message });
    req.log.error({ err: error }, 'Create user error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { full_name, email, role_id, department_id, department_ids, status } = req.body;

    // PROTECT: Prevent modifying Super Admin account
    await guardUpdateSuperAdmin(req.params.id, { role_id, status, department_id, department_ids }, req.user.id, req.ip);

    await pool.query(
      'UPDATE users SET full_name = ?, email = ?, role_id = ?, department_id = ?, status = ? WHERE id = ?',
      [full_name, email, role_id, department_id || null, status || 'active', req.params.id]
    );

    // Handle multi-department assignments
    const deptIds = department_ids || (department_id ? [department_id] : []);
    await updateUserDepartments(req.params.id, deptIds);

    await logActivity(req.user.id, 'update_user', 'users', `Updated user ID: ${req.params.id}`);

    // Notify if role changed
    const [oldUser] = await pool.query('SELECT role_id FROM users WHERE id = ?', [req.params.id]);
    if (oldUser.length && parseInt(oldUser[0].role_id) !== parseInt(role_id)) {
      const [roleRow] = await pool.query('SELECT name FROM roles WHERE id = ?', [role_id]);
      const roleName = roleRow.length ? roleRow[0].name : 'unknown';
      await notifyManagement(
        'User Role Changed',
        `User ID ${req.params.id} (${full_name}) role changed to "${roleName}" by ${req.user.full_name}.`,
        'users',
        parseInt(req.params.id),
        req.user.id,
        'warning',
        '/users'
      );
    }

    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already exists.' });
    if (error.message?.includes('Super Admin')) return res.status(403).json({ message: error.message });
    req.log.error({ err: error }, 'Update user error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account.' });
    }

    // PROTECT: Prevent deleting/deactivating the Super Admin account entirely
    await guardDeleteSuperAdmin(req.params.id, req.user.id, req.ip);

    const [targetUser] = await pool.query('SELECT id FROM users WHERE id = ? AND status = ?', [req.params.id, 'active']);
    if (!targetUser.length) return res.status(404).json({ message: 'Active user not found.' });

    await pool.query('UPDATE users SET status = ? WHERE id = ?', ['inactive', req.params.id]);
    await logActivity(req.user.id, 'deactivate_user', 'users', `Deactivated user ID: ${req.params.id}`);
    res.json({ message: 'User deactivated successfully.' });
  } catch (error) {
    if (error.message?.includes('Super Admin')) return res.status(403).json({ message: error.message });
    req.log.error({ err: error }, 'Delete user error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getRoles = async (req, res) => {
  try {
    const [roles] = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json(roles);
  } catch (error) {
    req.log.error({ err: error }, 'Get roles error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, getRoles, getUserDepartmentIds };
