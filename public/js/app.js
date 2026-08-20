/* ============================================================
   Attendance Pro — application shell & view router
   ============================================================ */

const VIEWS = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  students:  { title: 'Students',  render: renderStudents },
  courses:   { title: 'Courses',   render: renderCourses },
  attendance:{ title: 'Attendance',render: renderAttendance },
  reports:   { title: 'Reports',   render: renderReports }
};

let currentUser = null;
let currentView = null;
let viewParams = null;

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const todayEl = document.getElementById('today-label');

/* ---------- boot ---------- */
async function init() {
  try {
    currentUser = await API.get('/api/auth/me').then(r => r.user);
  } catch (_) {
    window.location.href = '/login.html';
    return;
  }

  // Fill user chip
  document.getElementById('user-name').textContent = currentUser.full_name;
  document.getElementById('user-role').textContent =
    currentUser.role === 'admin' ? 'Administrator' : 'Instructor';
  document.getElementById('user-avatar').textContent = initials(currentUser.full_name);

  todayEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => { navigate(btn.dataset.view); });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await API.post('/api/auth/logout'); } catch (_) { /* ignore */ }
    sessionStorage.removeItem('ap_user');
    window.location.href = '/login.html';
  });

  // Sidebar toggle (mobile)
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebar-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
  document.querySelectorAll('.sidebar, .main').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.sidebar') && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    });
  });

  // Refresh current view
  document.getElementById('refresh-btn').addEventListener('click', () => reroute());

  // Download the Attendance Pro application (ZIP source bundle)
  const downloadBtn = document.getElementById('download-app-btn');
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⬇ Building…';
    try {
      // fetch with credentials: include so the session cookie is sent;
      // the server streams back an application/zip attachment.
      const res = await fetch('/api/download/app', { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err && err.error) || 'Download failed.');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filenameFrom(res) || 'AttendancePro-app.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Download started — Attendance Pro app package.');
    } catch (err) {
      toast(err.message || 'Download failed.', 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = '⬇ Download App';
    }
  });

  window.addEventListener('hashchange', reroute);
  const start = (window.location.hash || '#/dashboard').slice(2);
  navigate(start || 'dashboard');
}

function navigate(viewName, params) {
  if (!VIEWS[viewName]) viewName = 'dashboard';
  viewParams = params || null;
  window.location.hash = '/' + viewName;
  render(viewName);
}

function reroute() {
  const viewName = (window.location.hash || '#/dashboard').slice(2) || 'dashboard';
  if (VIEWS[viewName]) render(viewName);
}

function render(name) {
  currentView = name;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  titleEl.textContent = VIEWS[name].title;
  viewEl.scrollIntoView({ block: 'start' });
  VIEWS[name].render(viewEl, viewParams);
}

document.addEventListener('DOMContentLoaded', init);