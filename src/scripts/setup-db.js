/**
 * Run once to create all tables and seed initial data.
 * Usage: node src/scripts/setup-db.js
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function setup() {
  console.log('🔧  Running Nexus Agro database setup...\n');
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../config/schema.sql'), 'utf8'
    );

    // Generate a real bcrypt hash for the default admin
    console.log('🔑  Generating admin password hash...');
    const adminPass = process.env.ADMIN_PASSWORD || '$$$@@!kitkatV69';
    const hash = await bcrypt.hash(adminPass, 12);

    // Replace placeholder hash in SQL
    const finalSql = sql.replace(
      '$2a$12$placeholderHashReplaceThisWithReal',
      hash
    );

    await client.query(finalSql);
    console.log('✅  Tables created & seed data inserted.');
    console.log(`\n👤  Admin login:`);
    console.log(`    Email:    ${process.env.ADMIN_EMAIL || 'admin@nexusgroup.com'}`);
    console.log(`    Password: ${adminPass}`);
    console.log('\n🚀  Setup complete. Run: npm run dev\n');
  } catch (err) {
    console.error('❌  Setup failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
