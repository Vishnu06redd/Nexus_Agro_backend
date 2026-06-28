# Nexus Agro — Backend API

Full backend for the Nexus Agro website built with **Node.js + Express + PostgreSQL**.

---

## Features

| Feature                    | Details                                               |
|----------------------------|-------------------------------------------------------|
| **Authentication**         | JWT login/register, email verification, password reset |
| **Product Catalog**        | Full CRUD + image upload, categories, filters          |
| **Quote Requests**         | Submit, track, admin status management                 |
| **Contact Messages**       | Form submissions, read/unread tracking                 |
| **Newsletter**             | Subscribe / unsubscribe (token-based)                  |
| **Admin Dashboard**        | Stats, recent activity, user & role management         |
| **Email Notifications**    | Auto emails via Nodemailer for all key actions         |
| **Security**               | Helmet, rate limiting, bcrypt, JWT                     |

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 18
- PostgreSQL ≥ 14

### 2. Install
```bash
cd nexus-backend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your database credentials and SMTP settings
```

### 4. Create the database
```bash
psql -U postgres -c "CREATE DATABASE nexus_db;"
```

### 5. Run setup (creates tables + seeds data)
```bash
node src/scripts/setup-db.js
```

### 6. Start the server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server starts at **http://localhost:5000**

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

---

### 🔐 Authentication

| Method | Endpoint                       | Auth    | Description              |
|--------|--------------------------------|---------|--------------------------|
| POST   | `/auth/register`               | Public  | Create buyer account     |
| POST   | `/auth/login`                  | Public  | Login → returns JWT      |
| GET    | `/auth/verify-email?token=xxx` | Public  | Verify email address     |
| POST   | `/auth/forgot-password`        | Public  | Request password reset   |
| POST   | `/auth/reset-password`         | Public  | Reset with token         |
| GET    | `/auth/me`                     | Bearer  | Get current user profile |
| PATCH  | `/auth/me`                     | Bearer  | Update profile           |

**Register body:**
```json
{
  "name": "Ahmed Al-Rashid",
  "email": "ahmed@dubaiimports.com",
  "password": "SecurePass@1",
  "company": "Dubai Imports LLC",
  "country": "UAE",
  "phone": "+971501234567"
}
```

**Login response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "...", "name": "...", "role": "buyer" }
}
```

---

### 📦 Products (Public)

| Method | Endpoint              | Description                        |
|--------|-----------------------|------------------------------------|
| GET    | `/products`           | List all products (filter, search) |
| GET    | `/products/:slug`     | Get single product                 |
| GET    | `/categories`         | List all categories                |

**Query params for `/products`:**
- `category=spices` — filter by category slug
- `search=chilli` — full text search
- `page=1&limit=12` — pagination

---

### 📝 Quote Requests

| Method | Endpoint      | Auth    | Description              |
|--------|---------------|---------|--------------------------|
| POST   | `/quotes`     | Public  | Submit quote request     |
| GET    | `/quotes/my`  | Bearer  | Your own quote history   |

**POST `/quotes` body:**
```json
{
  "name": "Ahmed Al-Rashid",
  "email": "ahmed@example.com",
  "phone": "+971501234567",
  "company": "Dubai Imports",
  "country": "UAE",
  "product_name": "Basmati Rice",
  "quantity": "25 MT",
  "message": "Interested in 1121 aged variety. Please send best price CIF Dubai."
}
```

---

### 📬 Contact Form

| Method | Endpoint   | Auth   | Description       |
|--------|------------|--------|-------------------|
| POST   | `/contact` | Public | Submit a message  |

---

### 📧 Newsletter

| Method | Endpoint                          | Description       |
|--------|-----------------------------------|-------------------|
| POST   | `/newsletter/subscribe`           | Subscribe         |
| GET    | `/newsletter/unsubscribe?token=…` | Unsubscribe       |

---

### 🛡️ Admin Endpoints (role: admin)

All admin routes require `Authorization: Bearer <admin_token>`

**Dashboard**

| Method | Endpoint              | Description                     |
|--------|-----------------------|---------------------------------|
| GET    | `/admin/dashboard`    | Stats + recent activity         |

**Users**

| Method | Endpoint                    | Description        |
|--------|-----------------------------|--------------------|
| GET    | `/admin/users`              | List all users     |
| PATCH  | `/admin/users/:id/role`     | Change user role   |

**Products**

| Method | Endpoint                    | Description             |
|--------|-----------------------------|-------------------------|
| POST   | `/admin/products`           | Create product (+ image)|
| PATCH  | `/admin/products/:id`       | Update product           |
| DELETE | `/admin/products/:id`       | Deactivate product       |

> Image upload via `multipart/form-data`, field name: `image`

**Quotes**

| Method | Endpoint              | Description            |
|--------|-----------------------|------------------------|
| GET    | `/admin/quotes`       | All quote requests     |
| PATCH  | `/admin/quotes/:id`   | Update status / notes  |

Quote status values: `new` → `in_progress` → `quoted` → `closed`

**Contacts**

| Method | Endpoint                        | Description         |
|--------|---------------------------------|---------------------|
| GET    | `/admin/contacts`               | All messages        |
| PATCH  | `/admin/contacts/:id/read`      | Mark as read        |

**Newsletter**

| Method | Endpoint              | Description             |
|--------|-----------------------|-------------------------|
| GET    | `/admin/newsletter`   | List active subscribers |

---

## Connecting to the Frontend

In your Nexus Agro HTML, replace form submits with fetch calls:

```javascript
// Contact form
async function submitContact(formData) {
  const res = await fetch('http://localhost:5000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  return res.json();
}

// Login
async function login(email, password) {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.success) localStorage.setItem('token', data.token);
  return data;
}

// Auth header helper
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
});
```

---

## Project Structure

```
nexus-backend/
├── src/
│   ├── index.js                 # Express app entry point
│   ├── config/
│   │   ├── db.js                # PostgreSQL pool
│   │   ├── email.js             # Nodemailer helpers
│   │   └── schema.sql           # Full DB schema + seeds
│   ├── middleware/
│   │   ├── auth.js              # JWT authenticate + requireRole
│   │   └── validate.js          # express-validator helper
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── quoteController.js
│   │   ├── newsletterController.js
│   │   └── adminController.js
│   ├── routes/
│   │   └── index.js             # All routes
│   └── scripts/
│       └── setup-db.js          # One-time DB setup
├── uploads/                     # Product image storage
├── .env.example
├── package.json
└── README.md
```

---

## Email Setup (Gmail)

1. Go to your Google Account → Security → App Passwords
2. Generate an app password for "Mail"
3. Add to `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password_16chars
```

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random string (32+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Use a real PostgreSQL cloud DB (Supabase, Railway, or RDS)
- [ ] Set `CLIENT_URL` to your actual frontend domain
- [ ] Set up SSL / reverse proxy (Nginx + Certbot)
- [ ] Change default admin password after first login
