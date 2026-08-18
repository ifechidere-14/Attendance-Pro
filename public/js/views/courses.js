/* ============================================================
   Courses view
   ============================================================ */

let courseCache = [];

async function renderCourses(el) {
  const me = await API.get('/api/auth/me').catch(() => null);
  const isAdmin = me?.user?.role === 'admin';

  el.innerHTML = `
    <div class="toolbar">
      <div class="search-wrap">
        <input class="search-input" id="course-search" placeholder="Search courses…">
      </div>
      <div style="flex:1"></div>
      ${isAdmin ? '<button class="btn btn-primary" id="course-add">＋ Add Course</button>' : ''}
    </div>
    <div id="course-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px">
      <div class="card"><p class="muted">Loading courses…</p></div>
    </div>
  `;

  el.querySelector('#course-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderCourseGrid(el, q);
  });
  el.querySelector('#course-add')?.addEventListener('click', () => openCourseModal(el, null));
  loadCourses(el);
}

async function loadCourses(el) {
  try {
    const { courses } = await API.get('/api/courses');
    courseCache = courses;
    renderCourseGrid(el, '');
  } catch (err) {
    el.querySelector('#course-grid').innerHTML = `<div class="card"><div class="alert alert-error">${esc(err.message)}</div></div>`;
  }
}

function renderCourseGrid(el, q) {
  const grid = el.querySelector('#course-grid');
  const rows = courseCache.filter((c) =>
    !q ||
    c.course_code.toLowerCase().includes(q) ||
    c.course_name.toLowerCase().includes(q) ||
    (c.instructor_name || '').toLowerCase().includes(q)
  );
  if (!rows.length) {
    grid.innerHTML = `<div class="card empty-state"><div class="big">📚</div>No courses found.</div>`;
    return;
  }
  grid.innerHTML = rows.map((c) => `
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <span class="badge badge-admin">${esc(c.course_code)}</span>
          <h3 style="margin-top:8px">${esc(c.course_name)}</h3>
        </div>
        <span class="badge badge-${c.student_count > 0 ? 'present' : 'neutral'}">${c.student_count} enrolled</span>
      </div>
      <div class="muted small" style="display:grid;gap:4px">
        <div>👤 ${esc(c.instructor_name) || 'No instructor assigned'}</div>
        ${c.schedule ? `<div>🗓️ ${esc(c.schedule)}</div>` : ''}
        ${c.location ? `<div>📍 ${esc(c.location)}</div>` : ''}
      </div>
      <div class="row-actions" style="margin-top:auto">
        <button class="btn btn-secondary btn-sm" data-act="roster" data-id="${c.id}">👥 Roster</button>
        <button class="btn btn-secondary btn-sm" data-act="att" data-id="${c.id}">✅ Mark</button>
        <div style="flex:1"></div>
        <button class="icon-btn" data-act="edit" data-id="${c.id}" title="Edit">✏️</button>
        <button class="icon-btn" data-act="del" data-id="${c.id}" title="Delete" style="color:var(--absent)">🗑️</button>
      </div>
    </div>`).join('');

  grid.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      if (act === 'roster') openRosterModal(id);
      else if (act === 'att') navigate('attendance', { courseId: id });
      else if (act === 'edit') editCourse(id, el);
      else if (act === 'del') delCourse(id, el);
    });
  });
}

