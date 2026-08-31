const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({
        message: 'Access denied. Insufficient permissions.',
        required: allowedRoles,
        yourRole: req.user.role_name
      });
    }

    next();
  };
};

module.exports = authorize;
