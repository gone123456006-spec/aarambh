const API = window.location.origin.replace(/\/$/, '');
const AUTO_REFRESH_MS = 60 * 1000;

let token = sessionStorage.getItem('adminToken') || '';
let usersPage = 1;
let usersPagination = { pages: 1 };
let autoRefreshTimer = null;
let cachedCourses = [];
/** courseId -> lessonId when editing */
const editingLesson = {};

const $ = (id) => document.getElementById(id);

function showStatus(el, msg, type = 'info') {
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function forceLogout(message) {
  stopAutoRefresh();
  sessionStorage.removeItem('adminToken');
  token = '';
  $('dashboard').classList.add('hidden');
  $('loginCard').classList.remove('hidden');
  if (message) {
    showStatus($('loginStatus'), message, 'err');
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    forceLogout('Session expired. Please sign in again.');
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const msg = json.message || json.data?.message || res.statusText;
    throw new Error(msg || 'Request failed');
  }
  return json.data !== undefined ? json.data : json;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.add('hidden');
  });
  $('panel-' + name).classList.remove('hidden');

  if (name === 'users') loadUsers();
  if (name === 'overview') loadStats();
  if (name === 'content') {
    loadCourses().then(() => renderCategorySections());
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = setInterval(() => {
    if (token) refreshAll(true);
  }, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function setLoggedIn(user) {
  token = sessionStorage.getItem('adminToken');
  $('loginCard').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('userBadge').textContent = user?.username || user?.name || 'Admin';
  startAutoRefresh();
  const hint = $('autoRefreshHint');
  if (hint) hint.textContent = 'Uploads go live in My Courses instantly';
  switchTab('content');
}

async function loadStats() {
  const grid = $('statsGrid');
  try {
    const s = await api('/api/admin/dashboard');
    const cards = [
      { label: 'Total users', value: s.totalUsers },
      { label: 'Online now', value: s.onlineUsers },
      { label: 'Logged in', value: s.loggedInUsers },
      { label: 'Active (24h)', value: s.activeLast24h },
      { label: 'Profile complete', value: s.profileCompleted },
      { label: 'New this week', value: s.newUsersThisWeek },
      { label: 'Courses', value: s.totalCourses },
      { label: 'Active chats', value: s.activeChatSessions },
    ];

    grid.innerHTML = cards
      .map(
        (c) => `
      <div class="stat-card">
        <div class="value">${c.value ?? 0}</div>
        <div class="label">${c.label}</div>
      </div>`
      )
      .join('');

    $('statsUpdated').textContent = `Last updated ${new Date().toLocaleTimeString()} · next refresh in 1 min`;
  } catch (e) {
    grid.innerHTML = `<p class="status err">${e.message}</p>`;
  }
}

function statusBadges(u) {
  const parts = [];
  if (u.isOnline) parts.push('<span class="badge online">Online</span>');
  else parts.push('<span class="badge offline">Offline</span>');
  if (u.hasActiveSession) parts.push('<span class="badge session">Logged in</span>');
  if (u.profileCompleted) parts.push('<span class="badge complete">Profile ✓</span>');
  return parts.join(' ') || '—';
}

async function loadUsers(page = usersPage) {
  usersPage = page;
  const search = $('userSearch').value.trim();
  const filter = $('userFilter').value;
  const tbody = $('usersTableBody');

  tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

  try {
    const q = new URLSearchParams({
      page: String(page),
      limit: '20',
      filter,
    });
    if (search) q.set('search', search);

    const data = await api(`/api/admin/users?${q}`);
    usersPagination = data.pagination || { pages: 1, page: 1, total: 0 };

    if (!data.users?.length) {
      tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
    } else {
      tbody.innerHTML = data.users
        .map(
          (u) => `
        <tr>
          <td>${u.name || '—'}</td>
          <td>${u.email}</td>
          <td>${u.level || '—'}</td>
          <td>${statusBadges(u)}</td>
          <td>${formatDate(u.lastSeen)}</td>
          <td><button type="button" class="link-btn" data-user-id="${u._id}">Details</button></td>
        </tr>`
        )
        .join('');

      tbody.querySelectorAll('[data-user-id]').forEach((btn) => {
        btn.addEventListener('click', () => openUserModal(btn.dataset.userId));
      });
    }

    $('usersPageInfo').textContent = `Page ${usersPagination.page} of ${usersPagination.pages} · ${usersPagination.total} users`;
    $('prevPageBtn').disabled = usersPagination.page <= 1;
    $('nextPageBtn').disabled = usersPagination.page >= usersPagination.pages;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6">${e.message}</td></tr>`;
  }
}

async function openUserModal(userId) {
  const modal = $('userModal');
  const body = $('userModalBody');
  modal.classList.remove('hidden');
  body.textContent = 'Loading…';

  try {
    const data = await api(`/api/admin/users/${userId}`);
    const u = data.user;
    const cp = data.courseProgress || {};
    const games = data.gameProgress || [];

    body.innerHTML = `
      <dl>
        <dt>Name</dt><dd>${u.name || '—'}</dd>
        <dt>Email</dt><dd>${u.email}</dd>
        <dt>Phone</dt><dd>${u.phone || '—'}</dd>
        <dt>Gender</dt><dd>${u.gender || '—'}</dd>
        <dt>Region</dt><dd>${u.region || '—'}</dd>
        <dt>Level</dt><dd>${u.level || '—'}</dd>
        <dt>Profile</dt><dd>${u.profileCompleted ? 'Complete' : 'Incomplete'}</dd>
        <dt>Online</dt><dd>${u.isOnline ? 'Yes' : 'No'}</dd>
        <dt>Session</dt><dd>${u.hasActiveSession ? `Active (${u.sessionCount})` : 'None'}</dd>
        <dt>Last seen</dt><dd>${formatDate(u.lastSeen)}</dd>
        <dt>Joined</dt><dd>${formatDate(u.createdAt)}</dd>
        <dt>Referral</dt><dd>${u.referralCode || '—'}</dd>
        <dt>Lessons done</dt><dd>${(cp.completedLessons || []).length}</dd>
        <dt>Last lesson</dt><dd>${cp.lastLessonId || '—'}</dd>
        <dt>Games</dt><dd>${games.length ? games.map((g) => `${g.gameId} L${g.level}`).join(', ') : '—'}</dd>
      </dl>`;
  } catch (e) {
    body.innerHTML = `<p class="status err">${e.message}</p>`;
  }
}

function closeUserModal() {
  $('userModal').classList.add('hidden');
}

async function adminLogin(event) {
  event.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value;

  $('loginBtn').disabled = true;
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    token = data.accessToken;
    sessionStorage.setItem('adminToken', token);
    setLoggedIn(data.user);
    showStatus($('loginStatus'), 'Signed in successfully', 'ok');
  } catch (e) {
    showStatus($('loginStatus'), e.message, 'err');
  } finally {
    $('loginBtn').disabled = false;
  }
}

function logout() {
  forceLogout();
  location.reload();
}

function refreshAll(silent = false) {
  loadStats();
  if (!$('panel-users').classList.contains('hidden')) loadUsers();
  if (!$('panel-content').classList.contains('hidden')) {
    loadCourses().then(() => renderCategorySections());
  }
  if (!silent) {
    const hint = $('autoRefreshHint');
    if (hint) hint.textContent = `Refreshed ${new Date().toLocaleTimeString()} · auto every 1 min`;
  }
}

async function createCourse() {
  const title = $('newCourseTitle').value.trim();
  const level = $('newCourseLevel').value.trim();
  const subtitle = $('newCourseSubtitle').value.trim();
  if (!title) {
    showStatus($('createCourseStatus'), 'Enter a category title', 'err');
    return;
  }
  $('createCourseBtn').disabled = true;
  try {
    await api('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title,
        subtitle: subtitle || `${title} lessons`,
        level: level || undefined,
        lessons: [],
      }),
    });
    showStatus($('createCourseStatus'), `Category "${title}" created — add lessons below`, 'ok');
    $('newCourseTitle').value = '';
    $('newCourseLevel').value = '';
    $('newCourseSubtitle').value = '';
    await loadCourses();
    renderCategorySections();
  } catch (e) {
    showStatus($('createCourseStatus'), e.message, 'err');
  } finally {
    $('createCourseBtn').disabled = false;
  }
}

