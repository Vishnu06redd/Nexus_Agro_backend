const express   = require('express');
const { body }  = require('express-validator');
const multer    = require('multer');
const path      = require('path');
const router    = express.Router();

const { authenticate, requireRole } = require('../middleware/auth');
const { validate }                  = require('../middleware/validate');

const authCtrl        = require('../controllers/authController');
const productCtrl     = require('../controllers/productController');
const quoteCtrl       = require('../controllers/quoteController');
const shipmentCtrl    = require('../controllers/shipmentController');
const newsletterCtrl  = require('../controllers/newsletterController');
const adminCtrl       = require('../controllers/adminController');

// ── Multer (product images) ──────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const safe = path.basename(file.originalname, ext).replace(/\s+/g,'-');
    cb(null, `${safe}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpeg/png/webp images allowed.'));
  },
});

// ═══════════════════════ AUTH ════════════════════════════════

router.post('/auth/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be ≥8 chars.'),
  ],
  validate,
  authCtrl.register
);

router.post('/auth/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authCtrl.login
);

router.get('/auth/verify-email',  authCtrl.verifyEmail);

router.post('/auth/google',
  [body('credential').notEmpty().withMessage('Missing Google credential.')],
  validate,
  authCtrl.googleLogin
);

router.post('/auth/forgot-password',
  [body('email').isEmail()],
  validate,
  authCtrl.forgotPassword
);

router.post('/auth/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  authCtrl.resetPassword
);

router.get('/auth/me',      authenticate, authCtrl.getMe);
router.patch('/auth/me',    authenticate, authCtrl.updateMe);

// ═══════════════════════ PRODUCTS (public) ══════════════════

router.get('/products',           productCtrl.getProducts);
router.get('/products/:slug',     productCtrl.getProduct);
router.get('/categories',         productCtrl.getCategories);

// ═══════════════════════ QUOTES ══════════════════════════════

router.post('/quotes',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('message').trim().notEmpty().withMessage('Message is required.'),
  ],
  validate,
  quoteCtrl.createQuote
);

router.get('/quotes/my', authenticate, quoteCtrl.getMyQuotes);

// ═══════════════════════ SHIPMENTS ═══════════════════════════

router.get('/shipments/my', authenticate, shipmentCtrl.getMyShipments);
router.get('/shipments/track/:trackingNumber', shipmentCtrl.trackByNumber);

// ═══════════════════════ CONTACT ═════════════════════════════

router.post('/contact',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('message').trim().notEmpty(),
  ],
  validate,
  quoteCtrl.createContact
);

// ═══════════════════════ NEWSLETTER ══════════════════════════

router.post('/newsletter/subscribe',
  [body('email').isEmail().withMessage('Valid email required.')],
  validate,
  newsletterCtrl.subscribe
);

router.get('/newsletter/unsubscribe', newsletterCtrl.unsubscribe);

// ═══════════════════════ ADMIN ═══════════════════════════════

const adminOnly = [authenticate, requireRole('admin')];

// Dashboard
router.get('/admin/dashboard', ...adminOnly, adminCtrl.getDashboard);

// Users
router.get('/admin/users',              ...adminOnly, adminCtrl.getAllUsers);
router.patch('/admin/users/:id/role',   ...adminOnly, adminCtrl.updateUserRole);

// Products
router.post('/admin/products',
  ...adminOnly,
  upload.single('image'),
  productCtrl.createProduct
);
router.patch('/admin/products/:id',
  ...adminOnly,
  upload.single('image'),
  productCtrl.updateProduct
);
router.delete('/admin/products/:id',    ...adminOnly, productCtrl.deleteProduct);

// Quotes
router.get('/admin/quotes',             ...adminOnly, quoteCtrl.getAllQuotes);
router.patch('/admin/quotes/:id',       ...adminOnly, quoteCtrl.updateQuoteStatus);

// Shipments
router.get('/admin/shipments',              ...adminOnly, shipmentCtrl.getAllShipments);
router.post('/admin/shipments',             ...adminOnly, shipmentCtrl.createShipment);
router.patch('/admin/shipments/:id',        ...adminOnly, shipmentCtrl.updateShipmentStatus);
router.post('/admin/shipments/:id/events',  ...adminOnly, shipmentCtrl.addShipmentEvent);

// Contacts
router.get('/admin/contacts',           ...adminOnly, quoteCtrl.getAllContacts);
router.patch('/admin/contacts/:id/read',...adminOnly, quoteCtrl.markRead);

// Newsletter
router.get('/admin/newsletter',         ...adminOnly, newsletterCtrl.getSubscribers);

module.exports = router;