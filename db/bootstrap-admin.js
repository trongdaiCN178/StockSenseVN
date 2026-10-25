import pg from 'pg';
import { hashPassword } from '../apps/api/src/auth/password.js';
import { isStrongPassword, PASSWORD_POLICY_TEXT } from '@stocksense/core/password';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to bootstrap the first admin.');

const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !/^\S+@\S+\.\S+$/.test(email.trim()) || !isStrongPassword(password)) {
  throw new Error(`Set BOOTSTRAP_ADMIN_EMAIL (valid email) and BOOTSTRAP_ADMIN_PASSWORD env vars before running this script. ${PASSWORD_POLICY_TEXT}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows: existingAdmins } = await client.query(`SELECT count(*)::integer AS count FROM users WHERE role = 'admin'`);
  if (existingAdmins[0].count > 0) {
    throw new Error('An admin account already exists. Bootstrap only runs once, when there is no admin yet. Use an existing admin to create more.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const inserted = await client.query(`INSERT INTO users(email, password_hash, role, must_change_password, email_verified_at, created_via)
    VALUES ($1, $2, 'admin', true, now(), 'bootstrap')
    ON CONFLICT (email) DO NOTHING
    RETURNING id`, [normalizedEmail, passwordHash]);
  if (!inserted.rows[0]) {
    throw new Error(`An account with email ${normalizedEmail} already exists. Choose a different BOOTSTRAP_ADMIN_EMAIL.`);
  }
  await client.query(`INSERT INTO admin_audit_log(actor_user_id, target_user_id, event_type, details)
    VALUES (NULL, $1, 'user.created', '{"created_via":"bootstrap"}'::jsonb)`, [inserted.rows[0].id]);

  await client.query('COMMIT');
  console.log(`Bootstrap admin created: ${normalizedEmail}. Must change password on first login.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
