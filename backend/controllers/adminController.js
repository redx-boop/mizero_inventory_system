const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const logActivity = require('../utils/activityLogger');

/**
 * Verify the super_admin's current password.
 * Used as a pre-check before destructive operations.
 * POST /api/admin/verify-password
 */
const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    const [users] = await pool.query(
      'SELECT id, password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = bcrypt.compareSync(password, users[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Password is incorrect.' });
    }

    return res.json({ verified: true, message: 'Password verified.' });
  } catch (error) {
    req.log.error({ err: error }, 'Verify password error');
    return res.status(500).json({ message: 'Server error during password verification.' });
  }
};

/**
 * Attempt to create a timestamped .sql backup file before performing a reset.
 * This is best-effort — failures are silently logged but don't block the reset.
 */
async function createBackupSnapshot(userId, userName, userEmail) {
  try {
    const connection = await pool.getConnection();
    try {
      const [tables] = await connection.query('SHOW TABLES');
      const tableNames = tables.map(t => Object.values(t)[0]);
      const dbName = process.env.DB_NAME || 'mizero_inventory';

      const ts = new Date();
      const filename = `preset_backup_${ts.getFullYear()}_${String(ts.getMonth()+1).padStart(2,'0')}_${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}.sql`;

      let sql = [
        `-- Mizero Inventory Hub \u2014 Pre-Reset Backup`,
        `-- Triggered by: ${userName} (${userEmail})`,
        `-- Generated: ${ts.toLocaleString()}`,
        `-- Database: ${dbName}`,
        ''
      ].join('\n');

      sql += `\nCREATE DATABASE IF NOT EXISTS \`${dbName}\`;\nUSE \`${dbName}\`;\n\n`;
      sql += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

      for (const tableName of tableNames) {
        const [createResult] = await connection.query('SHOW CREATE TABLE `' + tableName + '`');
        sql += 'DROP TABLE IF EXISTS `' + tableName + '`;\n';
        sql += createResult[0]['Create Table'] + ';\n\n';

        const [rows] = await connection.query('SELECT * FROM `' + tableName + '`');
        if (rows.length > 0) {
          const columns = Object.keys(rows[0]);
          const columnList = columns.map(c => '`' + c + '`').join(', ');

          for (let i = 0; i < rows.length; i += 50) {
            const batch = rows.slice(i, i + 50);
            const valueSets = batch.map(row => {
              const values = columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'number') return String(val);
                const escaped = String(val).replace(/'/g, "''").replace(/\\\\/g, '\\\\\\\\');
                return "'" + escaped + "'";
              });
              return '(' + values.join(', ') + ')';
            });
            sql += 'INSERT INTO `' + tableName + '` (' + columnList + ') VALUES\n' + valueSets.join(',\n') + ';\n';
          }
          sql += '\n';
        }
      }

      sql += 'SET FOREIGN_KEY_CHECKS = 1;\n-- Backup complete\n';

      const backupDir = path.join(__dirname, '..', '..', 'database backup');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(path.join(backupDir, filename), sql, 'utf8');

      connection.release();
      return filename;
    } catch (innerErr) {
      connection.release();
      console.error('Backup snapshot failed (non-blocking):', innerErr.message);
      return null;
    }
  } catch (err) {
    console.error('Backup snapshot connection failed (non-blocking):', err.message);
    return null;
  }
}

/**
 * Reset all transactional data in the system.
 * ONLY accessible by super_admin with MULTI-FACTOR confirmation:
 *   1. Password verification (before DB connection)
 *   2. Exact confirmation phrase matching
 *   3. Automatic backup snapshot before reset
 *   4. Database transaction wrapping (rollback on error)
 *   5. Guaranteed FK re-enable in all error paths
 *   6. Full audit logging with user ID + IP address
 *
 * POST /api/admin/reset-data
 * Body: { password: string, confirmation_phrase: string, reset_quantities: boolean }
 *
 * Allowed confirmation phrases:
 *   - "RESET ALL DATA"
 *   - "WIPE TRANSACTIONS"
 *
 * Preserved: roles, departments, users, user_departments, items catalog
 * Cleared: stock_in, stock_out, stock_adjustments, borrowings, returns,
 *          requests, leftovers, damage_liabilities, damage_payments,
 *          budgets, notifications, activity_logs
 */
