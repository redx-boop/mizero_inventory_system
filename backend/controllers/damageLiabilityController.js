const pool = require('../config/db');
const logActivity = require('../utils/activityLogger');
const { createNotification, notifyManagement } = require('../utils/notificationHelper');
const { parseNumber } = require('../utils/financial');

const getLiabilities = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, from, to,
      status, type, item_id, borrower_name,
      min_amount, max_amount,
      sortBy = 'created_at', sortOrder = 'desc'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT dl.*, u.full_name as created_by_name
      FROM damage_liabilities dl
      LEFT JOIN users u ON dl.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (dl.item_name LIKE ? OR dl.item_sku LIKE ? OR dl.borrower_name LIKE ? OR dl.borrower_phone LIKE ? OR dl.notes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }
    if (from) { query += ' AND dl.created_at >= ?'; params.push(from); }
    if (to) { query += ' AND dl.created_at <= ?'; params.push(`${to} 23:59:59`); }
    if (status) { query += ' AND dl.status = ?'; params.push(status); }
    if (type) { query += ' AND dl.liability_type = ?'; params.push(type); }
    if (item_id) { query += ' AND dl.item_id = ?'; params.push(item_id); }
    if (borrower_name) { query += ' AND dl.borrower_name LIKE ?'; params.push(`%${borrower_name}%`); }
    if (min_amount) { query += ' AND dl.liability_amount >= ?'; params.push(parseNumber(min_amount)); }
    if (max_amount) { query += ' AND dl.liability_amount <= ?'; params.push(parseNumber(max_amount)); }

    let countSql = 'SELECT COUNT(*) as total FROM damage_liabilities WHERE 1=1';
    const countParams = [];
    if (search) { countSql += ' AND (item_name LIKE ? OR item_sku LIKE ? OR borrower_name LIKE ? OR borrower_phone LIKE ? OR notes LIKE ?)'; const like = `%${search}%`; countParams.push(like, like, like, like, like); }
    if (from) { countSql += ' AND created_at >= ?'; countParams.push(from); }
    if (to) { countSql += ' AND created_at <= ?'; countParams.push(`${to} 23:59:59`); }
    if (status) { countSql += ' AND status = ?'; countParams.push(status); }
    if (type) { countSql += ' AND liability_type = ?'; countParams.push(type); }
    if (item_id) { countSql += ' AND item_id = ?'; countParams.push(item_id); }
    if (borrower_name) { countSql += ' AND borrower_name LIKE ?'; countParams.push(`%${borrower_name}%`); }
    if (min_amount) { countSql += ' AND liability_amount >= ?'; countParams.push(parseNumber(min_amount)); }
    if (max_amount) { countSql += ' AND liability_amount <= ?'; countParams.push(parseNumber(max_amount)); }

    const [countResult] = await pool.query(countSql, countParams);
    const total = countResult[0].total;

    // Whitelist sort columns
    const allowedSorts = { created_at: 'dl.created_at', liability_amount: 'dl.liability_amount', amount_paid: 'dl.amount_paid', balance: 'dl.balance', status: 'dl.status', liability_type: 'dl.liability_type', item_name: 'dl.item_name', borrower_name: 'dl.borrower_name', replacement_cost: 'dl.replacement_cost' };
    const sortCol = allowedSorts[sortBy] || 'dl.created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    const sanitized = records.map(r => ({
      ...r,
      quantity: Number(r.quantity) || 0,
      paid_quantity: Number(r.paid_quantity) || 0,
      remaining_quantity: Number(r.remaining_quantity) || 0,
      unit_cost: Number(r.unit_cost) || 0,
      total_amount: Number(r.total_amount) || 0,
      replacement_cost: Number(r.replacement_cost) || 0,
      liability_amount: Number(r.liability_amount) || 0,
      amount_paid: Number(r.amount_paid) || 0,
      balance: Number(r.balance) || 0,
      liability_percentage: Number(r.liability_percentage) || 0
    }));

    res.json({
      records: sanitized,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    req.log.error({ err: error }, 'Get liabilities error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const createLiability = async (req, res) => {
  try {
    const { borrowing_id, returned_quantity, liability_type, notes, borrower_id } = req.body;

    const type = liability_type === 'lost' ? 'lost' : 'damaged';

    const [borrowings] = await pool.query(
      `SELECT b.*, i.name as item_name, i.sku as item_sku, i.unit_cost as current_unit_cost
       FROM borrowings b
       JOIN items i ON b.item_id = i.id
       WHERE b.id = ?`,
      [borrowing_id]
    );
    if (!borrowings.length) return res.status(404).json({ message: 'Borrowing not found.' });

    const borrowing = borrowings[0];

    // Ensure returned_quantity is parsed to prevent NaN propagation
    const parsedQuantity = parseNumber(returned_quantity);

    // Check BOTH returns and damage_liabilities to prevent double-counting
    const [returnsRows] = await pool.query('SELECT COALESCE(SUM(returned_quantity), 0) as total FROM returns WHERE borrowing_id = ?', [borrowing_id]);
    const [damageRows] = await pool.query('SELECT COALESCE(SUM(quantity), 0) as total FROM damage_liabilities WHERE borrowing_id = ?', [borrowing_id]);
    const alreadyReturned = parseNumber(returnsRows[0].total);
    const alreadyDamaged = parseNumber(damageRows[0].total);
    const alreadyAccounted = alreadyReturned + alreadyDamaged;

    if (alreadyAccounted + parsedQuantity > borrowing.quantity) {
      return res.status(400).json({
        message: 'Quantity exceeds borrowed quantity.',
        borrowed: borrowing.quantity,
        already_returned: alreadyReturned,
        already_damaged: alreadyDamaged
      });
    }

    const totalAccounted = alreadyAccounted + parsedQuantity;
    // Use borrowing's unit_cost_at_time, falling back to current item unit_cost if snapshot is 0
    let unitCost = parseNumber(borrowing.unit_cost_at_time);
    if (unitCost === 0 && borrowing.current_unit_cost > 0) {
      unitCost = parseNumber(borrowing.current_unit_cost);
    }

    // Calculate amounts: damaged pays half, lost pays full
    const liabilityPercentage = type === 'lost' ? 100.00 : 50.00;
    const priceMultiplier = liabilityPercentage / 100;
    const fullReplacementCost = unitCost * parsedQuantity;
    const liabilityAmount = fullReplacementCost * priceMultiplier;

    const notesPrefixed = type === 'lost'
      ? (notes ? `[Lost] ${notes}` : '[Lost]')
      : (notes ? `[Damaged] ${notes}` : '[Damaged]');

    const [result] = await pool.query(
      `INSERT INTO damage_liabilities
       (liability_type, borrowing_id, item_id, item_name, item_sku, borrower_name, borrower_phone,
        borrower_id, quantity, unit_cost, total_amount, liability_percentage,
        replacement_cost, liability_amount, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        borrowing_id,
        borrowing.item_id,
        borrowing.item_name,
        borrowing.item_sku,
        borrowing.borrower_name,
        borrowing.borrower_phone,
        borrower_id || null,
        parsedQuantity,
        unitCost,
        liabilityAmount,  // total_amount = liability_amount (what they owe)
        liabilityPercentage,
        fullReplacementCost,
        liabilityAmount,
        'pending',
        notesPrefixed,
        req.user.id
      ]
    );

    // Update borrowing status to 'damaged' or 'lost' when all items accounted for
    if (totalAccounted >= borrowing.quantity) {
      await pool.query('UPDATE borrowings SET status = ? WHERE id = ?', [type, borrowing_id]);
    }

    const actionLabel = type === 'lost' ? 'reported as lost' : 'reported as damaged';
    await logActivity(
      req.user.id,
      type === 'lost' ? 'loss_report' : 'damage_report',
      'damage_liabilities',
      `${type.charAt(0).toUpperCase() + type.slice(1)} ${returned_quantity} of ${borrowing.item_name} (${borrowing.borrower_name}) - liability: ${liabilityAmount.toFixed(2)} (${liabilityPercentage}%)`
    );

    // Notify the creator
    const notificationTitle = type === 'lost' ? 'Lost Item Reported' : 'Damage Reported';
    const notificationMessage = `${returned_quantity} of ${borrowing.item_name} by ${borrowing.borrower_name} ${actionLabel}. Total liability: ${liabilityAmount.toFixed(2)}. Status: Pending`;
    await createNotification(
      req.user.id,
      notificationTitle,
      notificationMessage,
      'damage_liabilities',
      result.insertId,
      'danger',
      '/damage-liabilities'
    );

    // Notify all management users
    await notifyManagement(
      notificationTitle,
      notificationMessage,
      'damage_liabilities',
      result.insertId,
      req.user.id,
      'danger',
      '/damage-liabilities'
    );

    const userMsg = type === 'lost'
      ? `This item was reported lost. A loss liability has been created. The borrower must pay the full replacement cost.`
      : `This item was returned damaged. A damage liability has been created. The borrower must pay 50% of the replacement cost.`;

    res.status(201).json({
      id: result.insertId,
      message: userMsg,
      replacement_cost: fullReplacementCost,
      liability_amount: liabilityAmount,
      liability_type: type,
      liability_percentage: liabilityPercentage,
      status: 'pending'
    });
  } catch (error) {
    req.log.error({ err: error }, 'Create liability error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_amount, notes } = req.body;

    // Enhanced logging for debugging
    req.log.info({ body: req.body, params: req.params, user: req.user?.id }, 'Record payment request received');

    // Validate payment amount early
    if (payment_amount === undefined || payment_amount === null || payment_amount === '') {
      return res.status(400).json({ message: 'Payment amount is required.' });
    }

    const payAmount = parseNumber(payment_amount);
    req.log.info({ payment_amount, payAmount }, 'Parsed payment amount');

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be a positive number.' });
    }

    const [liabilities] = await pool.query('SELECT * FROM damage_liabilities WHERE id = ?', [id]);
    if (!liabilities.length) {
      req.log.warn({ liabilityId: id }, 'Liability not found for payment');
      return res.status(404).json({ message: 'Liability not found.' });
    }

    const liability = liabilities[0];
    req.log.info({ liability_id: liability.id, status: liability.status, liability_amount: liability.liability_amount, amount_paid: liability.amount_paid, unit_cost: liability.unit_cost }, 'Found liability record');

    if (liability.status === 'paid') return res.status(400).json({ message: 'This liability is already fully paid.' });
    if (liability.status === 'waived') return res.status(400).json({ message: 'This liability has been waived.' });

    // Validate liability has numeric fields
    let unitCost = Number(liability.unit_cost) || 0;
    let currentPaid = Number(liability.amount_paid) || 0;
    let totalOwed = Number(liability.liability_amount) || 0;

    // For legacy records where liability_amount is 0, compute from available fields
    if (totalOwed <= 0) {
      const qty = Number(liability.quantity) || 0;
      const pct = Number(liability.liability_percentage) || 50;
      // Try total_amount first (original computed column), then calculate from quantity * unit_cost * percentage
      totalOwed = Number(liability.total_amount) || (qty * unitCost * pct / 100) || 0;
    }

    req.log.info({ unitCost, currentPaid, totalOwed, payAmount }, 'Calculated amounts');

    if (totalOwed <= 0) {
      return res.status(400).json({ message: 'Invalid liability amount. Cannot process payment.' });
    }

    const remaining = totalOwed - currentPaid;

    if (payAmount > remaining) {
      return res.status(400).json({
        message: 'Payment amount exceeds remaining balance.',
        total_liability: totalOwed,
        already_paid: currentPaid,
        remaining: remaining,
        attempting_payment: payAmount
      });
    }

    const newPaid = currentPaid + payAmount;
    const newRemaining = totalOwed - newPaid;

    let newStatus = 'partially_paid';
    if (newPaid === 0) newStatus = 'pending';
    if (newRemaining <= 0.001) newStatus = 'paid';

    // Calculate equivalent paid_quantity for backward compatibility
    const liabilityPct = Number(liability.liability_percentage) || 100;
    const effectivePerUnitCost = unitCost * (liabilityPct / 100);
    const paymentQtyEquivalent = effectivePerUnitCost > 0 ? Math.floor(payAmount / effectivePerUnitCost) : 1;
    const newPaidQty = (Number(liability.paid_quantity) || 0) + Math.min(paymentQtyEquivalent, Number(liability.quantity) || 0);

    req.log.info({ newPaid, newRemaining, newStatus, paymentQtyEquivalent, newPaidQty }, 'Updating liability with');

    await pool.query(
      'UPDATE damage_liabilities SET amount_paid = ?, paid_quantity = ?, status = ?, paid_at = ? WHERE id = ?',
      [newPaid, newPaidQty, newStatus, newStatus === 'paid' ? new Date() : null, id]
    );

    req.log.info({ liabilityId: id, newStatus }, 'Liability updated successfully');

    // Record in payment history — FIXED: use 'payment_amount' column, not 'amount'
    const [paymentResult] = await pool.query(
      `INSERT INTO damage_payments
       (liability_id, payment_quantity, unit_cost, payment_amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, paymentQtyEquivalent > 0 ? paymentQtyEquivalent : 1, effectivePerUnitCost, payAmount, notes || null, req.user.id]
    );

    req.log.info({ paymentId: paymentResult?.insertId }, 'Payment record created');

    await logActivity(
      req.user.id,
      'liability_payment',
      'damage_liabilities',
      `Recorded payment of ${payAmount.toFixed(2)} for ${liability.liability_type} liability #${id} - ${liability.borrower_name} (${liability.item_name}). Status: ${newStatus.replace('_', ' ')}`
    );

    // Notify creator
    const paymentNote = `Payment of ${payAmount.toFixed(2)} recorded for ${liability.liability_type === 'lost' ? 'loss' : 'damage'} liability - ${liability.borrower_name} (${liability.item_name}). Status: ${newStatus.replace('_', ' ')}.`;
    await createNotification(
      req.user.id,
      'Liability Payment Recorded',
      paymentNote,
      'damage_liabilities',
      id,
      'success',
      '/damage-liabilities'
    );

    // Notify management
    await notifyManagement(
      'Liability Payment Recorded',
      paymentNote,
      'damage_liabilities',
      id,
      req.user.id,
      'success',
      '/damage-liabilities'
    );

    // If fully paid, send a separate 'Liability Paid' notification
    if (newStatus === 'paid') {
      const paidNote = `${liability.liability_type === 'lost' ? 'Loss' : 'Damage'} liability for ${liability.borrower_name} (${liability.item_name}) has been fully paid. Total paid: ${newPaid.toFixed(2)}.`;
      await createNotification(
        req.user.id,
        'Liability Paid',
        paidNote,
        'damage_liabilities',
        id,
        'success',
        '/damage-liabilities'
      );
      await notifyManagement(
        'Liability Paid',
        paidNote,
        'damage_liabilities',
        id,
        req.user.id,
        'success',
        '/damage-liabilities'
      );
    }

    res.status(200).json({
      message: `Payment recorded. Liability status: ${newStatus.replace('_', ' ')}.`,
      payment_id: paymentResult.insertId,
      payment_amount: payAmount,
      amount_paid: newPaid,
      balance: newRemaining,
      status: newStatus
    });
  } catch (error) {
    req.log.error({ err: error, message: error.message, sqlMessage: error.sqlMessage, sql: error.sql, body: req.body, params: req.params }, 'Record payment error');
    res.status(500).json({ message: 'Server error.', debug: error.sqlMessage || error.message });
  }
};

const waiveLiability = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [records] = await pool.query('SELECT * FROM damage_liabilities WHERE id = ?', [id]);
    if (!records.length) return res.status(404).json({ message: 'Liability not found.' });

    const liability = records[0];
    if (liability.status === 'paid') return res.status(400).json({ message: 'Cannot waive a fully paid liability.' });
    if (liability.status === 'waived') return res.status(400).json({ message: 'Liability is already waived.' });

    await pool.query(
      'UPDATE damage_liabilities SET status = ?, paid_at = ?, notes = CONCAT(COALESCE(notes, ""), ?) WHERE id = ?',
      ['waived', new Date(), `\n[WAIVED] ${reason || 'No reason provided'}`, id]
    );

    await logActivity(
      req.user.id,
      'liability_waived',
      'damage_liabilities',
      `Waived ${liability.liability_type} liability #${id} for ${liability.borrower_name} (${liability.item_name}) - Amount: ${Number(liability.liability_amount || 0).toFixed(2)} - Reason: ${reason || 'N/A'}`
    );

    await createNotification(
      req.user.id,
      'Liability Waived',
      `${liability.liability_type === 'lost' ? 'Loss' : 'Damage'} liability for ${liability.borrower_name} (${liability.item_name}) has been waived. Amount: ${Number(liability.liability_amount || 0).toFixed(2)}.`,
      'damage_liabilities',
      id,
      'warning',
      '/damage-liabilities'
    );

    res.json({ message: 'Liability waived successfully.', status: 'waived' });
  } catch (error) {
    req.log.error({ err: error }, 'Waive liability error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getLiabilityReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const [liabilities] = await pool.query(
      `SELECT dl.*, u.full_name as created_by_name
       FROM damage_liabilities dl
       LEFT JOIN users u ON dl.created_by = u.id
       WHERE dl.id = ?`,
      [id]
    );

    if (!liabilities.length) return res.status(404).json({ message: 'Liability not found.' });

    const l = liabilities[0];
    const sanitized = {
      ...l,
      quantity: Number(l.quantity) || 0,
      paid_quantity: Number(l.paid_quantity) || 0,
      remaining_quantity: Number(l.remaining_quantity) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      total_amount: Number(l.total_amount) || 0,
      replacement_cost: Number(l.replacement_cost) || 0,
      liability_amount: Number(l.liability_amount) || 0,
      amount_paid: Number(l.amount_paid) || 0,
      balance: Number(l.balance) || 0,
      liability_percentage: Number(l.liability_percentage) || 0
    };

    res.json(sanitized);
  } catch (error) {
    req.log.error({ err: error }, 'Get liability receipt error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const [payments] = await pool.query(
      `SELECT dp.*, u.full_name as created_by_name
       FROM damage_payments dp
       LEFT JOIN users u ON dp.created_by = u.id
       WHERE dp.liability_id = ?
       ORDER BY dp.paid_at ASC`,
      [id]
    );

    const sanitized = payments.map(p => ({
      ...p,
      payment_quantity: Number(p.payment_quantity) || 0,
      unit_cost: Number(p.unit_cost) || 0,
      payment_amount: Number(p.payment_amount) || 0,
      amount: Number(p.amount) || 0
    }));

    res.json(sanitized);
  } catch (error) {
    req.log.error({ err: error }, 'Get payment history error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const [records] = await pool.query('SELECT * FROM damage_liabilities WHERE id = ?', [id]);
    if (!records.length) return res.status(404).json({ message: 'Liability not found.' });

    const liability = records[0];
    let totalOwed = Number(liability.liability_amount) || 0;
    // For legacy records where liability_amount is 0, compute from available fields
    if (totalOwed <= 0) {
      const qty = Number(liability.quantity) || 0;
      const unitCost = Number(liability.unit_cost) || 0;
      const pct = Number(liability.liability_percentage) || 50;
      totalOwed = Number(liability.total_amount) || (qty * unitCost * pct / 100) || 0;
    }
    const currentPaid = Number(liability.amount_paid) || 0;
    const remaining = totalOwed - currentPaid;

    if (remaining <= 0.001) {
      return res.status(400).json({ message: 'This liability is already fully paid.' });
    }

    req.params = { id };
    req.body = { payment_amount: remaining, notes: 'Full payment (Mark as Paid)' };
    return recordPayment(req, res);
  } catch (error) {
    req.log.error({ err: error }, 'Mark as paid error');
    res.status(500).json({ message: 'Server error.' });
  }
};

// ============================================
// LIABILITY REPORTS (with pagination)
// ============================================

function getPagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

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

const getDamageReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM damage_liabilities WHERE liability_type = 'damaged'`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT dl.*, u.full_name as created_by_name
       FROM damage_liabilities dl
       LEFT JOIN users u ON dl.created_by = u.id
       WHERE dl.liability_type = 'damaged'
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT
         COUNT(*) as total_cases,
         COALESCE(SUM(dl.liability_amount), 0) as total_liability,
         COALESCE(SUM(dl.amount_paid), 0) as total_paid,
         COALESCE(SUM(dl.liability_amount - dl.amount_paid), 0) as total_balance
       FROM damage_liabilities dl
       WHERE dl.liability_type = 'damaged'`
    );

    const sanitized = records.map(r => ({
      ...r,
      replacement_cost: Number(r.replacement_cost) || 0,
      liability_amount: Number(r.liability_amount) || 0,
      amount_paid: Number(r.amount_paid) || 0,
      balance: Number(r.balance) || 0
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalCases: summary[0].total_cases,
        totalLiability: summary[0].total_liability,
        totalPaid: summary[0].total_paid,
        totalBalance: summary[0].total_balance
      },
      records: sanitized
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Get damage report error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getLossReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM damage_liabilities WHERE liability_type = 'lost'`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT dl.*, u.full_name as created_by_name
       FROM damage_liabilities dl
       LEFT JOIN users u ON dl.created_by = u.id
       WHERE dl.liability_type = 'lost'
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT
         COUNT(*) as total_cases,
         COALESCE(SUM(dl.replacement_cost), 0) as total_replacement,
         COALESCE(SUM(dl.liability_amount), 0) as total_liability,
         COALESCE(SUM(dl.amount_paid), 0) as total_paid
       FROM damage_liabilities dl
       WHERE dl.liability_type = 'lost'`
    );

    const sanitized = records.map(r => ({
      ...r,
      replacement_cost: Number(r.replacement_cost) || 0,
      liability_amount: Number(r.liability_amount) || 0,
      amount_paid: Number(r.amount_paid) || 0,
      balance: Number(r.balance) || 0
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalCases: summary[0].total_cases,
        totalReplacement: summary[0].total_replacement,
        totalLiability: summary[0].total_liability,
        totalPaid: summary[0].total_paid
      },
      records: sanitized
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Get loss report error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getOutstandingReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM damage_liabilities WHERE status IN ('pending', 'unpaid', 'partially_paid')`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT dl.*, u.full_name as created_by_name
       FROM damage_liabilities dl
       LEFT JOIN users u ON dl.created_by = u.id
       WHERE dl.status IN ('pending', 'unpaid', 'partially_paid')
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT
         COUNT(*) as total_cases,
         COALESCE(SUM(dl.liability_amount), 0) as total_liability,
         COALESCE(SUM(dl.amount_paid), 0) as total_paid,
         COALESCE(SUM(dl.liability_amount - dl.amount_paid), 0) as total_balance
       FROM damage_liabilities dl
       WHERE dl.status IN ('pending', 'unpaid', 'partially_paid')`
    );

    const sanitized = records.map(r => ({
      ...r,
      replacement_cost: Number(r.replacement_cost) || 0,
      liability_amount: Number(r.liability_amount) || 0,
      amount_paid: Number(r.amount_paid) || 0,
      balance: Number(r.balance) || 0
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalCases: summary[0].total_cases,
        totalLiability: summary[0].total_liability,
        totalPaid: summary[0].total_paid,
        totalBalance: summary[0].total_balance
      },
      records: sanitized
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Get outstanding report error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getPaidReport = async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM damage_liabilities WHERE status = 'paid'`
    );
    const total = countResult[0].total;

    const [records] = await pool.query(
      `SELECT dl.*, u.full_name as created_by_name
       FROM damage_liabilities dl
       LEFT JOIN users u ON dl.created_by = u.id
       WHERE dl.status = 'paid'
       ORDER BY dl.paid_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [summary] = await pool.query(
      `SELECT
         COUNT(*) as total_cases,
         COALESCE(SUM(dl.liability_amount), 0) as total_liability,
         COALESCE(SUM(dl.amount_paid), 0) as total_paid
       FROM damage_liabilities dl
       WHERE dl.status = 'paid'`
    );

    const sanitized = records.map(r => ({
      ...r,
      replacement_cost: Number(r.replacement_cost) || 0,
      liability_amount: Number(r.liability_amount) || 0,
      amount_paid: Number(r.amount_paid) || 0,
      balance: Number(r.balance) || 0
    }));

    res.json(buildReportResponse({
      generatedBy: { full_name: req.user.full_name, role: req.user.role_name || req.user.role },
      generatedAt: new Date().toISOString(),
      summary: {
        totalCases: summary[0].total_cases,
        totalLiability: summary[0].total_liability,
        totalPaid: summary[0].total_paid
      },
      records: sanitized
    }, { page, limit, total }));
  } catch (error) {
    req.log.error({ err: error }, 'Get paid report error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getLiabilities,
  createLiability,
  recordPayment,
  waiveLiability,
  getLiabilityReceipt,
  getPaymentHistory,
  markAsPaid,
  // Reports
  getDamageReport,
  getLossReport,
  getOutstandingReport,
  getPaidReport
};
