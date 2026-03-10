const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../database');

function getAppBaseUrl() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

function createTransporter() {
  return nodemailer.createTransport({
    // Gmail SMTP with app password
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
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
    console.log('[ForgotPassword] Empty email, aborting.');
    return;
  }

  const user = await db('users').where({ email: normalizedEmail }).first();
  if (!user) {
    console.log('[ForgotPassword] No user found for email:', normalizedEmail);
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
    console.log('[ForgotPassword] Sending reset email to:', user.email, 'URL:', resetUrl);
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'TrackerBabu – Reset your password',
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Reset your password</title>
          </head>
          <body style="margin:0;padding:0;background:#f3fff8;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:radial-gradient(circle at top left,#d4fbe7 0,transparent 55%),radial-gradient(circle at bottom right,#c5f3dd 0,transparent 55%),linear-gradient(135deg,#f6fff9,#e4f9ee);padding:24px 12px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:#ffffff;border-radius:18px;border:1px solid rgba(15,163,108,0.08);box-shadow:0 20px 55px rgba(15,163,108,0.18);padding:24px 28px;">
                    <tr>
                      <td style="padding-bottom:12px;">
                        <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(15,163,108,0.08);color:#0a7c52;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">
                          TrackerBabu
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:8px;">
                        <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0a7c52;font-weight:700;">
                          Reset your TrackerBabu password
                        </h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:16px;">
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#435750;">
                          You requested a password reset for your TrackerBabu account
                          (<strong>${user.email}</strong>).
                        </p>
                        <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#435750;">
                          Click the button below to choose a new password. For security,
                          this link will expire in <strong>1 hour</strong>.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:6px 0 18px;">
                        <a href="${resetUrl}"
                           style="display:inline-block;padding:10px 22px;border-radius:999px;background:#0fa36c;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                          Reset password
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:16px;">
                        <p style="margin:0;font-size:12px;line-height:1.6;color:#70827a;">
                          If the button doesn’t work, paste this link into your browser:
                        </p>
                        <p style="margin:6px 0 0;font-size:11px;line-height:1.5;color:#4a635a;word-break:break-all;">
                          ${resetUrl}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid #e2f2e9;padding-top:10px;">
                        <p style="margin:0;font-size:11px;line-height:1.5;color:#7a9188;">
                          If you didn’t request this, you can safely ignore this email – your
                          password will stay the same.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `
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

