const cron = require('node-cron');
const pool = require('../config/db');
const { notifyManagement } = require('../utils/notificationHelper');

/**
 * Overdue Borrowing Check — runs automatically at midnight (00:00) every day.
 *
 * Scans all borrowings where:
 *   - status = 'borrowed'
 *   - due_date < today's date (CURDATE())
 *
 * Updates them to status = 'overdue' and logs the activity.
 */
function startOverdueCron() {
  // Schedule: every day at midnight (system time)
  cron.schedule('0 0 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Looking for overdue borrowings...`);

    let connection;
    try {
      connection = await pool.getConnection();

      // Get count before updating
      const [before] = await connection.query(
        `SELECT COUNT(*) as count FROM borrowings
         WHERE status = 'borrowed' AND due_date < CURDATE()`
      );
      const pendingCount = before[0].count;

      if (pendingCount === 0) {
        console.log(`[${new Date().toISOString()}] No overdue borrowings found.`);
        return;
      }

      // Update overdue borrowings
      await connection.query(
        `UPDATE borrowings
         SET status = 'overdue'
         WHERE status = 'borrowed' AND due_date < CURDATE()`
      );

      console.log(`[${new Date().toISOString()}] Marked ${pendingCount} borrowings as overdue.`);

      // Notify management about overdue borrowings
      try {
        const [overdueBorrowings] = await connection.query(
          `SELECT b.id, i.name as item_name, b.borrower_name
           FROM borrowings b
           JOIN items i ON b.item_id = i.id
           WHERE b.status = 'overdue' AND b.due_date < CURDATE()
           LIMIT 50`
        );

        if (overdueBorrowings.length > 0) {
          const borrowerList = [...new Set(overdueBorrowings.map(b => b.borrower_name))].slice(0, 5).join(', ');
          const suffix = overdueBorrowings.length > 5 ? ` and ${overdueBorrowings.length - 5} more` : '';
          try {
            await notifyManagement(
              'Overdue Borrowings Detected',
              `${pendingCount} borrowing(s) marked overdue. Overdue borrowers: ${borrowerList}${suffix}. Immediate action required.`,
              'borrowing',
              null,
              null,
              'warning',
              '/borrowings'
            );
          } catch (notifErr) {
            console.error('Failed to notify overdue management:', notifErr.message);
          }
        }
      } catch (notifErr) {
        console.error('Failed to notify overdue:', notifErr.message);
      }

      // Log to activity_logs
      try {
        await connection.query(
          `INSERT INTO activity_logs (user_id, action, module, description, created_at)
           VALUES (?, 'system', 'borrowing', ?, NOW())`,
          [1, `Auto-marked ${pendingCount} overdue borrowings (cron job).`]
        );
      } catch (logErr) {
        await connection.query(
          `INSERT INTO activity_logs (user_id, action, module, description, created_at)
           VALUES (NULL, 'system', 'borrowing', ?, NOW())`,
          [`Auto-marked ${pendingCount} overdue borrowings (cron job).`]
        );
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Overdue cron error:`, error.message);
    } finally {
      if (connection) connection.release();
    }
  });

  console.log('Overdue check cron job scheduled: runs daily at midnight');
}

/**
 * Run the overdue check manually (for testing or on-demand via API).
 */
async function runOverdueCheck() {
  let connection;
  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      `UPDATE borrowings
       SET status = 'overdue'
       WHERE status = 'borrowed' AND due_date < CURDATE()`
    );

    const updatedCount = result.affectedRows;

    if (updatedCount > 0) {
      try {
        await connection.query(
          `INSERT INTO activity_logs (user_id, action, module, description, created_at)
           VALUES (?, 'system', 'borrowing', ?, NOW())`,
          [1, `Auto-marked ${updatedCount} overdue borrowings (manual trigger).`]
        );
      } catch (logErr) {
        await connection.query(
          `INSERT INTO activity_logs (user_id, action, module, description, created_at)
           VALUES (NULL, 'system', 'borrowing', ?, NOW())`,
          [`Auto-marked ${updatedCount} overdue borrowings (manual trigger).`]
        );
      }

    }

    return updatedCount;
  } catch (error) {
    console.error('Manual overdue check error:', error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { startOverdueCron, runOverdueCheck };
