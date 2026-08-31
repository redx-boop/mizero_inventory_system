const nodemailer = require('nodemailer');

/**
 * Email Notification Service
 *
 * Sends transactional emails via SMTP.
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 *
 * If SMTP is not configured, emails are logged to console in development.
 */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log('[EmailService] SMTP not configured. Emails will be logged to console.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Send an email
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional, falls back to text)
 * @returns {Promise<boolean>} Whether the email was sent successfully
 */
async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter();

  if (!transport) {
    console.log(`[EmailService] 📧 Would send email to ${to}:`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${text?.substring(0, 200)}${text?.length > 200 ? '...' : ''}`);
    return true;
  }

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@mizeroinventory.com',
      to,
      subject,
      text,
      html: html || text,
    });
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error.message);
    return false;
  }
}

/**
 * Send a low stock alert email to management users
 */
async function sendLowStockAlert(item, userEmails) {
  if (!userEmails || userEmails.length === 0) return;

  const subject = `⚠️ Low Stock Alert: ${item.name} (SKU: ${item.sku})`;
  const text = [
    `Low Stock Alert`,
    `================`,
    `Item: ${item.name}`,
    `SKU: ${item.sku}`,
    `Current Quantity: ${item.quantity}`,
    `Minimum Stock Level: ${item.minimum_stock}`,
    ``,
    `Please restock this item as soon as possible.`,
    ``,
    `— Mizero Inventory Hub`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">⚠️ Low Stock Alert</h1>
      </div>
      <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">Item</td>
            <td style="padding: 8px;">${item.name}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">SKU</td>
            <td style="padding: 8px; font-family: monospace;">${item.sku}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">Current Quantity</td>
            <td style="padding: 8px; color: #dc2626; font-weight: bold;">${item.quantity}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Minimum Stock</td>
            <td style="padding: 8px;">${item.minimum_stock}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #6b7280;">Please restock this item as soon as possible.</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
        Mizero Inventory Hub — Automated Notification
      </div>
    </div>
  `;

  // Send to all recipients in parallel
  const results = await Promise.allSettled(
    userEmails.map(email => sendEmail({ to: email, subject, text, html }))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log(`[EmailService] Low stock alert sent to ${succeeded}/${userEmails.length} recipients`);
}

/**
 * Send an overdue borrowing reminder email
 */
async function sendOverdueReminder(borrowing, borrowerEmail) {
  if (!borrowerEmail) return;

  const subject = `🔴 Overdue Reminder: ${borrowing.item_name} (Borrowed on ${new Date(borrowing.borrow_date).toLocaleDateString()})`;
  const text = [
    `Overdue Borrowing Reminder`,
    `===========================`,
    `Item: ${borrowing.item_name}`,
    `SKU: ${borrowing.item_sku}`,
    `Borrower: ${borrowing.borrower_name}`,
    `Quantity: ${borrowing.quantity}`,
    `Borrowed On: ${new Date(borrowing.borrow_date).toLocaleDateString()}`,
    `Due Date: ${new Date(borrowing.due_date).toLocaleDateString()}`,
    `Days Overdue: ${Math.floor((new Date() - new Date(borrowing.due_date)) / (1000 * 60 * 60 * 24))}`,
    ``,
    `Please return the item(s) as soon as possible.`,
    ``,
    `— Mizero Inventory Hub`,
  ].join('\n');

  const daysOverdue = Math.floor((new Date() - new Date(borrowing.due_date)) / (1000 * 60 * 60 * 24));

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">🔴 Overdue Borrowing Reminder</h1>
      </div>
      <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">Item</td>
            <td style="padding: 8px;">${borrowing.item_name}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Borrower</td>
            <td style="padding: 8px;">${borrowing.borrower_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">Quantity</td>
            <td style="padding: 8px;">${borrowing.quantity}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Borrowed On</td>
            <td style="padding: 8px;">${new Date(borrowing.borrow_date).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">Due Date</td>
            <td style="padding: 8px; color: #dc2626; font-weight: bold;">${new Date(borrowing.due_date).toLocaleDateString()}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Days Overdue</td>
            <td style="padding: 8px; color: #dc2626; font-weight: bold;">${daysOverdue}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #6b7280;">Please return the item(s) as soon as possible to avoid further escalation.</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
        Mizero Inventory Hub — Automated Notification
      </div>
    </div>
  `;

  return sendEmail({ to: borrowerEmail, subject, text, html });
}

/**
 * Send a notification email for general system events
 */
async function sendNotificationEmail(userEmail, userName, title, message) {
  if (!userEmail) return;

  const subject = `📌 ${title} — Mizero Inventory Hub`;
  const text = [
    `Hello ${userName},`,
    ``,
    `${title}`,
    `${'='.repeat(title.length)}`,
    ``,
    `${message}`,
    ``,
    `— Mizero Inventory Hub`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 18px;">📌 ${title}</h1>
      </div>
      <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #374151; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${message}</p>
      </div>
      <div style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
        Mizero Inventory Hub — Automated Notification
      </div>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, text, html });
}

module.exports = {
  sendEmail,
  sendLowStockAlert,
  sendOverdueReminder,
  sendNotificationEmail,
};