async function loadCourses() {
  try {
    const courses = await api('/api/admin/courses');
    cachedCourses = courses || [];
    return cachedCourses;
  } catch {
    cachedCourses = [];
    return [];
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lessonRowHtml(courseId, lesson) {
  const hasVideo = !!lesson.videoUrl;
  const hasPdf = !!lesson.pdfUrl;
  return `
    <div class="lesson-row" data-lesson-row="${lesson._id}">
      <div class="lesson-title">
        <strong>${esc(lesson.title)}</strong>
        <span style="color:#636e72;font-size:0.82rem">${esc(lesson.duration || '')}</span>
        ${lesson.description ? `<p class="lesson-about-preview">${esc(lesson.description.slice(0, 120))}${lesson.description.length > 120 ? '…' : ''}</p>` : ''}
      </div>
      <div class="lesson-status">
        ${hasVideo ? '<span class="badge ok">Video ✓</span>' : '<span class="badge">No video</span>'}
        ${hasPdf ? '<span class="badge ok">PDF ✓</span>' : '<span class="badge">No PDF</span>'}
      </div>
      <div class="lesson-actions">
        <button type="button" class="ghost" data-edit-lesson="${lesson._id}" data-course-id="${courseId}">Edit</button>
        <button type="button" class="danger" data-del-lesson="${lesson._id}" data-course-id="${courseId}">Delete</button>
      </div>
    </div>`;
}

function categorySectionHtml(course) {
  const cid = course._id;
  const lessons = course.lessons || [];
  const color = course.color?.[0] || '#e60000';
  const editing = editingLesson[cid];

  return `
    <section class="card category-section" data-course-id="${cid}" style="border-top: 4px solid ${esc(color)}">
      <div class="category-header">
        <div>
          <h2>${esc(course.title)}</h2>
          <p class="hint" style="margin:0">${esc(course.subtitle || course.level)} · ${lessons.length} lesson(s) · slug: ${esc(course.level)}</p>
        </div>
        <button type="button" class="danger" data-delete-course="${cid}" data-course-title="${esc(course.title)}">Delete category</button>
      </div>

      <div class="lessons-block">
        <h3 class="subheading">Lessons in app</h3>
        ${
          lessons.length
            ? lessons.map((l) => lessonRowHtml(cid, l)).join('')
            : '<p class="hint">No lessons yet — add your first video below.</p>'
        }
      </div>

      <div class="add-lesson-box">
        <h3 class="subheading">${editing ? 'Edit lesson' : 'Add new lesson'}</h3>
        <label>Lesson title (heading)</label>
        <input type="text" class="fld-title" placeholder="Introduction to English" value="${editing ? esc(editing.title) : ''}" />
        <div class="upload-row">
          <div class="upload-field">
            <label>Duration</label>
            <input type="text" class="fld-duration" placeholder="12:30" value="${editing ? esc(editing.duration) : ''}" />
          </div>
          <div class="upload-field">
            <label>PDF title</label>
            <input type="text" class="fld-pdf-title" placeholder="Lesson notes PDF" value="${editing ? esc(editing.pdfTitle) : ''}" />
          </div>
        </div>
        <label>About this lesson</label>
        <textarea class="fld-about" rows="3" placeholder="What students will learn in this lesson…">${editing ? esc(editing.description) : ''}</textarea>

        <div class="drop-row">
          <div class="drop-zone dz-video" tabindex="0" data-course="${cid}">
            <input type="file" class="inp-video" accept="video/*" hidden />
            <p class="drop-icon">🎬</p>
            <p class="drop-title">Video</p>
            <p class="drop-sub">Tap or drag · max 100 MB</p>
            <p class="drop-file hidden"></p>
          </div>
          <div class="drop-zone dz-pdf" tabindex="0" data-course="${cid}">
            <input type="file" class="inp-pdf" accept="application/pdf" hidden />
            <p class="drop-icon">📄</p>
            <p class="drop-title">PDF notes</p>
            <p class="drop-sub">Optional · max 20 MB</p>
            <p class="drop-file hidden"></p>
          </div>
        </div>

        <div class="progress-wrap hidden prog-wrap">
          <div class="progress-bar"><div class="progress-fill prog-fill"></div></div>
          <p class="progress-text prog-text">Uploading…</p>
        </div>
        <div class="live-banner hidden live-msg"></div>
        <div class="row" style="gap:0.5rem;margin-top:0.5rem">
          <button type="button" class="publish-btn" data-save-lesson="${cid}" style="flex:1">
            ${editing ? 'Update lesson in app' : 'Add lesson to app'}
          </button>
          ${editing ? `<button type="button" class="secondary" data-cancel-edit="${cid}">Cancel edit</button>` : ''}
        </div>
        <div class="status hidden lesson-form-status"></div>
      </div>
    </section>`;
}

async function renderCategorySections() {
  const root = $('categorySections');
  if (!root) return;

  const courses = cachedCourses.length ? cachedCourses : await loadCourses();

  if (!courses.length) {
    root.innerHTML =
      '<section class="card"><p class="hint" style="margin:0">No categories yet. Create <strong>Beginner</strong>, <strong>Intermediate</strong>, and <strong>Advanced</strong> above, then add videos for each.</p></section>';
    return;
  }

  root.innerHTML = courses.map((c) => categorySectionHtml(c)).join('');
  bindCategorySectionEvents();
}

function bindDropZone(zone) {
  if (!zone || zone.dataset.bound) return;
  zone.dataset.bound = '1';
  const input = zone.querySelector('input[type=file]');
  const nameEl = zone.querySelector('.drop-file');
  if (!input) return;

  const showFile = (file) => {
    if (!file || !nameEl) return;
    nameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;
    nameEl.classList.remove('hidden');
  };

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files?.[0]) showFile(input.files[0]);
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    showFile(file);
  });
}

