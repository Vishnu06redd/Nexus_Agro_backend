const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Nexus Agro" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`;

// ── Helpers ────────────────────────────────────────────────

const sendQuoteAck = async ({ to, name, productName }) => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Nexus Agro — We received your quote request',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#C89B3C;">Thank you, ${name}!</h2>
        <p>We've received your quote request for <strong>${productName || 'our products'}</strong>.</p>
        <p>Our team will get back to you within <strong>1–2 business days</strong>.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#888;font-size:12px;">Nexus Agro · Bengaluru, Karnataka, India</p>
      </div>`,
  });
};

const sendContactAck = async ({ to, name }) => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Nexus Agro — Message received',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#C89B3C;">Hello, ${name}!</h2>
        <p>Thank you for reaching out. We've received your message and will reply shortly.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#888;font-size:12px;">Nexus Agro · Bengaluru, Karnataka, India</p>
      </div>`,
  });
};

const sendContactNotification = async ({ name, email, phone, message }) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
  await transporter.sendMail({
    from: FROM,
    to: adminEmail,
    replyTo: email,
    subject: `New Contact Message — ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#C89B3C;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;background:#f8f8f8;padding:12px;border-radius:6px;">${message}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#888;font-size:12px;">Reply directly to this email to respond to ${name}, or check the admin dashboard.</p>
      </div>`,
  });
};

const sendVerificationEmail = async ({ to, name, token }) => {
  const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Nexus Agro — Verify your email',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#C89B3C;">Welcome, ${name}!</h2>
        <p>Click the button below to verify your email address.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#C89B3C;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email</a>
        <p style="color:#888;font-size:12px;">Link expires in 24 hours.</p>
      </div>`,
  });
};

const sendPasswordReset = async ({ to, name, token }) => {
  const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Nexus Agro — Password Reset',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#C89B3C;">Password Reset Request</h2>
        <p>Hi ${name}, click below to reset your password. Expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#C89B3C;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
        <p style="color:#888;font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>`,
  });
};

const sendNewsletterWelcome = async ({ to }) => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Nexus Agro — You\'re subscribed!',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;">
        <h2 style="color:#C89B3C;">Welcome to Nexus Agro Newsletter!</h2>
        <p>You'll receive the latest export news, market trends, and product updates.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#888;font-size:12px;">Nexus Agro · Bengaluru, Karnataka, India</p>
      </div>`,
  });
};

module.exports = {
  sendQuoteAck,
  sendContactAck,
  sendContactNotification,
  sendVerificationEmail,
  sendPasswordReset,
  sendNewsletterWelcome,
};
