const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    // Accept token from Authorization header only
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role_id, u.department_id, u.status, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.status = 'active'`,
      [decoded.id]
    );

    if (!users.length) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    // Get all departments this user belongs to
    const [userDepts] = await pool.query('SELECT department_id FROM user_departments WHERE user_id = ?', [users[0].id]);
    users[0].department_ids = userDepts.map(d => d.department_id);

    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    return res.status(500).json({ message: 'Authentication error.' });
  }
};

module.exports = authenticate;