/* ---------- add / edit course modal ---------- */
async function openCourseModal(el, course) {
  // Build a list of known instructors from previously-loaded course data.
  let instructorOptions = '<option value="">— No instructor —</option>';
  const teachers = [];
  courseCache.forEach((c) => {
    if (c.instructor_id && !teachers.find((t) => t.id === c.instructor_id)) {
      teachers.push({ id: c.instructor_id, full_name: c.instructor_name });
    }
  });
  if (teachers.length === 0 && course && course.instructor_name) {
    teachers.push({ id: course.instructor_id, full_name: course.instructor_name });
  }
  instructorOptions += teachers.map((t) =>
    `<option value="${t.id}" ${course?.instructor_id === t.id ? 'selected' : ''}>${esc(t.full_name)}</option>`
  ).join('');

  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${course ? 'Edit Course' : 'Add Course'}</h3>
        <button class="icon-btn" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <form id="course-form" class="form-grid">
          <div class="field"><label>Course Code *</label>
            <input name="course_code" required value="${esc(course?.course_code || '')}" placeholder="e.g. CS-101"></div>
          <div class="field"><label>Course Name *</label>
            <input name="course_name" required value="${esc(course?.course_name || '')}" placeholder="Introduction to Computer Science"></div>
          <div class="field"><label>Instructor</label>
            <select name="instructor_id">${instructorOptions}</select></div>
          <div class="field"><label>Schedule</label>
            <input name="schedule" value="${esc(course?.schedule || '')}" placeholder="e.g. Mon & Wed 10:00"></div>
          <div class="field full"><label>Location</label>
            <input name="location" value="${esc(course?.location || '')}" placeholder="e.g. Room 204"></div>
          <div class="field full" id="course-form-error"></div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="course-save">${course ? 'Save Changes' : 'Create Course'}</button>
      </div>
    </div>`);

  document.getElementById('course-save').addEventListener('click', async () => {
    const form = document.getElementById('course-form');
    const payload = {
      course_code: form.course_code.value.trim(),
      course_name: form.course_name.value.trim(),
      instructor_id: form.instructor_id.value || null,
      schedule: form.schedule.value.trim() || null,
      location: form.location.value.trim() || null
    };
    const errBox = document.getElementById('course-form-error');
    try {
      if (course) await API.put('/api/courses/' + course.id, payload);
      else await API.post('/api/courses', payload);
      closeModal();
      toast(course ? 'Course updated.' : 'Course created.');
      loadCourses(el);
    } catch (err) {
      errBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  });
}

async function editCourse(id, el) {
  try {
    const { course } = await API.get('/api/courses/' + id);
    openCourseModal(el, course);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function delCourse(id, el) {
  openModal(`
    <div class="modal" style="max-width:420px">
      <div class="modal-head"><h3>Delete course?</h3>
        <button class="icon-btn" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <p>This removes the course and all of its attendance records. This cannot be undone.</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="course-del-confirm">Delete</button>
      </div>
    </div>`);
  document.getElementById('course-del-confirm').addEventListener('click', async () => {
    try {
      await API.del('/api/courses/' + id);
      closeModal();
      toast('Course deleted.', 'info');
      loadCourses(el);
    } catch (err) {
      toast(err.message, 'error');
      closeModal();
    }
  });
}

/* ---------- roster / enrollment modal ---------- */
async function openRosterModal(courseId) {
  const course = courseCache.find((c) => c.id === courseId);
  try {
    const [allRes, enrolledRes] = await Promise.all([
      API.get('/api/students?page=1&limit=500'),
      API.get('/api/courses/' + courseId + '/students')
    ]);
    const all = allRes.students || [];
    const enrolledIds = new Set((enrolledRes.students || []).map((s) => s.id));

    openModal(`
      <div class="modal" style="max-width:620px">
        <div class="modal-head"><h3>Roster — ${esc(course?.course_name || courseId)}</h3>
          <button class="icon-btn" onclick="closeModal()">✕</button></div>
        <div class="modal-body">
          <div class="search-wrap" style="margin-bottom:14px">
            <input class="search-input" id="roster-search" placeholder="Filter students…" style="width:100%">
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px">
            <span class="muted small"><span id="roster-count">0</span> students enrolled</span>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm btn-secondary" id="roster-all">Select all</button>
              <button class="btn btn-sm btn-secondary" id="roster-none">Clear</button>
            </div>
          </div>
          <div id="roster-list" class="table-wrap" style="max-height:380px;overflow-y:auto">
            ${all.map((s) => `
              <label class="roster-row" style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer">
                <input type="checkbox" class="roster-check" data-id="${s.id}" ${enrolledIds.has(s.id) ? 'checked' : ''}>
                <strong style="min-width:110px" class="small">${esc(s.student_code)}</strong>
                <span>${esc(s.full_name)}</span>
              </label>`).join('')}
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" id="roster-save">Save Roster</button>
        </div>
      </div>`);

    const list = document.getElementById('roster-list');
    const countEl = document.getElementById('roster-count');
    const updateCount = () => countEl.textContent = list.querySelectorAll('.roster-check:checked').length;
    updateCount();

    document.getElementById('roster-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      list.querySelectorAll('.roster-row').forEach((row) => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    list.querySelectorAll('.roster-check').forEach((c) => c.addEventListener('change', updateCount));
    document.getElementById('roster-all').addEventListener('click', () => {
      list.querySelectorAll('.roster-check').forEach((c) => { c.checked = true; });
      updateCount();
    });
    document.getElementById('roster-none').addEventListener('click', () => {
      list.querySelectorAll('.roster-check').forEach((c) => { c.checked = false; });
      updateCount();
    });

    document.getElementById('roster-save').addEventListener('click', async () => {
      const newIds = [...list.querySelectorAll('.roster-check:checked')].map((c) => c.dataset.id);
      const toAdd = newIds.filter((id) => !enrolledIds.has(id));
      const toRemove = [...enrolledIds].filter((id) => !newIds.includes(id));
      const saveBtn = document.getElementById('roster-save');
      saveBtn.disabled = true;
      try {
        if (toAdd.length) await API.post(`/api/courses/${courseId}/enroll`, { studentIds: toAdd });
        if (toRemove.length) await API.post(`/api/courses/${courseId}/unenroll`, { studentIds: toRemove });
        toast(`Roster saved — ${toAdd.length} added, ${toRemove.length} removed.`);
        closeModal();
        loadCourses(document.getElementById('view'));
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}