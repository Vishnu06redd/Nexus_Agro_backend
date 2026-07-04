const { query } = require('../config/db');
const { sendQuoteAck, sendContactAck, sendContactNotification } = require('../config/email');

// ═══════════════════════ QUOTE REQUESTS ═══════════════════════

// ── POST /api/quotes ─────────────────────────────────────────
exports.createQuote = async (req, res) => {
  try {
    const {
      name, email, phone, company, country,
      product_id, product_name, quantity, message,
    } = req.body;

    const { rows } = await query(
      `INSERT INTO quote_requests
         (user_id,name,email,phone,company,country,product_id,product_name,quantity,message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user?.id || null, name, email, phone, company, country,
       product_id || null, product_name, quantity, message]
    );

    // Notify buyer
    sendQuoteAck({ to: email, name, productName: product_name }).catch(console.error);

    res.status(201).json({ success: true, data: rows[0], message: "Quote request submitted! We'll contact you soon." });
  } catch (err) {
    console.error('createQuote:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/quotes/my ───────────────────────────────────────
exports.getMyQuotes = async (req, res) => {
  const { rows } = await query(
    `SELECT qr.*, p.name AS product_name_db FROM quote_requests qr
     LEFT JOIN products p ON qr.product_id = p.id
     WHERE qr.user_id=$1 ORDER BY qr.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, data: rows });
};

// ── GET /api/admin/quotes ────────────────────────────────────
exports.getAllQuotes = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE qr.status=$1`; }
    params.push(Number(limit), offset);

    const { rows } = await query(
      `SELECT qr.*, p.name AS product_db_name
       FROM quote_requests qr
       LEFT JOIN products p ON qr.product_id = p.id
       ${where}
       ORDER BY qr.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllQuotes:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── PATCH /api/admin/quotes/:id ──────────────────────────────
exports.updateQuoteStatus = async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const { rows } = await query(
      `UPDATE quote_requests SET status=$1, admin_notes=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, admin_notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Quote not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateQuoteStatus:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ═══════════════════════ CONTACT MESSAGES ═════════════════════

// ── POST /api/contact ────────────────────────────────────────
exports.createContact = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    await query(
      'INSERT INTO contact_messages (name,email,phone,message) VALUES ($1,$2,$3,$4)',
      [name, email, phone, message]
    );
    sendContactAck({ to: email, name }).catch(console.error);
    sendContactNotification({ name, email, phone, message }).catch(console.error);
    res.status(201).json({ success: true, message: 'Message sent! We\'ll respond shortly.' });
  } catch (err) {
    console.error('createContact:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/admin/contacts ──────────────────────────────────
exports.getAllContacts = async (req, res) => {
  try {
    const { unread, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '';
    if (unread === 'true') { where = 'WHERE is_read=FALSE'; }
    params.push(Number(limit), offset);

    const { rows } = await query(
      `SELECT * FROM contact_messages ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllContacts:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── PATCH /api/admin/contacts/:id/read ──────────────────────
exports.markRead = async (req, res) => {
  await query('UPDATE contact_messages SET is_read=TRUE WHERE id=$1', [req.params.id]);
  res.json({ success: true, message: 'Marked as read.' });
};
