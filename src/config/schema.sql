-- ============================================================
--  NEXUS AGRO — Full Database Schema
-- ============================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS (buyers + admins) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                            -- NULL allowed for Google-only accounts
  google_id     VARCHAR(255) UNIQUE,                      -- Google "sub" claim, set for Google sign-ins
  role          VARCHAR(20)  NOT NULL DEFAULT 'buyer'   -- 'buyer' | 'admin'
                  CHECK (role IN ('buyer','admin')),
  company       VARCHAR(200),
  country       VARCHAR(100),
  phone         VARCHAR(30),
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token  VARCHAR(255),
  reset_token   VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCT CATEGORIES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  category_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  slug          VARCHAR(200) UNIQUE NOT NULL,
  description   TEXT,
  grade         VARCHAR(100),
  moq           VARCHAR(50),           -- e.g. "5 MT"
  image_url     VARCHAR(500),
  tags          TEXT[],                -- e.g. ARRAY['Grade A','Export Quality']
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── QUOTE REQUESTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_requests (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(200) NOT NULL,
  phone       VARCHAR(30),
  company     VARCHAR(200),
  country     VARCHAR(100),
  product_id  INT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200),           -- fallback if no FK
  quantity    VARCHAR(100),
  message     TEXT,
  status      VARCHAR(30) NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','in_progress','quoted','closed')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CONTACT MESSAGES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(200) NOT NULL,
  phone       VARCHAR(30),
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NEWSLETTER SUBSCRIBERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           SERIAL PRIMARY KEY,
  email        VARCHAR(200) UNIQUE NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  unsubscribe_token VARCHAR(255) UNIQUE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug        ON products(slug);
CREATE INDEX IF NOT EXISTS idx_quote_status         ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_unread       ON contact_messages(is_read);

-- ── SEED: DEFAULT ADMIN ─────────────────────────────────────
-- Password hash below = bcrypt of 'Admin@123' (cost 12)
-- REPLACE this hash after running: node -e "require('bcryptjs').hash('Admin@123',12).then(console.log)"
INSERT INTO users (name, email, password_hash, role, is_verified)
VALUES (
  'Nexus Admin',
  'reddykamalesh0@gmail.com',
  '$2a$12$placeholderHashReplaceThisWithReal',
  'admin',
  TRUE
)
ON CONFLICT (email)
DO UPDATE SET
password_hash = EXCLUDED.password_hash;

-- ── SEED: CATEGORIES ────────────────────────────────────────
INSERT INTO categories (name, slug) VALUES
  ('Fresh Vegetables', 'fresh-vegetables'),
  ('Spices',           'spices'),
  ('Pulses',           'pulses'),
  ('Grains',           'grains'),
  ('Oil Seeds',        'oil-seeds')
ON CONFLICT (slug) DO NOTHING;

-- ── SEED: PRODUCTS ──────────────────────────────────────────
INSERT INTO products (category_id, name, slug, description, grade, moq, image_url, tags)
VALUES
  (1, 'Fresh Green Chilli', 'fresh-green-chilli',
   'Premium quality green chillies from Andhra Pradesh and Maharashtra.',
   'Grade A', '5 MT',
   'https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=600',
   ARRAY['Grade A','Export Quality','Fresh']),

  (1, 'Red Chilli', 'red-chilli',
   'Rich aroma and deep color. Whole, crushed, and powder forms available.',
   'S4 / S17', '10 MT',
   'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600',
   ARRAY['S4 / S17','ASTA Grade','Dried']),

  (1, 'Onion', 'onion',
   'Farm-fresh onions with long shelf life. Red, white, and pink varieties.',
   'Export Grade', '20 MT',
   'https://images.unsplash.com/photo-1508747703725-719777637510?w=600',
   ARRAY['Red / White','Farm Fresh','20 kg Bags']),

  (4, 'Basmati Rice', 'basmati-rice',
   'Authentic aged Basmati from the Himalayan foothills. Long grain, fragrant.',
   '1121 / Pusa', '25 MT',
   'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600',
   ARRAY['1121 / Pusa','Aged','Steam / Sella']),

  (2, 'Spices', 'spices',
   'Turmeric, coriander, cumin, and pepper from Kerala and Tamil Nadu.',
   'Premium', '5 MT',
   'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600',
   ARRAY['Turmeric','Cumin','Pepper']),

  (3, 'Pulses', 'pulses',
   'High-protein lentils, chickpeas, and moong dal. Machine-cleaned.',
   'Export Grade', '20 MT',
   'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=600',
   ARRAY['Lentils','Chickpeas','Moong Dal'])
ON CONFLICT (slug) DO NOTHING;