function bindCategorySectionEvents() {
  document.querySelectorAll('.drop-zone').forEach(bindDropZone);

  document.querySelectorAll('[data-delete-course]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteCourse;
      const title = btn.dataset.courseTitle || 'this category';
      if (!confirm(`Delete "${title}" and ALL its videos/PDFs from the app?`)) return;
      btn.disabled = true;
      try {
        await api(`/api/admin/courses/${id}`, { method: 'DELETE' });
        delete editingLesson[id];
        await loadCourses();
        renderCategorySections();
      } catch (e) {
        alert(e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-del-lesson]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lessonId = btn.dataset.delLesson;
      const courseId = btn.dataset.courseId;
      if (!confirm('Delete this lesson from the app?')) return;
      try {
        await api(`/api/admin/courses/${courseId}/lessons/${lessonId}`, { method: 'DELETE' });
        if (editingLesson[courseId]?._id === lessonId) delete editingLesson[courseId];
        await loadCourses();
        renderCategorySections();
      } catch (e) {
        alert(e.message);
      }
    });
  });

  document.querySelectorAll('[data-edit-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const courseId = btn.dataset.courseId;
      const lessonId = btn.dataset.editLesson;
      const course = cachedCourses.find((c) => String(c._id) === String(courseId));
      const lesson = course?.lessons?.find((l) => String(l._id) === String(lessonId));
      if (!lesson) return;
      editingLesson[courseId] = { ...lesson, _id: lesson._id };
      renderCategorySections();
      document.querySelector(`[data-course-id="${courseId}"]`)?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      delete editingLesson[btn.dataset.cancelEdit];
      renderCategorySections();
    });
  });

  document.querySelectorAll('[data-save-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => saveLessonToApp(btn.dataset.saveLesson));
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setSectionProgress(section, pct, text) {
  const wrap = section.querySelector('.prog-wrap');
  const fill = section.querySelector('.prog-fill');
  const label = section.querySelector('.prog-text');
  if (!wrap || !fill) return;
  wrap.classList.remove('hidden');
  fill.style.width = `${Math.round(pct * 100)}%`;
  if (label) label.textContent = text || `Uploading… ${Math.round(pct * 100)}%`;
}

function uploadWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json.data !== undefined ? json.data : json);
        } else {
          reject(new Error(json.message || json.data?.message || 'Upload failed'));
        }
      } catch {
        reject(new Error('Invalid server response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

async function saveLessonToApp(courseId) {
  const section = document.querySelector(`[data-course-id="${courseId}"]`);
  if (!section) return;

  const title = section.querySelector('.fld-title')?.value?.trim();
  const duration = section.querySelector('.fld-duration')?.value?.trim() || '0:00';
  const description = section.querySelector('.fld-about')?.value?.trim() || '';
  const pdfTitle = section.querySelector('.fld-pdf-title')?.value?.trim() || `${title} notes`;
  const videoInput = section.querySelector('.inp-video');
  const pdfInput = section.querySelector('.inp-pdf');
  const statusEl = section.querySelector('.lesson-form-status');
  const liveEl = section.querySelector('.live-msg');
  const btn = section.querySelector('[data-save-lesson]');
  const editing = editingLesson[courseId];

  if (!title) {
    showStatus(statusEl, 'Lesson title is required', 'err');
    return;
  }

  const isNew = !editing?._id;
  if (isNew && !videoInput?.files?.[0] && !pdfInput?.files?.[0]) {
    showStatus(statusEl, 'Add a video or PDF file', 'err');
    return;
  }

  btn.disabled = true;
  try {
    let videoUrl = editing?.videoUrl;
    let videoAvailableAt = editing?.videoAvailableAt;
    let pdfUrl = editing?.pdfUrl;
    let pdfAvailableAt = editing?.pdfAvailableAt;

    if (videoInput?.files?.[0]) {
      const fd = new FormData();
      fd.append('video', videoInput.files[0]);
      setSectionProgress(section, 0.1, 'Uploading video…');
      const data = await uploadWithProgress('/api/admin/upload/video', fd, (p) =>
        setSectionProgress(section, 0.1 + p * 0.5, `Uploading video… ${Math.round(p * 100)}%`)
      );
      videoUrl = data.url || data.videoUrl;
      videoAvailableAt = data.videoAvailableAt || data.availableAt;
    }

    if (pdfInput?.files?.[0]) {
      const fd = new FormData();
      fd.append('pdf', pdfInput.files[0]);
      setSectionProgress(section, 0.65, 'Uploading PDF…');
      const data = await uploadWithProgress('/api/admin/upload/pdf', fd, (p) =>
        setSectionProgress(section, 0.65 + p * 0.25, `Uploading PDF… ${Math.round(p * 100)}%`)
      );
      pdfUrl = data.url || data.pdfUrl;
      pdfAvailableAt = data.pdfAvailableAt || data.availableAt;
    }

    setSectionProgress(section, 0.95, 'Saving to app…');

    const body = {
      title,
      duration,
      description,
      pdfTitle,
      type: 'video',
      videoUrl,
      pdfUrl,
      videoAvailableAt,
      pdfAvailableAt,
    };

    if (editing?._id) {
      body.lessonId = editing._id;
    }

    await api(`/api/admin/courses/${courseId}/lessons/upsert`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setSectionProgress(section, 1, 'Done!');
    if (liveEl) {
      liveEl.classList.remove('hidden');
      liveEl.textContent = `✓ "${title}" is live in My Courses! Pull down to refresh in the app.`;
    }
    showStatus(statusEl, `Saved "${title}" — visible in app now`, 'ok');

    delete editingLesson[courseId];
    await loadCourses();
    renderCategorySections();
  } catch (e) {
    showStatus(statusEl, e.message, 'err');
  } finally {
    btn.disabled = false;
    setTimeout(() => section.querySelector('.prog-wrap')?.classList.add('hidden'), 1200);
  }
}

async function tryRestoreSession() {
  if (!token) return;
  try {
    const user = await api('/api/users/me');
    setLoggedIn(user);
  } catch {
    sessionStorage.removeItem('adminToken');
    token = '';
  }
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

$('loginForm').addEventListener('submit', adminLogin);
$('logoutBtn').addEventListener('click', logout);
$('refreshBtn').addEventListener('click', () => refreshAll(false));
$('searchUsersBtn').addEventListener('click', () => loadUsers(1));
$('prevPageBtn').addEventListener('click', () => loadUsers(usersPage - 1));
$('nextPageBtn').addEventListener('click', () => loadUsers(usersPage + 1));
$('closeModalBtn').addEventListener('click', closeUserModal);
$('userModal').addEventListener('click', (e) => {
  if (e.target === $('userModal')) closeUserModal();
});
$('createCourseBtn').addEventListener('click', createCourse);

$('userSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadUsers(1);
});

tryRestoreSession();
