const { query } = require('../config/db');

// ── GET /api/admin/dashboard ─────────────────────────────────
exports.getDashboard = async (_req, res) => {
  try {
    const [users, quotes, contacts, subscribers, recentQuotes, recentContacts] =
      await Promise.all([
        query('SELECT COUNT(*) FROM users WHERE role=\'buyer\''),
        query(`SELECT
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status='new')         AS new_count,
                 COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
                 COUNT(*) FILTER (WHERE status='quoted')      AS quoted,
                 COUNT(*) FILTER (WHERE status='closed')      AS closed
               FROM quote_requests`),
        query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_read=FALSE) AS unread FROM contact_messages'),
        query('SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active=TRUE'),
        query('SELECT id,name,email,product_name,status,created_at FROM quote_requests ORDER BY created_at DESC LIMIT 5'),
        query('SELECT id,name,email,message,is_read,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5'),
      ]);

    res.json({
      success: true,
      stats: {
        buyers:              Number(users.rows[0].count),
        quotes:              quotes.rows[0],
        messages:            contacts.rows[0],
        newsletter_active:   Number(subscribers.rows[0].count),
      },
      recent: {
        quotes:   recentQuotes.rows,
        contacts: recentContacts.rows,
      },
    });
  } catch (err) {
    console.error('getDashboard:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/admin/users ─────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE name ILIKE $1 OR email ILIKE $1`;
    }
    params.push(Number(limit), offset);

    const { rows } = await query(
      `SELECT id,name,email,role,company,country,is_verified,created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllUsers:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── PATCH /api/admin/users/:id/role ─────────────────────────
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['buyer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    const { rows } = await query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role', [role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateUserRole:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
