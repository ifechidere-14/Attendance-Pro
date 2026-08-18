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
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');

let signupMode = false;

function toggleMode() {
  signupMode = !signupMode;
  signupForm.hidden = !signupMode;
  form.hidden = signupMode;
  btn.textContent = signupMode ? 'Create Account' : 'Sign In';
  authHeading.textContent = signupMode ? 'Create Account' : 'Sign In';
  authSubtext.textContent = signupMode ? 'Enter your details to register.' : 'Enter your credentials below.';
  authSwitch.innerHTML = signupMode
    ? '<span>Already have an account? <a href="javascript:void(0)" id="show-login">Log In</a></span>'
    : '<span>Don\'t have an account? <a href="javascript:void(0)" id="show-signup">Sign Up</a></span>';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  btn.disabled = true;
  btn.textContent = signupMode ? 'Creating…' : 'Signing in…';
  try {
    if (signupMode) {
      // Collect all signup fields
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
    } else {
      const res = await API.post('/api/auth/login', {
        username: document.getElementById('auth-username').value.trim(),
        password: document.getElementById('auth-password').value
      });
      sessionStorage.setItem('ap_user', JSON.stringify(res.user));
      window.location.href = '/app.html#/dashboard';
    }
  } catch (err) {
    errorBox.textContent = err.message || (signupMode ? 'Signup failed.' : 'Login failed.');
    errorBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = signupMode ? 'Create Account' : 'Sign In';
  }
});

// Handle toggle links
showSignup.addEventListener('click', (e) => {
  e.preventDefault();
  toggleMode();
});
showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  toggleMode();
});

// Already authenticated? Jump straight to the app.
API.request('/api/auth/me')
  .then(() => { window.location.href = '/app.html#/dashboard'; })
  .catch(() => { /* not authenticated — stay on login */ });