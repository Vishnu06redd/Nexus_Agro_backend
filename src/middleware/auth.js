const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * Verifies the JWT in the Authorization header.
 * Attaches req.user = { id, email, role } on success.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Confirm user still exists
    const { rows } = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Role guard — use after authenticate().
 * Usage: requireRole('admin')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
  }
  next();
};

module.exports = { authenticate, requireRole };