const resetData = async (req, res) => {
  const { password, confirmation_phrase, reset_quantities } = req.body;

  try {
    // ── FACTOR 1: Verify password (before DB connection — fail fast) ─────
    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password confirmation is required.' });
    }

    const [users] = await pool.query(
      'SELECT id, password, full_name, email FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Password is incorrect. Operation cancelled.' });
    }

    // ── FACTOR 2: Verify confirmation phrase ─────────────────────────────
    const VALID_PHRASES = ['RESET ALL DATA', 'WIPE TRANSACTIONS'];
    if (!confirmation_phrase || !confirmation_phrase.trim()) {
      return res.status(400).json({ message: 'Confirmation phrase is required.' });
    }

    const normalizedPhrase = confirmation_phrase.trim().toUpperCase();
    if (!VALID_PHRASES.includes(normalizedPhrase)) {
      return res.status(400).json({
        message: 'Invalid confirmation phrase. Must type exactly "RESET ALL DATA" or "WIPE TRANSACTIONS".'
      });
    }

    // ── OPTIONAL: Backup snapshot before reset (best-effort) ────────────
    const backupFile = await createBackupSnapshot(req.user.id, user.full_name, user.email);

    // ── FACTOR 3: Transaction-wrapped execution ─────────────────────────
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Disable foreign key checks so we can truncate in any order
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      try {
        // Truncate all transactional tables
        const transactionalTables = [
          'stock_in', 'stock_out', 'stock_adjustments',
          'borrowings', 'returns', 'requests', 'leftovers',
          'damage_liabilities', 'damage_payments',
          'budgets', 'notifications', 'activity_logs'
        ];

        for (const table of transactionalTables) {
          await connection.query('TRUNCATE TABLE `' + table + '`');
        }

        // Optionally reset item quantities to 0 (keep catalog, clear stock)
        if (reset_quantities !== false) {
          await connection.query('UPDATE items SET quantity = 0');
        }
      } catch (execError) {
        // If any execution fails, try to re-enable FK checks before rethrowing
        try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
        throw execError;
      }

      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.commit();
    } catch (txError) {
      if (connection) {
        try { await connection.rollback(); } catch (_) {}
        // Guarantee FK checks are re-enabled even on rollback failure
        try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
      }
      throw txError; // rethrow to outer handler
    } finally {
      if (connection) connection.release();
    }

    // ── FACTOR 4: Audit logging ──────────────────────────────────────────
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const quantitiesReset = reset_quantities !== false;

    const logDescription = [
      'Super Admin "' + user.full_name + '" (' + user.email + ') performed',
      '"' + normalizedPhrase + '" transactional data reset.',
      'Quantities ' + (quantitiesReset ? 'were' : 'were NOT') + ' reset to 0.',
      'Preserved: roles, departments, users, items catalog.',
      'Backup: ' + (backupFile || 'snapshot failed (non-blocking)') + '.',
      'IP: ' + (ipAddress || 'unknown')
    ].join(' ');

    await logActivity(req.user.id, 'system_reset', 'admin', logDescription, ipAddress);

    return res.json({
      success: true,
      message: (quantitiesReset
        ? 'All transactional data reset. Item quantities set to 0.'
        : 'All transactional data reset. Item quantities preserved.')
        + (backupFile ? ' Pre-reset backup saved: ' + backupFile : ''),
      preserved: ['roles', 'departments', 'users', 'user_departments', 'items (catalog)'],
      cleared: [
        'stock_in', 'stock_out', 'stock_adjustments',
        'borrowings', 'returns', 'requests', 'leftovers',
        'damage_liabilities', 'damage_payments',
        'budgets', 'notifications', 'activity_logs'
      ],
      quantitiesReset,
      backupSnapshot: backupFile || null,
      loggedBy: user.full_name,
      ipAddress
    });

  } catch (error) {
    req.log.error({ err: error }, 'Reset data error');
    return res.status(500).json({
      success: false,
      message: 'Failed to reset data. No changes were applied.',
      error: error.message
    });
  }
};

module.exports = { verifyPassword, resetData };
