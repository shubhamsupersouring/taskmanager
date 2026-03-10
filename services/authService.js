const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../database');

function getAppBaseUrl() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function authenticateUser(email, password) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail || !password) {
    return { ok: false, reason: 'missing_fields' };
  }

  const user = await db('users').where({ email: normalizedEmail }).first();
  if (!user) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      member_id: user.member_id
    }
  };
}

async function createPasswordReset(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    return;
  }

  const user = await db('users').where({ email: normalizedEmail }).first();
  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db('password_resets').insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
    used: false
  });

  try {
    const transporter = createTransporter();
    const resetUrl = `${getAppBaseUrl()}/reset-password/${token}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'WorkTrack - Reset your password',
      html: `<p>You requested a password reset for your WorkTrack account.</p>
             <p><a href="${resetUrl}">Click here to set a new password</a></p>
             <p>This link will expire in 1 hour.</p>`
    });
  } catch (err) {
    console.error('Failed to send reset email', err);
  }
}

async function findValidResetToken(token) {
  if (!token) return null;
  const reset = await db('password_resets')
    .where({ token, used: false })
    .andWhere('expires_at', '>', new Date())
    .first();
  return reset || null;
}

async function resetPasswordWithToken(token, password, confirmPassword) {
  if (!token || !password || !confirmPassword) {
    return { ok: false, reason: 'missing_fields' };
  }
  if (password !== confirmPassword) {
    return { ok: false, reason: 'mismatch' };
  }

  const reset = await findValidResetToken(token);
  if (!reset) {
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.transaction(async (trx) => {
    await trx('users')
      .where({ id: reset.user_id })
      .update({ password_hash: passwordHash });
    await trx('password_resets')
      .where({ id: reset.id })
      .update({ used: true });
  });

  return { ok: true };
}

module.exports = {
  authenticateUser,
  createPasswordReset,
  findValidResetToken,
  resetPasswordWithToken
};

