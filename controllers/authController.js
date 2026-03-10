const {
  authenticateUser,
  createPasswordReset,
  findValidResetToken,
  resetPasswordWithToken
} = require('../services/authService');

function showLogin(req, res) {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { pageTitle: 'Login' });
}

async function handleLogin(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authenticateUser(email, password);

    if (!result.ok) {
      if (result.reason === 'missing_fields') {
        req.flash('error', 'Email and password are required.');
      } else {
        req.flash('error', 'Invalid email or password.');
      }
      return res.redirect('/login');
    }

    req.session.user = result.user;

    if (result.user.role === 'superadmin') {
      return res.redirect('/');
    }
    if (result.user.member_id) {
      return res.redirect(`/members/${result.user.member_id}`);
    }
    res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to sign in. Please try again.');
    res.redirect('/login');
  }
}

function showForgotPassword(req, res) {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('forgot-password', { pageTitle: 'Forgot Password' });
}

async function handleForgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      req.flash('error', 'Email is required.');
      return res.redirect('/forgot-password');
    }

    await createPasswordReset(email);

    req.flash(
      'success',
      'If this email is registered, a reset link has been sent.'
    );
    res.redirect('/forgot-password');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to process request. Please try again.');
    res.redirect('/forgot-password');
  }
}

async function showResetPassword(req, res) {
  try {
    const { token } = req.params;
    const reset = await findValidResetToken(token);

    if (!reset) {
      req.flash('error', 'Reset link is invalid or has expired.');
      return res.redirect('/login');
    }

    res.render('reset-password', {
      pageTitle: 'Reset Password',
      token
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to open reset page.');
    res.redirect('/login');
  }
}

async function handleResetPassword(req, res) {
  try {
    const { token, password, confirmPassword } = req.body;
    const result = await resetPasswordWithToken(
      token,
      password,
      confirmPassword
    );

    if (!result.ok) {
      if (result.reason === 'missing_fields') {
        req.flash('error', 'All fields are required.');
        return res.redirect('back');
      }
      if (result.reason === 'mismatch') {
        req.flash('error', 'Passwords do not match.');
        return res.redirect('back');
      }
      if (result.reason === 'invalid_or_expired') {
        req.flash('error', 'Reset link is invalid or has expired.');
        return res.redirect('/login');
      }
    }

    req.flash('success', 'Password updated. You can now sign in.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to reset password. Please try again.');
    res.redirect('/login');
  }
}

function handleLogout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = {
  showLogin,
  handleLogin,
  showForgotPassword,
  handleForgotPassword,
  showResetPassword,
  handleResetPassword,
  handleLogout
};

