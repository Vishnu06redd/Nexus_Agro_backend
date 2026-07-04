const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/db');
const email     = require('../config/email');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── POST /api/auth/register ──────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email: userEmail, password, company, country, phone } = req.body;

    const existing = await query('SELECT id FROM users WHERE email=$1', [userEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hash         = await bcrypt.hash(password, 12);
    const verifyToken  = crypto.randomBytes(32).toString('hex');

    const { rows } = await query(
      `INSERT INTO users (name,email,password_hash,company,country,phone,verify_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role`,
      [name, userEmail, hash, company, country, phone, verifyToken]
    );

    // Fire-and-forget verification email
    email.sendVerificationEmail({ to: userEmail, name, token: verifyToken }).catch(console.error);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      user: rows[0],
    });
  } catch (err) {
    console.error('register:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/auth/login ─────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email: userEmail, password } = req.body;

    const { rows } = await query(
      'SELECT * FROM users WHERE email=$1', [userEmail]
    );
    const user = rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken(user.id);
    const { password_hash, verify_token, reset_token, reset_token_expires, ...safe } = user;

    return res.json({
      success: true,
      token,
      user: safe,
    });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/auth/google ────────────────────────────────────
// Body: { credential }  — the ID token returned by Google Identity Services
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Missing Google credential.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, message: 'Google login is not configured on the server.' });
    }

    // Verifies the token's signature, audience, issuer and expiry against Google.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email: userEmail, name, email_verified } = payload;

    if (!email_verified) {
      return res.status(401).json({ success: false, message: 'Your Google email is not verified.' });
    }

    const { rows } = await query('SELECT * FROM users WHERE email=$1 OR google_id=$2', [userEmail, googleId]);
    let user = rows[0];

    if (!user) {
      // Brand new account, created via Google — no password set.
      const inserted = await query(
        `INSERT INTO users (name,email,password_hash,google_id,role,is_verified)
         VALUES ($1,$2,NULL,$3,'buyer',TRUE) RETURNING *`,
        [name || userEmail.split('@')[0], userEmail, googleId]
      );
      user = inserted.rows[0];
    } else if (!user.google_id) {
      // Existing email/password account — link the Google identity to it.
      const updated = await query(
        `UPDATE users SET google_id=$1, is_verified=TRUE WHERE id=$2 RETURNING *`,
        [googleId, user.id]
      );
      user = updated.rows[0];
    }

    const token = signToken(user.id);
    const { password_hash, verify_token, reset_token, reset_token_expires, google_id, ...safe } = user;

    return res.json({ success: true, token, user: safe });
  } catch (err) {
    console.error('googleLogin:', err);
    return res.status(401).json({ success: false, message: 'Google authentication failed. Please try again.' });
  }
};


exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const { rows } = await query(
      `UPDATE users SET is_verified=TRUE, verify_token=NULL
       WHERE verify_token=$1 RETURNING id`, [token]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('verifyEmail:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/auth/forgot-password ──────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email: userEmail } = req.body;
    const { rows } = await query('SELECT id,name FROM users WHERE email=$1', [userEmail]);
    if (!rows.length) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    await query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [token, expires, userEmail]
    );
    email.sendPasswordReset({ to: userEmail, name: rows[0].name, token }).catch(console.error);
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/auth/reset-password ───────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const { rows } = await query(
      `SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Token invalid or expired.' });
    }
    const hash = await bcrypt.hash(password, 12);
    await query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE id=$2',
      [hash, rows[0].id]
    );
    res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('resetPassword:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────
exports.getMe = async (req, res) => {
  const { rows } = await query(
    'SELECT id,name,email,role,company,country,phone,is_verified,created_at FROM users WHERE id=$1',
    [req.user.id]
  );
  res.json({ success: true, user: rows[0] });
};

// ── PATCH /api/auth/me ───────────────────────────────────────
exports.updateMe = async (req, res) => {
  try {
    const { name, company, country, phone } = req.body;
    const { rows } = await query(
      `UPDATE users SET name=$1,company=$2,country=$3,phone=$4,updated_at=NOW()
       WHERE id=$5 RETURNING id,name,email,role,company,country,phone`,
      [name, company, country, phone, req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('updateMe:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
