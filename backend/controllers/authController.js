const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { guardResetSuperAdminPassword } = require('../utils/superAdminGuard');

// ================= ACCOUNT LOCKOUT =================
// In-memory store for failed login attempts
// Resets on successful login or after lockout duration
const loginAttempts = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if an account is locked due to too many failed login attempts.
 * Cleans up expired lockouts.
 */
function isAccountLocked(email) {
  const record = loginAttempts.get(email);
  if (!record) return false;
  
  // Clean up expired lockouts
  if (Date.now() > record.lockedUntil) {
    loginAttempts.delete(email);
    return false;
  }
  
  return record.attempts >= MAX_FAILED_ATTEMPTS;
}

/**
 * Record a failed login attempt. Locks the account after MAX_FAILED_ATTEMPTS.
 */
function recordFailedAttempt(email) {
  const record = loginAttempts.get(email) || { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  
  loginAttempts.set(email, record);
  return record;
}

/**
 * Reset failed attempt counter on successful login.
 */
function resetLoginAttempts(email) {
  loginAttempts.delete(email);
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check account lockout BEFORE querying the database
    if (isAccountLocked(email)) {
      const record = loginAttempts.get(email);
      const remainingMinutes = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      await logActivity(null, 'failed_login_locked', 'auth', `Login blocked for locked account: ${email}`, req.ip);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`
      });
    }

    const [users] = await pool.query(
      `SELECT u.*, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    if (!users.length) {
      recordFailedAttempt(email);
      await logActivity(null, 'failed_login', 'auth', `Failed login attempt for non-existent email: ${email}`, req.ip);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];

    if (user.status === 'inactive') {
      await logActivity(user.id, 'failed_login_inactive', 'auth', `Login attempt on deactivated account: ${user.email}`, req.ip);
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact administrator.' });
    }

    // Verify password using bcrypt
    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      const record = recordFailedAttempt(email);
      const remainingAttempts = MAX_FAILED_ATTEMPTS - record.attempts;

      await logActivity(user.id, 'failed_login', 'auth', `Failed login attempt for user: ${user.full_name} (${user.email}) — ${remainingAttempts} attempt(s) remaining`, req.ip);

      if (remainingAttempts <= 0) {
        return res.status(429).json({
          success: false,
          message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'
        });
      }

      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${remainingAttempts} attempt(s) remaining before lockout.`
      });
    }

    // Successful login — reset lockout counter
    resetLoginAttempts(email);

    const token = jwt.sign(
      { id: user.id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Check if user must change password on first login
    const mustChangePassword = user.must_change_password === 1 || user.must_change_password === true;

    // Get all departments this user belongs to
    const [userDepts] = await pool.query('SELECT department_id FROM user_departments WHERE user_id = ?', [user.id]);
    const department_ids = userDepts.map(d => d.department_id);

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    await logActivity(user.id, 'login', 'auth', `User ${user.full_name} logged in`);

    res.json({
      token,
      must_change_password: mustChangePassword,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
        department_id: user.department_id,
        department_ids,
        must_change_password: mustChangePassword
      }
    });
  } catch (error) {
    req.log.error({ err: error }, 'Login error');
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.status,
              r.name as role_name, d.name as department_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get all departments this user belongs to
    const [userDepts] = await pool.query('SELECT department_id FROM user_departments WHERE user_id = ?', [req.user.id]);
    users[0].department_ids = userDepts.map(d => d.department_id);

    res.json({ user: users[0] });
  } catch (error) {
    req.log.error({ err: error }, 'Get current user error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    // Verify current password using bcrypt
    const isMatch = bcrypt.compareSync(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 12);
    await pool.query('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?', [hashedPassword, req.user.id]);

    await logActivity(req.user.id, 'change_password', 'auth', 'User changed their password');

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Change password error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { user_id, new_password } = req.body;

    // PROTECT: Only the Super Admin can reset their own password
    await guardResetSuperAdminPassword(user_id, req.user.id, req.ip);

    const hashedPassword = bcrypt.hashSync(new_password, 12);
    // When an admin resets a user's password, force them to change it on next login
    await pool.query('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?', [hashedPassword, user_id]);

    await logActivity(req.user.id, 'reset_password', 'auth', `Admin reset password for user ID: ${user_id}. User must change password on next login.`);

    res.json({ message: 'Password reset successfully. User must change password on next login.' });
  } catch (error) {
    if (error.message?.includes('Super Admin')) return res.status(403).json({ message: error.message });
    req.log.error({ err: error }, 'Reset password error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, email } = req.body;

    // Validate: at least one field must be provided
    if (!full_name && !email) {
      return res.status(400).json({ message: 'Nothing to update. Provide full_name or email.' });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
      }

      // Check email uniqueness (exclude current user)
      const [existing] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ message: 'Email already in use by another user.' });
      }
    }

    // Build update query dynamically (only include provided fields)
    const updates = [];
    const values = [];

    if (full_name) {
      updates.push('full_name = ?');
      values.push(full_name);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    values.push(req.user.id);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    await logActivity(req.user.id, 'update_profile', 'auth', `User updated their profile`);

    // Return updated user
    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.status,
              r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    res.json({ user: users[0], message: 'Profile updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already in use.' });
    req.log.error({ err: error }, 'Update profile error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { login, getCurrentUser, changePassword, resetPassword, updateProfile };
