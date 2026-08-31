const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { createNotification, notifyManagement } = require('../utils/notificationHelper');

const getRequests = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      status, item_id, requester_id, department_id,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT r.*, i.name as item_name, i.sku as item_sku, i.department_id as item_department_id,
             req.full_name as requester_name, rev.full_name as reviewer_name
      FROM requests r
      JOIN items i ON r.item_id = i.id
      JOIN users req ON r.requester_id = req.id
      LEFT JOIN users rev ON r.reviewed_by = rev.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (i.name LIKE ? OR i.sku LIKE ? OR req.full_name LIKE ? OR r.justification LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) { query += ' AND r.created_at >= ?'; params.push(from); }
    if (to) { query += ' AND r.created_at <= ?'; params.push(`${to} 23:59:59`); }
    if (status) { query += ' AND r.status = ?'; params.push(status); }
    if (item_id) { query += ' AND r.item_id = ?'; params.push(item_id); }
    if (requester_id) { query += ' AND r.requester_id = ?'; params.push(requester_id); }
    if (department_id) { query += ' AND i.department_id = ?'; params.push(department_id); }

    // Staff can only see their own requests
    if (req.user.role_name === 'staff') {
      query += ' AND r.requester_id = ?';
      params.push(req.user.id);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as counted`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'r.created_at', item_name: 'i.name', quantity: 'r.quantity', status: 'r.status', requester_name: 'req.full_name' };
    const sortCol = allowedSorts[sortBy] || 'r.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);
    res.json({ records, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    req.log.error({ err: error }, 'Get requests error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createRequest = async (req, res) => {
  try {
    const { item_id, quantity, justification } = req.body;

    const [items] = await pool.query('SELECT * FROM items WHERE id = ?', [item_id]);
    if (!items.length) return res.status(404).json({ message: 'Item not found.' });

    const [result] = await pool.query(
      'INSERT INTO requests (requester_id, item_id, quantity, justification, status) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, item_id, quantity, justification || null, 'pending']
    );

    await logActivity(req.user.id, 'create_request', 'requests', `Requested ${quantity} of ${items[0].name}`);

    // Notify managers about new request
    await notifyManagement(
      'New Stock Request',
      `${req.user.full_name} requested ${quantity} of ${items[0].name}.`,
      'requests',
      result.insertId,
      req.user.id,
      'info',
      '/requests'
    );

    res.status(201).json({ id: result.insertId, message: 'Request submitted successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Create request error');
    res.status(500).json({ message: 'Server error.' });
  }
};

// Valid request status transitions (state machine)
const VALID_TRANSITIONS = {
  'pending':   ['approved', 'rejected', 'allocated'],
  'approved':  ['allocated'],
  'rejected':  [],  // terminal state — no further transitions
  'allocated': []   // terminal state — no further transitions
};

const reviewRequest = async (req, res) => {
  try {
    const { status, allocated_quantity, notes } = req.body; // approved, rejected, allocated

    const [requests] = await pool.query(
      'SELECT r.*, i.name as item_name, i.quantity as available_qty, req.full_name as requester_name FROM requests r JOIN items i ON r.item_id = i.id JOIN users req ON r.requester_id = req.id WHERE r.id = ?',
      [req.params.id]
    );
    if (!requests.length) return res.status(404).json({ message: 'Request not found.' });

    const request = requests[0];
    const currentStatus = request.status;

    // CRITICAL: Enforce state machine — no invalid transitions
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition request from '${currentStatus}' to '${status}'.`,
        current_status: currentStatus,
        requested_status: status,
        allowed_transitions: allowedTransitions
      });
    }

    if (status === 'allocated') {
      // Determine actual quantity to allocate (defaults to full request if not specified)
      const qtyToAllocate = allocated_quantity ? parseInt(allocated_quantity) : request.quantity;

      if (qtyToAllocate < 1 || qtyToAllocate > request.quantity) {
        return res.status(400).json({
          message: `Allocation must be between 1 and ${request.quantity}.`,
          requested: request.quantity,
          attempting: qtyToAllocate
        });
      }

      let lockConnection;
      try {
        lockConnection = await pool.getConnection();
        await lockConnection.beginTransaction();

        // 🔒 Row-level lock on the item to prevent concurrent stock mutations
        const [lockedItem] = await lockConnection.query('SELECT * FROM items WHERE id = ? FOR UPDATE', [request.item_id]);

        if (lockedItem[0].quantity < qtyToAllocate) {
          await lockConnection.rollback();
          return res.status(400).json({
            message: 'Insufficient stock to allocate.',
            available: lockedItem[0].quantity,
            requested: qtyToAllocate
          });
        }

        // Build the reason from notes if provided
        let reason = `Allocated from request #${request.id}`;
        if (notes) reason += ` — ${notes}`;

        // Create stock out record
        await lockConnection.query(
          'INSERT INTO stock_out (item_id, quantity, recipient, department, reason, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [request.item_id, qtyToAllocate, request.requester_name, null, reason, new Date(), req.user.id]
        );

        await lockConnection.query('UPDATE items SET quantity = quantity - ? WHERE id = ?', [qtyToAllocate, request.item_id]);

        await lockConnection.commit();
      } catch (lockError) {
        if (lockConnection) await lockConnection.rollback();
        throw lockError;
      } finally {
        if (lockConnection) lockConnection.release();
      }
    }

    const allocatedQty = (status === 'allocated' && allocated_quantity) ? parseInt(allocated_quantity) : (status === 'allocated' ? request.quantity : 0);

    await pool.query(
      'UPDATE requests SET status = ?, allocated_quantity = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [status, allocatedQty, req.user.id, req.params.id]
    );

    // Notify requester
    const notifiedQty = (status === 'allocated' && allocated_quantity) ? allocated_quantity : request.quantity;
    const notifType = status === 'approved' || status === 'allocated' ? 'success' : 'danger';
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    await createNotification(
      request.requester_id,
      `Request ${statusLabel}`,
      `Your request for ${notifiedQty} of ${request.item_name} has been ${status}.`,
      'requests',
      request.id,
      notifType,
      '/requests'
    );

    const logQty = (status === 'allocated' && allocated_quantity) ? allocated_quantity : request.quantity;
    await logActivity(req.user.id, 'review_request', 'requests', `${status} request #${request.id} for ${logQty} of ${request.item_name}`);

    res.json({ message: `Request ${status} successfully.` });
  } catch (error) {
    req.log.error({ err: error }, 'Review request error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const cancelRequest = async (req, res) => {
  try {
    const [requests] = await pool.query(
      'SELECT * FROM requests WHERE id = ?',
      [req.params.id]
    );
    if (!requests.length) return res.status(404).json({ message: 'Request not found.' });

    const request = requests[0];

    // Only the requester, admin, or manager can cancel
    const allowedRoles = ['super_admin', 'admin', 'stock_manager'];
    if (request.requester_id !== req.user.id && !allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'You are not authorized to cancel this request.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending requests can be cancelled.',
        current_status: request.status
      });
    }

    await pool.query(
      'UPDATE requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['rejected', req.user.id, req.params.id]
    );

    // Notify the requester
    if (request.requester_id !== req.user.id) {
      const [item] = await pool.query('SELECT name FROM items WHERE id = ?', [request.item_id]);
      await createNotification(
        request.requester_id,
        'Request Cancelled',
        `Your request for ${request.quantity} of ${item[0]?.name || 'item'} has been cancelled.`,
        'requests',
        request.id,
        'warning',
        '/requests'
      );
    }

    await logActivity(req.user.id, 'cancel_request', 'requests', `Cancelled request #${request.id}`);

    res.json({ message: 'Request cancelled successfully.' });
  } catch (error) {
    req.log.error({ err: error }, 'Cancel request error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getRequestReceipt = async (req, res) => {
  try {
    const [records] = await pool.query(
      `SELECT r.*, i.name as item_name, i.sku as item_sku, req.full_name as requester_name, rev.full_name as reviewer_name
       FROM requests r
       JOIN items i ON r.item_id = i.id
       JOIN users req ON r.requester_id = req.id
       LEFT JOIN users rev ON r.reviewed_by = rev.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (!records.length) return res.status(404).json({ message: 'Request not found.' });

    res.json(records[0]);
  } catch (error) {
    req.log.error({ err: error }, 'Get request receipt error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getRequests, createRequest, reviewRequest, cancelRequest, getRequestReceipt };
