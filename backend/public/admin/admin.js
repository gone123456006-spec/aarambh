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
  if (name === 'subscriptions') {
    loadSubscriptions();
  }
  if (name === 'games') {
    $('gameSelect').value = '';
    $('questionFormSection').classList.add('hidden');
    $('levelManagementSection').classList.add('hidden');
    $('questionsListSection').classList.add('hidden');
  }
  if (name === 'notifications') {
    loadNotifications();
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
      { label: 'Active Subscriptions', value: s.activeSubscriptions, color: '#00b894' },
      { label: 'Expired Subscriptions', value: s.expiredSubscriptions, color: '#636e72' },
      { label: 'Total Revenue', value: '₹' + (s.totalRevenue || 0), color: '#e60000' },
      { label: 'Revenue (30d)', value: '₹' + (s.revenueThisMonth || 0), color: '#ff9f43' },
      { label: 'Enrolled Courses', value: s.enrolledCourses },
      { label: 'Active Learners (7d)', value: s.activeLearners },
      { label: 'New Subs (30d)', value: s.recentSubscriptions },
      { label: 'Total Transactions', value: s.revenueTransactions },
    ];

    grid.innerHTML = cards
      .map(
        (c) => `
      <div class="stat-card"${c.color ? ` style="background: ${c.color}; color: white"` : ''}>
        <div class="value">${c.value ?? 0}</div>
        <div class="label"${c.color ? ' style="color: rgba(255,255,255,0.9)"' : ''}>${c.label}</div>
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
  await showUserDetails(userId);
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

// ============================================================================
// GAME QUESTIONS MANAGEMENT
// ============================================================================

let selectedGame = null;
let currentGameConfig = null;
let gameQuestions = [];

$('gameSelect').addEventListener('change', async (e) => {
  selectedGame = e.target.value;
  if (!selectedGame) {
    $('currentMaxLevel').value = '';
    $('totalQuestions').value = '';
    $('questionsListSection').classList.add('hidden');
    return;
  }
  
  try {
    showStatus($('gameQuestionsStatus'), 'Loading game configuration...', 'info');
    const [config, stats] = await Promise.all([
      api(`/api/admin/games/${selectedGame}/levels`),
      api(`/api/admin/games/${selectedGame}/questions/stats`)
    ]);
    
    currentGameConfig = config;
    $('currentMaxLevel').value = config.maxLevel;
    $('totalQuestions').value = stats.total || 0;
    showStatus($('gameQuestionsStatus'), `Loaded: ${stats.total} questions, max level ${config.maxLevel}`, 'ok');
  } catch (err) {
    showStatus($('gameQuestionsStatus'), 'Failed to load game config: ' + err.message, 'err');
  }
});

$('loadGameQuestionsBtn').addEventListener('click', async () => {
  if (!selectedGame) {
    showStatus($('gameQuestionsStatus'), 'Please select a game first', 'err');
    return;
  }
  
  try {
    showStatus($('gameQuestionsStatus'), 'Loading questions...', 'info');
    const data = await api(`/api/admin/games/${selectedGame}/questions?active=true`);
    gameQuestions = data.questions || [];
    
    renderGameQuestions();
    $('questionsListSection').classList.remove('hidden');
    $('questionsGameTitle').textContent = selectedGame.charAt(0).toUpperCase() + selectedGame.slice(1);
    showStatus($('gameQuestionsStatus'), `Loaded ${gameQuestions.length} questions`, 'ok');
  } catch (err) {
    showStatus($('gameQuestionsStatus'), 'Failed to load questions: ' + err.message, 'err');
  }
});

$('newQuestionBtn').addEventListener('click', () => {
  if (!selectedGame) {
    showStatus($('gameQuestionsStatus'), 'Please select a game first', 'err');
    return;
  }
  
  $('questionFormTitle').textContent = 'Add New Question';
  $('editQuestionId').value = '';
  $('questionForm').reset();
  $('questionLevel').value = 1;
  $('questionDifficulty').value = 'easy';
  $('questionOrder').value = 0;
  
  showQuestionFields(selectedGame);
  $('questionFormSection').classList.remove('hidden');
  $('questionFormSection').scrollIntoView({ behavior: 'smooth' });
});

$('manageLevelsBtn').addEventListener('click', () => {
  if (!selectedGame || !currentGameConfig) {
    showStatus($('gameQuestionsStatus'), 'Please select a game first', 'err');
    return;
  }
  
  $('levelGameName').textContent = selectedGame.charAt(0).toUpperCase() + selectedGame.slice(1);
  $('configMaxLevel').value = currentGameConfig.maxLevel;
  $('configPointsPerCorrect').value = currentGameConfig.pointsPerCorrect || 5;
  $('configDescription').value = currentGameConfig.description || '';
  
  $('levelManagementSection').classList.remove('hidden');
  $('levelManagementSection').scrollIntoView({ behavior: 'smooth' });
});

$('cancelQuestionBtn').addEventListener('click', () => {
  $('questionFormSection').classList.add('hidden');
});

$('closeLevelConfigBtn').addEventListener('click', () => {
  $('levelManagementSection').classList.add('hidden');
});

$('questionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = $('saveQuestionBtn');
  btn.disabled = true;
  
  try {
    const questionId = $('editQuestionId').value;
    const level = parseInt($('questionLevel').value, 10);
    const difficulty = $('questionDifficulty').value;
    const order = parseInt($('questionOrder').value, 10);
    
    const body = { level, difficulty, order, active: true };
    
    // Build question data based on game type
    if (selectedGame === 'quiz') {
      const options = [
        $('quizOption1').value.trim(),
        $('quizOption2').value.trim(),
        $('quizOption3').value.trim(),
        $('quizOption4').value.trim(),
      ].filter(opt => opt);
      
      if (options.length < 2) {
        throw new Error('Quiz questions need at least 2 options');
      }
      
      body.question = $('quizQuestion').value.trim();
      body.options = options;
      body.answer = parseInt($('quizAnswer').value, 10);
      body.explanation = $('quizExplanation').value.trim() || undefined;
      
      if (!body.question) throw new Error('Question text is required');
      if (body.answer < 0 || body.answer >= options.length) throw new Error('Invalid answer index');
      
    } else if (selectedGame === 'scramble') {
      body.word = $('scrambleWord').value.trim().toUpperCase();
      body.hint = $('scrambleHint').value.trim();
      
      if (!body.word || !body.hint) throw new Error('Word and hint are required');
      
    } else if (selectedGame === 'fill') {
      const options = [
        $('fillOption1').value.trim(),
        $('fillOption2').value.trim(),
        $('fillOption3').value.trim(),
        $('fillOption4').value.trim(),
      ].filter(opt => opt);
      
      if (options.length < 2) {
        throw new Error('Fill-blank questions need at least 2 options');
      }
      
      body.sentence = $('fillSentence').value.trim();
      body.options = options;
      body.answer = parseInt($('fillAnswer').value, 10);
      body.correctText = $('fillCorrectText').value.trim();
      body.rule = $('fillRule').value.trim() || undefined;
      
      if (!body.sentence || !body.correctText) throw new Error('Sentence and correct text are required');
      if (body.answer < 0 || body.answer >= options.length) throw new Error('Invalid answer index');
      
    } else if (selectedGame === 'flash') {
      body.word = $('flashWord').value.trim();
      body.meaning = $('flashMeaning').value.trim();
      body.example = $('flashExample').value.trim();
      
      if (!body.word || !body.meaning || !body.example) {
        throw new Error('Word, meaning, and example are all required');
      }
    }
    
    let result;
    if (questionId) {
      result = await api(`/api/admin/games/${selectedGame}/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showStatus($('questionFormStatus'), 'Question updated successfully', 'ok');
    } else {
      result = await api(`/api/admin/games/${selectedGame}/questions`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showStatus($('questionFormStatus'), 'Question created successfully', 'ok');
    }
    
    setTimeout(() => {
      $('questionFormSection').classList.add('hidden');
      $('loadGameQuestionsBtn').click();
    }, 1000);
    
  } catch (err) {
    showStatus($('questionFormStatus'), err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

$('saveLevelConfigBtn').addEventListener('click', async () => {
  const btn = $('saveLevelConfigBtn');
  btn.disabled = true;
  
  try {
    const body = {
      maxLevel: parseInt($('configMaxLevel').value, 10),
      pointsPerCorrect: parseInt($('configPointsPerCorrect').value, 10),
      description: $('configDescription').value.trim(),
    };
    
    if (body.maxLevel < 1) {
      throw new Error('Max level must be at least 1');
    }
    
    const result = await api(`/api/admin/games/${selectedGame}/levels`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    
    currentGameConfig = result;
    $('currentMaxLevel').value = result.maxLevel;
    
    showStatus($('levelConfigStatus'), 'Level configuration updated successfully', 'ok');
    setTimeout(() => {
      $('levelManagementSection').classList.add('hidden');
    }, 1200);
    
  } catch (err) {
    showStatus($('levelConfigStatus'), err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

function showQuestionFields(gameId) {
  document.querySelectorAll('.question-type-fields').forEach(el => el.classList.add('hidden'));
  
  if (gameId === 'quiz') {
    $('quizFields').classList.remove('hidden');
  } else if (gameId === 'scramble') {
    $('scrambleFields').classList.remove('hidden');
  } else if (gameId === 'fill') {
    $('fillFields').classList.remove('hidden');
  } else if (gameId === 'flash') {
    $('flashFields').classList.remove('hidden');
  }
}

function renderGameQuestions() {
  const container = $('questionsListContainer');
  
  if (gameQuestions.length === 0) {
    container.innerHTML = '<p style="color: #636e72">No questions found. Create your first question above.</p>';
    return;
  }
  
  // Group by level
  const byLevel = {};
  gameQuestions.forEach(q => {
    if (!byLevel[q.level]) byLevel[q.level] = [];
    byLevel[q.level].push(q);
  });
  
  const levels = Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b));
  
  let html = '';
  levels.forEach(level => {
    const questions = byLevel[level];
    html += `
      <div style="margin: 1rem 0; padding: 0.75rem; background: #f8f9fa; border-radius: 4px">
        <h4 style="margin: 0 0 0.5rem; color: #2d3436">Level ${level} (${questions.length} questions)</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem">
    `;
    
    questions.forEach(q => {
      const preview = getQuestionPreview(q);
      html += `
        <div style="padding: 0.5rem; background: white; border-radius: 4px; border: 1px solid #dfe6e9">
          <div style="font-size: 0.88rem; color: #636e72; margin-bottom: 0.25rem">
            <span style="font-weight: 600">${q.difficulty || 'easy'}</span> · Order: ${q.order || 0}
          </div>
          <div style="font-size: 0.9rem; color: #2d3436">${preview}</div>
          <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem">
            <button type="button" class="secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem" onclick="editQuestion('${q._id}')">Edit</button>
            <button type="button" class="secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; color: #d63031" onclick="deleteQuestion('${q._id}')">Delete</button>
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
  });
  
  container.innerHTML = html;
}

function getQuestionPreview(q) {
  if (selectedGame === 'quiz') {
    return `<strong>Q:</strong> ${q.question || ''}`;
  } else if (selectedGame === 'scramble') {
    return `<strong>Word:</strong> ${q.word || ''} — ${q.hint || ''}`;
  } else if (selectedGame === 'fill') {
    return `<strong>Sentence:</strong> ${q.sentence || ''}`;
  } else if (selectedGame === 'flash') {
    return `<strong>Word:</strong> ${q.word || ''} — ${q.meaning || ''}`;
  }
  return '';
}

window.editQuestion = async function(questionId) {
  const question = gameQuestions.find(q => q._id === questionId);
  if (!question) return;
  
  $('questionFormTitle').textContent = 'Edit Question';
  $('editQuestionId').value = questionId;
  $('questionLevel').value = question.level;
  $('questionDifficulty').value = question.difficulty || 'easy';
  $('questionOrder').value = question.order || 0;
  
  showQuestionFields(selectedGame);
  
  if (selectedGame === 'quiz') {
    $('quizQuestion').value = question.question || '';
    $('quizOption1').value = question.options?.[0] || '';
    $('quizOption2').value = question.options?.[1] || '';
    $('quizOption3').value = question.options?.[2] || '';
    $('quizOption4').value = question.options?.[3] || '';
    $('quizAnswer').value = question.answer || 0;
    $('quizExplanation').value = question.explanation || '';
  } else if (selectedGame === 'scramble') {
    $('scrambleWord').value = question.word || '';
    $('scrambleHint').value = question.hint || '';
  } else if (selectedGame === 'fill') {
    $('fillSentence').value = question.sentence || '';
    $('fillOption1').value = question.options?.[0] || '';
    $('fillOption2').value = question.options?.[1] || '';
    $('fillOption3').value = question.options?.[2] || '';
    $('fillOption4').value = question.options?.[3] || '';
    $('fillAnswer').value = question.answer || 0;
    $('fillCorrectText').value = question.correctText || '';
    $('fillRule').value = question.rule || '';
  } else if (selectedGame === 'flash') {
    $('flashWord').value = question.word || '';
    $('flashMeaning').value = question.meaning || '';
    $('flashExample').value = question.example || '';
  }
  
  $('questionFormSection').classList.remove('hidden');
  $('questionFormSection').scrollIntoView({ behavior: 'smooth' });
};

window.deleteQuestion = async function(questionId) {
  if (!confirm('Are you sure you want to delete this question?')) return;
  
  try {
    await api(`/api/admin/games/${selectedGame}/questions/${questionId}`, {
      method: 'DELETE',
    });
    
    showStatus($('gameQuestionsStatus'), 'Question deleted successfully', 'ok');
    $('loadGameQuestionsBtn').click();
  } catch (err) {
    showStatus($('gameQuestionsStatus'), 'Failed to delete: ' + err.message, 'err');
  }
};

// ============================================================================
// NOTIFICATION MANAGEMENT
// ============================================================================

let allNotifications = [];

$('notifAudience').addEventListener('change', (e) => {
  const val = e.target.value;
  $('notifRegionFields').classList.toggle('hidden', val !== 'region');
  $('notifLevelFields').classList.toggle('hidden', val !== 'level');
  $('notifCustomFields').classList.toggle('hidden', val !== 'custom');
});

$('newNotificationBtn').addEventListener('click', () => {
  $('notificationFormTitle').textContent = 'Create Notification';
  $('editNotificationId').value = '';
  $('notificationForm').reset();
  $('notifType').value = 'system';
  $('notifAudience').value = 'all';
  
  $('notifRegionFields').classList.add('hidden');
  $('notifLevelFields').classList.add('hidden');
  $('notifCustomFields').classList.add('hidden');
  $('previewTargetsResult').classList.add('hidden');
  
  $('notificationFormSection').classList.remove('hidden');
  $('notificationFormSection').scrollIntoView({ behavior: 'smooth' });
});

$('loadNotificationsBtn').addEventListener('click', loadNotifications);

$('cancelNotificationBtn').addEventListener('click', () => {
  $('notificationFormSection').classList.add('hidden');
});

$('previewTargetsBtn').addEventListener('click', async () => {
  try {
    const body = {
      targetAudience: $('notifAudience').value,
      targetRegions: $('notifRegions').value.split(',').map(s => s.trim()).filter(Boolean),
      targetLevels: $('notifLevels').value.split(',').map(s => s.trim()).filter(Boolean),
      targetUserIds: $('notifUserIds').value.split(',').map(s => s.trim()).filter(Boolean),
    };
    
    const result = await api('/api/admin/notifications/preview-targets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    const preview = $('previewTargetsResult');
    preview.innerHTML = `
      <strong>${result.count}</strong> users will receive this notification.
      ${result.sample.length > 0 ? '<br>Sample: ' + result.sample.map(u => u.name || u.email).slice(0, 5).join(', ') : ''}
    `;
    preview.classList.remove('hidden');
  } catch (err) {
    showStatus($('notificationFormStatus'), 'Preview failed: ' + err.message, 'err');
  }
});

$('notificationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = $('saveNotificationBtn');
  btn.disabled = true;
  
  try {
    const notificationId = $('editNotificationId').value;
    
    const body = {
      title: $('notifTitle').value.trim(),
      message: $('notifMessage').value.trim(),
      type: $('notifType').value,
      targetAudience: $('notifAudience').value,
      targetRegions: $('notifRegions').value.split(',').map(s => s.trim()).filter(Boolean),
      targetLevels: $('notifLevels').value.split(',').map(s => s.trim()).filter(Boolean),
      targetUserIds: $('notifUserIds').value.split(',').map(s => s.trim()).filter(Boolean),
      scheduledFor: $('notifSchedule').value || undefined,
      data: $('notifRoute').value.trim() ? { route: $('notifRoute').value.trim() } : undefined,
    };
    
    if (!body.title || !body.message) {
      throw new Error('Title and message are required');
    }
    
    let result;
    if (notificationId) {
      result = await api(`/api/admin/notifications/${notificationId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showStatus($('notificationFormStatus'), 'Notification updated successfully', 'ok');
    } else {
      result = await api('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showStatus($('notificationFormStatus'), `Notification created and ${body.scheduledFor ? 'scheduled' : 'sent'}`, 'ok');
    }
    
    setTimeout(() => {
      $('notificationFormSection').classList.add('hidden');
      loadNotifications();
    }, 1000);
    
  } catch (err) {
    showStatus($('notificationFormStatus'), err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

async function loadNotifications() {
  try {
    showStatus($('notificationsStatus'), 'Loading notifications...', 'info');
    const data = await api('/api/admin/notifications?limit=50');
    allNotifications = data.notifications || [];
    
    renderNotifications();
    showStatus($('notificationsStatus'), `Loaded ${allNotifications.length} notifications`, 'ok');
  } catch (err) {
    showStatus($('notificationsStatus'), 'Failed to load: ' + err.message, 'err');
  }
}

function renderNotifications() {
  const container = $('notificationsListContainer');
  
  if (allNotifications.length === 0) {
    container.innerHTML = '<p style="color: #636e72">No notifications found. Create your first notification above.</p>';
    return;
  }
  
  let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem">';
  
  allNotifications.forEach(notif => {
    const statusColors = {
      draft: '#636e72',
      scheduled: '#0984e3',
      sending: '#fdcb6e',
      sent: '#00b894',
      cancelled: '#d63031',
    };
    
    const statusColor = statusColors[notif.status] || '#636e72';
    
    html += `
      <div style="padding: 1rem; background: white; border-radius: 4px; border: 1px solid #dfe6e9">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem">
          <div>
            <h4 style="margin: 0 0 0.25rem; color: #2d3436">${notif.title}</h4>
            <p style="margin: 0; font-size: 0.88rem; color: #636e72">${notif.message}</p>
          </div>
          <span style="padding: 0.25rem 0.6rem; background: ${statusColor}; color: white; border-radius: 4px; font-size: 0.8rem; white-space: nowrap">
            ${notif.status}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: #636e72; margin-bottom: 0.5rem">
          <strong>Target:</strong> ${notif.targetAudience || 'all'} · 
          <strong>Type:</strong> ${notif.type} · 
          ${notif.scheduledFor ? `<strong>Scheduled:</strong> ${formatDate(notif.scheduledFor)}` : '<strong>Sent:</strong> ' + (notif.sentAt ? formatDate(notif.sentAt) : 'Not sent')}
          ${notif.recipientCount ? ` · <strong>Recipients:</strong> ${notif.recipientCount}` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
          ${notif.status !== 'sent' && notif.status !== 'cancelled' ? `
            <button type="button" class="secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem" onclick="editNotification('${notif._id}')">Edit</button>
          ` : ''}
          ${notif.status === 'scheduled' || notif.status === 'draft' ? `
            <button type="button" class="secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem" onclick="sendNotificationNow('${notif._id}')">Send Now</button>
          ` : ''}
          ${notif.status !== 'sent' ? `
            <button type="button" class="secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem; color: #d63031" onclick="deleteNotification('${notif._id}')">Delete</button>
          ` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

window.editNotification = async function(notificationId) {
  try {
    const notif = await api(`/api/admin/notifications/${notificationId}`);
    
    $('notificationFormTitle').textContent = 'Edit Notification';
    $('editNotificationId').value = notificationId;
    $('notifTitle').value = notif.title;
    $('notifMessage').value = notif.message;
    $('notifType').value = notif.type;
    $('notifAudience').value = notif.targetAudience;
    
    $('notifRegions').value = (notif.targetRegions || []).join(', ');
    $('notifLevels').value = (notif.targetLevels || []).join(', ');
    $('notifUserIds').value = (notif.targetUserIds || []).join(', ');
    
    if (notif.scheduledFor) {
      const d = new Date(notif.scheduledFor);
      $('notifSchedule').value = d.toISOString().slice(0, 16);
    } else {
      $('notifSchedule').value = '';
    }
    
    $('notifRoute').value = notif.data?.route || '';
    
    $('notifRegionFields').classList.toggle('hidden', notif.targetAudience !== 'region');
    $('notifLevelFields').classList.toggle('hidden', notif.targetAudience !== 'level');
    $('notifCustomFields').classList.toggle('hidden', notif.targetAudience !== 'custom');
    
    $('notificationFormSection').classList.remove('hidden');
    $('notificationFormSection').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showStatus($('notificationsStatus'), 'Failed to load notification: ' + err.message, 'err');
  }
};

window.sendNotificationNow = async function(notificationId) {
  if (!confirm('Send this notification now to all target users?')) return;
  
  try {
    await api(`/api/admin/notifications/${notificationId}/send`, {
      method: 'POST',
    });
    
    showStatus($('notificationsStatus'), 'Notification sent successfully', 'ok');
    loadNotifications();
  } catch (err) {
    showStatus($('notificationsStatus'), 'Failed to send: ' + err.message, 'err');
  }
};

window.deleteNotification = async function(notificationId) {
  if (!confirm('Are you sure you want to delete this notification?')) return;
  
  try {
    await api(`/api/admin/notifications/${notificationId}`, {
      method: 'DELETE',
    });
    
    showStatus($('notificationsStatus'), 'Notification deleted successfully', 'ok');
    loadNotifications();
  } catch (err) {
    showStatus($('notificationsStatus'), 'Failed to delete: ' + err.message, 'err');
  }
};

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

let subscriptionsPage = 1;
let subscriptionsPagination = { pages: 1 };

$('loadSubscriptionsBtn').addEventListener('click', () => loadSubscriptions(1));
$('prevSubscriptionsBtn').addEventListener('click', () => loadSubscriptions(subscriptionsPage - 1));
$('nextSubscriptionsBtn').addEventListener('click', () => loadSubscriptions(subscriptionsPage + 1));
$('subscriptionStatusFilter').addEventListener('change', () => loadSubscriptions(1));
$('subscriptionPaymentFilter').addEventListener('change', () => loadSubscriptions(1));

async function loadSubscriptions(page = 1) {
  const statusFilter = $('subscriptionStatusFilter').value;
  const paymentFilter = $('subscriptionPaymentFilter').value;
  
  let query = `page=${page}&limit=20`;
  if (statusFilter) query += `&status=${statusFilter}`;
  if (paymentFilter) query += `&paymentStatus=${paymentFilter}`;
  
  try {
    showStatus($('subscriptionsStatus'), 'Loading subscriptions...', 'info');
    const data = await api(`/api/admin/subscriptions?${query}`);
    
    subscriptionsPage = data.pagination.page;
    subscriptionsPagination = data.pagination;
    
    renderSubscriptions(data.subscriptions);
    updateSubscriptionsPagination();
    
    showStatus($('subscriptionsStatus'), `Loaded ${data.subscriptions.length} subscriptions`, 'ok');
  } catch (err) {
    showStatus($('subscriptionsStatus'), 'Failed to load: ' + err.message, 'err');
    $('subscriptionsTableBody').innerHTML = '<tr><td colspan="9">Error loading subscriptions</td></tr>';
  }
}

function renderSubscriptions(subscriptions) {
  const tbody = $('subscriptionsTableBody');
  
  if (subscriptions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #636e72">No subscriptions found</td></tr>';
    return;
  }
  
  tbody.innerHTML = subscriptions.map(sub => {
    const statusColors = {
      active: '#00b894',
      expired: '#636e72',
      cancelled: '#d63031',
      pending: '#fdcb6e',
    };
    
    const paymentColors = {
      completed: '#00b894',
      pending: '#fdcb6e',
      failed: '#d63031',
      refunded: '#74b9ff',
    };
    
    return `
      <tr>
        <td>
          <strong>${sub.user?.name || 'Unknown'}</strong><br>
          <small style="color: #636e72">${sub.user?.email || ''}</small>
        </td>
        <td>${sub.planName || 'Pro'}</td>
        <td>₹${sub.price || 0}</td>
        <td>${formatDate(sub.purchaseDate)}</td>
        <td>${formatDate(sub.expiryDate)}</td>
        <td>
          <span style="display: inline-block; padding: 0.25rem 0.6rem; background: ${statusColors[sub.status] || '#636e72'}; color: white; border-radius: 4px; font-size: 0.8rem">
            ${sub.status}
          </span>
        </td>
        <td>
          <span style="display: inline-block; padding: 0.25rem 0.6rem; background: ${paymentColors[sub.paymentStatus] || '#636e72'}; color: white; border-radius: 4px; font-size: 0.8rem">
            ${sub.paymentStatus}
          </span>
        </td>
        <td>
          <small style="font-family: monospace; color: #636e72">${sub.razorpayPaymentId || sub.transactionId || '—'}</small>
        </td>
        <td>
          <button type="button" class="secondary" style="font-size: 0.85rem; padding: 0.35rem 0.75rem" onclick="viewSubscriptionDetails('${sub._id}')">
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateSubscriptionsPagination() {
  const info = $('subscriptionsPageInfo');
  const prev = $('prevSubscriptionsBtn');
  const next = $('nextSubscriptionsBtn');
  
  info.textContent = `Page ${subscriptionsPagination.page} of ${subscriptionsPagination.pages} (${subscriptionsPagination.total} total)`;
  prev.disabled = subscriptionsPagination.page <= 1;
  next.disabled = subscriptionsPagination.page >= subscriptionsPagination.pages;
}

window.viewSubscriptionDetails = async function(subscriptionId) {
  try {
    const sub = await api(`/api/admin/subscriptions/${subscriptionId}`);
    
    const modal = $('userModal');
    const body = $('userModalBody');
    
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem">
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">User Information</h4>
          <table style="width: 100%; font-size: 0.9rem">
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Name:</strong></td><td>${sub.user?.name || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Email:</strong></td><td>${sub.user?.email || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Phone:</strong></td><td>${sub.user?.phone || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Region:</strong></td><td>${sub.user?.region || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Level:</strong></td><td>${sub.user?.level || '—'}</td></tr>
          </table>
        </div>
        
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Subscription Details</h4>
          <table style="width: 100%; font-size: 0.9rem">
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Plan:</strong></td><td>${sub.planName || 'Pro'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Amount:</strong></td><td>₹${sub.price || 0} ${sub.currency || 'INR'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Status:</strong></td><td>${sub.status}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Payment Status:</strong></td><td>${sub.paymentStatus}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Purchase Date:</strong></td><td>${formatDate(sub.purchaseDate)}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Expiry Date:</strong></td><td>${formatDate(sub.expiryDate)}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Email Sent:</strong></td><td>${sub.emailSent ? 'Yes (' + formatDate(sub.emailSentAt) + ')' : 'No'}</td></tr>
          </table>
        </div>
        
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Payment Information</h4>
          <table style="width: 100%; font-size: 0.9rem">
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Transaction ID:</strong></td><td style="font-family: monospace">${sub.transactionId || sub.razorpayPaymentId || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Order ID:</strong></td><td style="font-family: monospace">${sub.razorpayOrderId || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Payment ID:</strong></td><td style="font-family: monospace">${sub.razorpayPaymentId || '—'}</td></tr>
          </table>
        </div>
      </div>
    `;
    
    modal.classList.remove('hidden');
  } catch (err) {
    showStatus($('subscriptionsStatus'), 'Failed to load subscription details: ' + err.message, 'err');
  }
};

// Enhanced user details modal with subscription and course info
async function showUserDetails(userId) {
  try {
    const userData = await api(`/api/admin/users/${userId}`);
    
    const modal = $('userModal');
    const body = $('userModalBody');
    
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem">
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Profile Information</h4>
          <table style="width: 100%; font-size: 0.9rem">
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Name:</strong></td><td>${userData.user.name || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Email:</strong></td><td>${userData.user.email || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Phone:</strong></td><td>${userData.user.phone || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Region:</strong></td><td>${userData.user.region || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Level:</strong></td><td>${userData.user.level || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Gender:</strong></td><td>${userData.user.gender || '—'}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Total Points:</strong></td><td>${userData.user.totalPoints || 0}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Registered:</strong></td><td>${formatDate(userData.user.createdAt)}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Last Active:</strong></td><td>${formatDate(userData.user.lastSeen)}</td></tr>
          </table>
        </div>
        
        ${userData.subscriptionSummary && userData.subscriptionSummary.active ? `
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Current Subscription</h4>
          <table style="width: 100%; font-size: 0.9rem">
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Plan:</strong></td><td>${userData.subscriptionSummary.plan}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Status:</strong></td><td>${userData.subscriptionSummary.status}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Expiry:</strong></td><td>${formatDate(userData.subscriptionSummary.expiryDate)}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Days Remaining:</strong></td><td>${userData.subscriptionSummary.remainingDays} days</td></tr>
          </table>
        </div>
        ` : ''}
        
        ${userData.subscriptions && userData.subscriptions.length > 0 ? `
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Subscription History (${userData.subscriptions.length})</h4>
          <div style="max-height: 200px; overflow-y: auto; border: 1px solid #dfe6e9; border-radius: 4px">
            ${userData.subscriptions.map(sub => `
              <div style="padding: 0.75rem; border-bottom: 1px solid #f1f3f5">
                <div style="font-size: 0.88rem">
                  <strong>${sub.planName || 'Pro'}</strong> - ₹${sub.price} - ${sub.status}
                </div>
                <div style="font-size: 0.8rem; color: #636e72; margin-top: 0.25rem">
                  ${formatDate(sub.purchaseDate)} → ${formatDate(sub.expiryDate)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Course Progress</h4>
          <table style="width: 100%; font-size: 0.9rem">
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Total Lessons:</strong></td><td>${userData.courseProgress?.totalLessons || 0}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Completed:</strong></td><td>${userData.courseProgress?.completedLessons?.length || 0}</td></tr>
            <tr><td style="padding: 0.5rem 0; color: #636e72"><strong>Completion:</strong></td><td>${userData.courseProgress?.completionPercentage || 0}%</td></tr>
          </table>
        </div>
        
        ${userData.courses && userData.courses.length > 0 ? `
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Course Details</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem">
            ${userData.courses.map(course => `
              <div style="padding: 0.75rem; background: #f8f9fa; border-radius: 4px">
                <div style="font-size: 0.88rem"><strong>${course.title}</strong></div>
                <div style="font-size: 0.8rem; color: #636e72; margin-top: 0.25rem">
                  ${course.completedInCourse || 0} / ${course.totalLessons || 0} lessons completed
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${userData.gameProgress && userData.gameProgress.length > 0 ? `
        <div>
          <h4 style="margin: 0 0 0.5rem; color: #2d3436">Game Activity</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem">
            ${userData.gameProgress.map(game => `
              <div style="padding: 0.75rem; background: #f8f9fa; border-radius: 4px">
                <div style="font-size: 0.88rem"><strong>${game.gameId.charAt(0).toUpperCase() + game.gameId.slice(1)}</strong></div>
                <div style="font-size: 0.8rem; color: #636e72; margin-top: 0.25rem">
                  Level ${game.level || 0} · Score: ${game.score || 0} · Accuracy: ${game.stats?.accuracy || 100}%
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;
    
    modal.classList.remove('hidden');
  } catch (err) {
    alert('Failed to load user details: ' + err.message);
  }
}

tryRestoreSession();
