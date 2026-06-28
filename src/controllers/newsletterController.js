const crypto    = require('crypto');
const { query } = require('../config/db');
const { sendNewsletterWelcome } = require('../config/email');

// ── POST /api/newsletter/subscribe ──────────────────────────
exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;
    const token = crypto.randomBytes(24).toString('hex');

    const existing = await query(
      'SELECT id,is_active FROM newsletter_subscribers WHERE email=$1', [email]
    );

    if (existing.rows.length) {
      if (existing.rows[0].is_active) {
        return res.json({ success: true, message: 'You are already subscribed!' });
      }
      // Re-subscribe
      await query(
        'UPDATE newsletter_subscribers SET is_active=TRUE, unsubscribe_token=$1 WHERE email=$2',
        [token, email]
      );
    } else {
      await query(
        'INSERT INTO newsletter_subscribers (email,unsubscribe_token) VALUES ($1,$2)',
        [email, token]
      );
    }

    sendNewsletterWelcome({ to: email }).catch(console.error);
    res.status(201).json({ success: true, message: 'Subscribed successfully!' });
  } catch (err) {
    console.error('subscribe:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/newsletter/unsubscribe?token=xxx ───────────────
exports.unsubscribe = async (req, res) => {
  try {
    const { token } = req.query;
    const { rows } = await query(
      'UPDATE newsletter_subscribers SET is_active=FALSE WHERE unsubscribe_token=$1 RETURNING id',
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid token.' });
    }
    res.json({ success: true, message: 'Unsubscribed successfully.' });
  } catch (err) {
    console.error('unsubscribe:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/admin/newsletter ────────────────────────────────
exports.getSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const [countRes, dataRes] = await Promise.all([
      query('SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active=TRUE'),
      query(
        'SELECT id,email,subscribed_at FROM newsletter_subscribers WHERE is_active=TRUE ORDER BY subscribed_at DESC LIMIT $1 OFFSET $2',
        [Number(limit), offset]
      ),
    ]);
    res.json({
      success: true,
      total:   Number(countRes.rows[0].count),
      data:    dataRes.rows,
    });
  } catch (err) {
    console.error('getSubscribers:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
