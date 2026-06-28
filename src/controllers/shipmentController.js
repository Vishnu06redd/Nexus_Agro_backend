const { query } = require('../config/db');

const STAGES = ['processing', 'shipped', 'in_transit', 'delivered'];

// ═══════════════════════ BUYER-FACING ══════════════════════════

// ── GET /api/shipments/my ─────────────────────────────────────
exports.getMyShipments = async (req, res) => {
  try {
    const { rows: shipments } = await query(
      `SELECT * FROM shipments WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    if (!shipments.length) return res.json({ success: true, data: [] });

    const ids = shipments.map((s) => s.id);
    const { rows: events } = await query(
      `SELECT * FROM shipment_events WHERE shipment_id = ANY($1::int[]) ORDER BY event_time ASC`,
      [ids]
    );

    const data = shipments.map((s) => ({
      ...s,
      events: events.filter((e) => e.shipment_id === s.id),
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('getMyShipments:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/shipments/track/:trackingNumber (public) ─────────
exports.trackByNumber = async (req, res) => {
  try {
    const { trackingNumber } = req.params;
    const { rows } = await query(
      `SELECT id,tracking_number,product_name,quantity,carrier,origin_port,
              destination_port,status,eta,created_at
       FROM shipments WHERE tracking_number=$1`,
      [trackingNumber]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'No shipment found with that tracking number.' });
    }
    const shipment = rows[0];
    const { rows: events } = await query(
      `SELECT status,location,note,event_time FROM shipment_events
       WHERE shipment_id=$1 ORDER BY event_time ASC`,
      [shipment.id]
    );
    res.json({ success: true, data: { ...shipment, events } });
  } catch (err) {
    console.error('trackByNumber:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ═══════════════════════ ADMIN ═════════════════════════════════

// ── GET /api/admin/shipments ────────────────────────────────────
exports.getAllShipments = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, u.name AS user_name, u.email AS user_email
       FROM shipments s LEFT JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllShipments:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/admin/shipments ───────────────────────────────────
exports.createShipment = async (req, res) => {
  try {
    const {
      user_id, quote_id, tracking_number, product_name, quantity,
      carrier, origin_port, destination_port, status, eta,
    } = req.body;

    if (!tracking_number || !product_name) {
      return res.status(400).json({ success: false, message: 'tracking_number and product_name are required.' });
    }
    if (status && !STAGES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STAGES.join(', ')}` });
    }

    const { rows } = await query(
      `INSERT INTO shipments
         (user_id,quote_id,tracking_number,product_name,quantity,carrier,origin_port,destination_port,status,eta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [user_id || null, quote_id || null, tracking_number, product_name, quantity || null,
       carrier || null, origin_port || null, destination_port || null, status || 'processing', eta || null]
    );

    await query(
      `INSERT INTO shipment_events (shipment_id,status,location,note) VALUES ($1,$2,$3,$4)`,
      [rows[0].id, rows[0].status, origin_port || null, 'Shipment created.']
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('createShipment:', err);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'That tracking number already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── PATCH /api/admin/shipments/:id ──────────────────────────────
exports.updateShipmentStatus = async (req, res) => {
  try {
    const { status, eta, carrier, origin_port, destination_port } = req.body;
    if (status && !STAGES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STAGES.join(', ')}` });
    }
    const { rows } = await query(
      `UPDATE shipments SET
         status            = COALESCE($1, status),
         eta               = COALESCE($2, eta),
         carrier           = COALESCE($3, carrier),
         origin_port       = COALESCE($4, origin_port),
         destination_port  = COALESCE($5, destination_port),
         updated_at        = NOW()
       WHERE id=$6 RETURNING *`,
      [status || null, eta || null, carrier || null, origin_port || null, destination_port || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Shipment not found.' });

    if (status) {
      await query(
        `INSERT INTO shipment_events (shipment_id,status,location,note) VALUES ($1,$2,$3,$4)`,
        [req.params.id, status, destination_port || origin_port || null, 'Status updated.']
      );
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateShipmentStatus:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/admin/shipments/:id/events ────────────────────────
exports.addShipmentEvent = async (req, res) => {
  try {
    const { status, location, note } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required.' });
    if (!STAGES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STAGES.join(', ')}` });
    }

    const { rows } = await query(
      `INSERT INTO shipment_events (shipment_id,status,location,note)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, status, location || null, note || null]
    );

    await query(
      `UPDATE shipments SET status=$1, updated_at=NOW() WHERE id=$2`,
      [status, req.params.id]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('addShipmentEvent:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};