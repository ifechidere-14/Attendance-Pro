/* ============================================================
   Attendance Pro — shared API client & UI helpers
   ============================================================ */

const API = {
  async request(path, options = {}) {
    const opts = { headers: { 'Content-Type': 'application/json' }, ...options };
    if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
    const res = await fetch(path, { ...opts, credentials: 'include' });
    let data = {};
    try { data = await res.json(); } catch (_) { /* non-JSON response */ }
    if (res.status === 401) {
      sessionStorage.removeItem('ap_user');
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = '/login.html';
      }
      throw new Error(data.error || 'Not authenticated');
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body }); },
  put(path, body) { return this.request(path, { method: 'PUT', body }); },
  del(path) { return this.request(path, { method: 'DELETE' }); }
};

/* ---------- small utilities ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
}

function badge(status) {
  const labels = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function toast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('out'); }, 3200);
  setTimeout(() => el.remove(), 3600);
}

function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay">${html}</div>`;
  const overlay = root.querySelector('.modal-overlay');
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', escModal);
  return root;
}
function closeModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  document.removeEventListener('keydown', escModal);
}
function escModal(e) { if (e.key === 'Escape') closeModal(); }

/* Escape hatch for chart.js (loaded from CDN). */
function chartAvailable() { return typeof window.Chart !== 'undefined'; }

function moneyLikePct(present, total) {
  return total === 0 ? 0 : Math.round((present / total) * 100);
}

/* Extract a download filename from headers' Content-Disposition. */
function filenameFrom(res) {
  const cd = res.headers && res.headers.get('content-disposition');
  if (!cd) return null;
  const m = /filename="?([^";]+)"?/.exec(cd);
  return m ? m[1] : null;
}