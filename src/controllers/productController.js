const { query } = require('../config/db');
const path      = require('path');
const fs        = require('fs');

// ── GET /api/products ───────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where    = 'WHERE p.is_active = TRUE';

    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    params.push(Number(limit), offset);
    const countQ = `SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id=c.id ${where}`;
    const dataQ  = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.id
      LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const [countRes, dataRes] = await Promise.all([
      query(countQ, params.slice(0, -2)),
      query(dataQ,  params),
    ]);

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total:    Number(countRes.rows[0].count),
        page:     Number(page),
        limit:    Number(limit),
        pages:    Math.ceil(Number(countRes.rows[0].count) / Number(limit)),
      },
    });
  } catch (err) {
    console.error('getProducts:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/products/:slug ──────────────────────────────────
exports.getProduct = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 AND p.is_active = TRUE`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getProduct:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/categories ──────────────────────────────────────
exports.getCategories = async (_req, res) => {
  const { rows } = await query('SELECT * FROM categories ORDER BY name');
  res.json({ success: true, data: rows });
};

// ── POST /api/admin/products ─────────────────────────────────
exports.createProduct = async (req, res) => {
  try {
    const { category_id, name, slug, description, grade, moq, image_url, tags, is_active } = req.body;
    const finalImage = req.file
      ? `/uploads/${req.file.filename}`
      : image_url;

    const { rows } = await query(
      `INSERT INTO products (category_id,name,slug,description,grade,moq,image_url,tags,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [category_id, name, slug, description, grade, moq, finalImage,
       tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
       is_active !== false]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('createProduct:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── PATCH /api/admin/products/:id ───────────────────────────
exports.updateProduct = async (req, res) => {
  try {
    const { category_id, name, slug, description, grade, moq, image_url, tags, is_active } = req.body;
    const finalImage = req.file ? `/uploads/${req.file.filename}` : image_url;

    const { rows } = await query(
      `UPDATE products SET
         category_id=$1, name=$2, slug=$3, description=$4,
         grade=$5, moq=$6, image_url=$7, tags=$8, is_active=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [category_id, name, slug, description, grade, moq, finalImage,
       tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
       is_active !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateProduct:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── DELETE /api/admin/products/:id ──────────────────────────
exports.deleteProduct = async (req, res) => {
  try {
    await query('UPDATE products SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) {
    console.error('deleteProduct:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
