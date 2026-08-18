/* ============================================================
   Attendance Pro — login page logic
   ============================================================ */

const form = document.getElementById('auth-form');
const errorBox = document.getElementById('auth-error');
const btn = document.getElementById('auth-btn');
const authHeading = document.getElementById('auth-heading');
const authSubtext = document.getElementById('auth-subtext');
const authSwitch = document.getElementById('auth-switch');
const signupForm = document.getElementById('signup-form');
const signupBtn = document.getElementById('signup-btn');
const backToLogin = document.getElementById('back-to-login');

let signupMode = false;

/**
 * Toggle between the sign-in form and the sign-up form.
 * Since the two forms are now siblings (not nested), we simply
 * toggle their CSS ``hidden`` attribute.
 */
function toggleMode() {
  signupMode = !signupMode;

  // Show / hide the two sibling containers
  if (form && signupForm) {
    form.style.display = signupMode ? 'none' : 'block';
    signupForm.style.display = signupMode ? 'block' : 'none';
  }

  // Update the switch links
  authSwitch.innerHTML = signupMode
    ? '<span>Already have an account? <a href="javascript:void(0)" id="show-login">Log In</a></span>'
    : '<span>Don\'t have an account? <a href="javascript:void(0)" id="show-signup">Sign Up</a></span>';

  // Re-bind the freshly-created toggle links
  const newShowLogin = document.getElementById('show-login');
  const newShowSignup = document.getElementById('show-signup');
  if (newShowLogin) {
    newShowLogin.addEventListener('click', (e) => { e.preventDefault(); toggleMode(); });
  }
  if (newShowSignup) {
    newShowSignup.addEventListener('click', (e) => { e.preventDefault(); toggleMode(); });
  }
}

/* ---- Sign-in form ---- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const res = await API.post('/api/auth/login', {
      username: document.getElementById('auth-username').value.trim(),
      password: document.getElementById('auth-password').value
    });
    sessionStorage.setItem('ap_user', JSON.stringify(res.user));
    window.location.href = '/app.html#/dashboard';
  } catch (err) {
    errorBox.textContent = err.message || 'Login failed.';
    errorBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

/* ---- Sign-up form ---- */
signupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating…';
  try {
    const fullName = document.querySelector('input[name="full_name"]')?.value.trim();
    const username = document.querySelector('input[name="signup-username"]')?.value.trim();
    const email = document.querySelector('input[name="signup-email"]')?.value.trim();
    const password = document.querySelector('input[name="signup-password"]')?.value;

    if (!fullName || !username || !email || !password) {
      errorBox.textContent = 'All fields are required.';
      errorBox.hidden = false;
      return;
    }

    const res = await API.post('/api/auth/signup', {
      full_name: fullName,
      username,
      email,
      password
    });
    sessionStorage.setItem('ap_user', JSON.stringify(res.user));
    toast(res.message || 'Account created successfully.');
    toggleMode(); // switch back to login
  } catch (err) {
    errorBox.textContent = err.message || 'Signup failed.';
    errorBox.hidden = false;
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Create Account';
  }
});

/* ---- Back-to-login link ---- */
backToLogin?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleMode();
});

/* ---- Already authenticated? Jump straight to the app. ---- */
API.request('/api/auth/me')
  .then(() => { window.location.href = '/app.html#/dashboard'; })
  .catch(() => { /* not authenticated — stay on login */ });