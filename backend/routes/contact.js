const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const { sendEmail } = require('../utils/emailService');

/**
 * Strict rate limiter for contact form — prevents spam.
 * 3 submissions per IP per hour.
 */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Too many contact form submissions. Maximum 3 per hour. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip OPTIONS preflight
  skip: (req) => req.method === 'OPTIONS'
});

// POST /api/contact — Submit a contact form message
router.post(
  '/',
  contactLimiter,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email address'),
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isLength({ min: 3, max: 200 }).withMessage('Subject must be between 3 and 200 characters'),
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters'),
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    const { name, email, subject, message } = req.body;

    // Sanitize user input for safe HTML rendering in emails
    const escapeHtml = (str) =>
      String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    try {
      // Send notification email to the admin/team
      const adminEmail = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || 'admin@mizero.com';

      const emailText = [
        `New Contact Form Submission`,
        `==========================`,
        ``,
        `Name:    ${name}`,
        `Email:   ${email}`,
        `Subject: ${subject}`,
        ``,
        `Message:`,
        `${message}`,
        ``,
        `— Submitted via Mizero Inventory Hub Contact Form`,
      ].join('\n');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #8B9EFF, #A78BFA); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">📬 New Contact Form Submission</h1>
          </div>
          <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #374151; width: 100px; vertical-align: top;">Name</td>
                <td style="padding: 8px 12px; color: #374151;">${safeName}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 8px 12px; font-weight: bold; color: #374151; vertical-align: top;">Email</td>
                <td style="padding: 8px 12px; color: #374151;"><a href="mailto:${safeEmail}" style="color: #8B9EFF;">${safeEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #374151; vertical-align: top;">Subject</td>
                <td style="padding: 8px 12px; color: #374151; font-weight: 600;">${safeSubject}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 12px; font-weight: bold; color: #374151; vertical-align: top;">Message</td>
                <td style="padding: 12px; color: #374151; white-space: pre-wrap; line-height: 1.6;">${safeMessage}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
            Mizero Inventory Hub — Contact Form
          </div>
        </div>
      `;

      const sent = await sendEmail({
        to: adminEmail,
        subject: `📬 Contact: ${safeSubject} — from ${safeName}`,
        text: emailText,
        html: emailHtml,
      });

      // Only send auto-reply if admin notification succeeded
      if (sent) {
        await sendEmail({
          to: email,
          subject: `Thank you for contacting Mizero Inventory Hub`,
          text: [
            `Hi ${safeName},`,
            ``,
            `Thank you for reaching out to us! We have received your message and will get back to you as soon as possible.`,
            ``,
            `Here's a copy of your message:`,
            `------------------------`,
            `Subject: ${safeSubject}`,
            ``,
            `${message}`,
            ``,
            `------------------------`,
            ``,
            `Best regards,`,
            `Mizero Inventory Hub Team`,
            `Mizero Technical Secondary School`,
            `Rusizi, Rwanda`,
          ].join('\n'),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #8B9EFF, #A78BFA); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 18px;">Thank You for Contacting Us 🙏</h1>
              </div>
              <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; line-height: 1.6;">Hi <strong>${safeName}</strong>,</p>
                <p style="color: #374151; line-height: 1.6;">Thank you for reaching out to us! We have received your message and will get back to you as soon as possible.</p>

                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0 0 8px; font-weight: 600; color: #374151;">Your Message:</p>
                  <p style="margin: 0; color: #6b7280; font-size: 13px;"><strong>Subject:</strong> ${safeSubject}</p>
                  <p style="margin: 8px 0 0; color: #6b7280; white-space: pre-wrap;">${safeMessage}</p>
                </div>

                <p style="color: #6b7280; line-height: 1.6; margin-top: 16px;">
                  Best regards,<br/>
                  <strong style="color: #374151;">Mizero Inventory Hub Team</strong><br/>
                  Mizero Technical Secondary School<br/>
                  Rusizi, Rwanda
                </p>
              </div>
              <div style="text-align: center; padding: 12px; color: #9ca3af; font-size: 12px;">
                Mizero Inventory Hub — Contact Form Auto-Reply
              </div>
            </div>
          `
        });
      }

      // Log the submission
      console.log(`[Contact] Message from ${name} <${email}>: ${subject}`);

      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent successfully. We will get back to you shortly.'
      });
    } catch (error) {
      console.error('[Contact] Failed to process contact form:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Sorry, something went wrong. Please try again later.'
      });
    }
  }
);

module.exports = router;
