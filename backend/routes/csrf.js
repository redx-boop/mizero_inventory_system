const express = require('express');
const router = express.Router();
const { getCsrfToken } = require('../middleware/csrf');

// GET /api/csrf-token — Returns the current CSRF token
router.get('/csrf-token', getCsrfToken);

module.exports = router;
