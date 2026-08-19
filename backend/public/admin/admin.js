const API = window.location.origin.replace(/\/$/, '');
const AUTO_REFRESH_MS = 60 * 1000;

let token = sessionStorage.getItem('adminToken') || '';
let usersPage = 1;
let usersPagination = { pages: 1 };
let autoRefreshTimer = null;
let cachedCourses = [];
/** Active uploads shown at top of Courses tab */
const uploadJobs = [];
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
    loadSubscriptionPlans();
    loadSubscriptions();
  }
  if (name === 'coupons') {
    loadCoupons();
  }
  if (name === 'games') {
    $('gameSelect').value = '';
    $('questionFormSection').classList.add('hidden');
    $('levelManagementSection').classList.add('hidden');
    $('questionsListSection').classList.add('hidden');
  }
  if (name === 'notifications') {
    loadNotifications();
    loadPushNotificationStats();
    loadPushNotificationHistory();
  }
  if (name === 'home') {
    loadHomeHero();
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
      tbody.innerHTML = '<tr><td colspan="7">No users found</td></tr>';
    } else {
      tbody.innerHTML = data.users
        .map(
          (u) => `
        <tr>
          <td>${u.name || '—'}</td>
          <td>${u.email}</td>
          <td>
            <code class="user-id-cell" style="cursor: pointer; font-size: 0.85rem; padding: 0.25rem 0.5rem; background: #f0f0f0; border-radius: 4px;" 
                  onclick="navigator.clipboard.writeText('${u._id}').then(() => {
                    const el = this;
                    const orig = el.textContent;
                    el.textContent = '✓ Copied!';
                    el.style.background = '#00b894';
                    el.style.color = 'white';
                    setTimeout(() => {
                      el.textContent = orig;
                      el.style.background = '#f0f0f0';
                      el.style.color = '';
                    }, 1500);
                  })"
                  title="Click to copy User ID">${u._id}</code>
          </td>
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
  if (!$('panel-subscriptions').classList.contains('hidden')) {
    loadSubscriptionPlans();
    loadSubscriptions(subscriptionsPage);
  }
  if (!$('panel-coupons').classList.contains('hidden')) {
    loadCoupons();
  }
  if (!$('panel-notifications')?.classList.contains('hidden')) {
    loadNotifications();
    loadPushNotificationStats();
    loadPushNotificationHistory();
  }
  if (!$('panel-home')?.classList.contains('hidden')) {
    loadHomeHero(true);
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

function lessonAppBadge(lesson) {
  const status = lesson.appStatus;
  if (!status) {
    return lesson.videoUrl
      ? '<span class="badge ok">Video ✓</span>'
      : '<span class="badge">No video</span>';
  }
  if (status.videoVisibleInApp) {
    return '<span class="badge ok">Video live in app</span>';
  }
  if (status.videoState === 'pending') {
    return `<span class="badge warn">Video processing (${status.videoPendingSeconds}s)</span>`;
  }
  if (status.videoState === 'missing_file') {
    return '<span class="badge err">Video missing — re-upload</span>';
  }
  if (status.hasVideoUrl) {
    return '<span class="badge warn">Video saved — not in app yet</span>';
  }
  return '<span class="badge">No video</span>';
}

function pdfAppBadge(lesson) {
  const status = lesson.appStatus;
  if (!status) {
    return lesson.pdfUrl ? '<span class="badge ok">PDF ✓</span>' : '<span class="badge">No PDF</span>';
  }
  if (status.pdfVisibleInApp) {
    return '<span class="badge ok">PDF live in app</span>';
  }
  if (status.pdfState === 'pending') {
    return `<span class="badge warn">PDF processing (${status.pdfPendingSeconds}s)</span>`;
  }
  if (status.pdfState === 'missing_file') {
    return '<span class="badge err">PDF missing — re-upload</span>';
  }
  if (status.hasPdfUrl) {
    return '<span class="badge warn">PDF saved — not in app yet</span>';
  }
  return '<span class="badge">No PDF</span>';
}

function lessonRowHtml(courseId, lesson) {
  return `
    <div class="lesson-row" data-lesson-row="${lesson._id}">
      <div class="lesson-title">
        <strong>${esc(lesson.title)}</strong>
        <span style="color:#636e72;font-size:0.82rem">${esc(lesson.duration || '')}</span>
        ${lesson.description ? `<p class="lesson-about-preview">${esc(lesson.description.slice(0, 120))}${lesson.description.length > 120 ? '…' : ''}</p>` : ''}
      </div>
      <div class="lesson-status">
        ${lessonAppBadge(lesson)}
        ${pdfAppBadge(lesson)}
      </div>
      <div class="lesson-actions">
        <button type="button" class="ghost" data-edit-lesson="${lesson._id}" data-course-id="${courseId}">Edit</button>
        <button type="button" class="danger" data-del-lesson="${lesson._id}" data-course-id="${courseId}">Delete</button>
      </div>
    </div>`;
}

function renderUploadQueue() {
  const root = $('uploadQueue');
  if (!root) return;
  if (!uploadJobs.length) {
    root.classList.add('hidden');
    root.innerHTML = '';
    return;
  }
  root.classList.remove('hidden');
  root.innerHTML = `
    <h3 class="subheading">Uploads</h3>
    ${uploadJobs
      .map(
        (job) => `
      <div class="upload-job ${job.done ? 'done' : 'active'}" data-job-id="${esc(job.id)}">
        <div class="upload-job-head">
          <strong>${esc(job.title)}</strong>
          <span class="upload-job-stage">${esc(job.stage)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(job.progress * 100)}%"></div></div>
        <p class="progress-text">${esc(job.detail || '')}</p>
      </div>`
      )
      .join('')}`;
}

function addUploadJob(title) {
  const job = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    stage: 'Starting…',
    detail: '',
    progress: 0,
    done: false,
  };
  uploadJobs.unshift(job);
  renderUploadQueue();
  return job;
}

function updateUploadJob(job, patch) {
  Object.assign(job, patch);
  renderUploadQueue();
}

function finishUploadJob(job, ok, message) {
  job.done = true;
  job.progress = 1;
  job.stage = ok ? 'Live in app' : 'Failed';
  job.detail = message || '';
  renderUploadQueue();
  setTimeout(() => {
    const idx = uploadJobs.indexOf(job);
    if (idx >= 0) uploadJobs.splice(idx, 1);
    renderUploadQueue();
  }, ok ? 8000 : 12000);
}

async function waitForLessonInApp(courseId, lessonId, { timeoutMs = 20000, expectVideo = false, expectPdf = false } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await api(`/api/admin/courses/${courseId}/lessons/${lessonId}/app-status`);
    const videoOk = !expectVideo || status?.videoVisibleInApp;
    const pdfOk = !expectPdf || status?.pdfVisibleInApp;
    if (videoOk && pdfOk && status?.appReady) {
      return status;
    }
    if (expectVideo && status?.videoState === 'missing_file') {
      throw new Error('Video file missing on server. Upload again from admin.');
    }
    if (expectPdf && status?.pdfState === 'missing_file') {
      throw new Error('PDF file missing on server. Upload again from admin.');
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error('Lesson saved but not visible in the app yet. Pull down to refresh in My Courses.');
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
  const job = addUploadJob(title);
  try {
    let videoUrl = editing?.videoUrl;
    let videoAvailableAt = editing?.videoAvailableAt;
    let pdfUrl = editing?.pdfUrl;
    let pdfAvailableAt = editing?.pdfAvailableAt;

    if (videoInput?.files?.[0]) {
      const fd = new FormData();
      fd.append('video', videoInput.files[0]);
      updateUploadJob(job, { stage: 'Uploading video', detail: videoInput.files[0].name, progress: 0.1 });
      setSectionProgress(section, 0.1, 'Uploading video…');
      const data = await uploadWithProgress('/api/admin/upload/video', fd, (p) => {
        const pct = 0.1 + p * 0.45;
        updateUploadJob(job, { progress: pct, detail: `Uploading video… ${Math.round(p * 100)}%` });
        setSectionProgress(section, pct, `Uploading video… ${Math.round(p * 100)}%`);
      });
      videoUrl = data.url || data.videoUrl;
      videoAvailableAt = data.videoAvailableAt || data.availableAt;
      if (!videoUrl) {
        throw new Error('Video upload failed — server did not return a URL.');
      }
    }

    if (pdfInput?.files?.[0]) {
      const fd = new FormData();
      fd.append('pdf', pdfInput.files[0]);
      updateUploadJob(job, {
        stage: 'Uploading PDF',
        progress: videoInput?.files?.[0] ? 0.58 : 0.15,
        detail: pdfInput.files[0].name,
      });
      setSectionProgress(section, 0.65, 'Uploading PDF…');
      const data = await uploadWithProgress('/api/admin/upload/pdf', fd, (p) => {
        const base = videoInput?.files?.[0] ? 0.58 : 0.15;
        const pct = base + p * (videoInput?.files?.[0] ? 0.32 : 0.65);
        updateUploadJob(job, { progress: pct, detail: `Uploading PDF… ${Math.round(p * 100)}%` });
        setSectionProgress(section, pct, `Uploading PDF… ${Math.round(p * 100)}%`);
      });
      pdfUrl = data.url || data.pdfUrl;
      pdfAvailableAt = data.pdfAvailableAt || data.availableAt;
      if (!pdfUrl) {
        throw new Error('PDF upload failed — server did not return a URL.');
      }
    }

    updateUploadJob(job, {
      stage: 'Saving to app',
      progress: 0.92,
      detail: videoUrl && pdfUrl ? 'Attaching video and PDF…' : pdfUrl ? 'Attaching PDF…' : 'Attaching video…',
    });
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

    const saved = await api(`/api/admin/courses/${courseId}/lessons/upsert`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const lessonId = saved?.lesson?._id;
    const appStatus = saved?.appStatus;
    const expectVideo = Boolean(videoUrl);
    const expectPdf = Boolean(pdfUrl);

    if (lessonId && (expectVideo || expectPdf)) {
      updateUploadJob(job, { stage: 'Checking app', progress: 0.96, detail: 'Verifying in My Courses…' });
      const videoReady = !expectVideo || appStatus?.videoVisibleInApp;
      const pdfReady = !expectPdf || appStatus?.pdfVisibleInApp;
      if (!videoReady || !pdfReady) {
        await waitForLessonInApp(courseId, lessonId, { expectVideo, expectPdf });
      }
    }

    setSectionProgress(section, 1, 'Done!');
    const liveParts = [];
    if (expectVideo) liveParts.push('video');
    if (expectPdf) liveParts.push('PDF');
    const liveLabel = liveParts.length ? liveParts.join(' + ') : 'lesson';
    finishUploadJob(job, true, `"${title}" ${liveLabel} is live in My Courses`);
    if (liveEl) {
      liveEl.classList.remove('hidden');
      liveEl.textContent = `✓ "${title}" is live in My Courses! Students can use the ${liveLabel} now.`;
    }
    showStatus(statusEl, `Saved "${title}" — live in the app`, 'ok');

    delete editingLesson[courseId];
    if (videoInput) videoInput.value = '';
    if (pdfInput) pdfInput.value = '';
    section.querySelectorAll('.drop-file').forEach((el) => {
      el.textContent = '';
      el.classList.add('hidden');
    });
    await loadCourses();
    renderCategorySections();
  } catch (e) {
    finishUploadJob(job, false, e.message);
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

// ============================================
// PUSH NOTIFICATIONS (FCM)
// ============================================

async function loadPushNotificationStats() {
  try {
    const data = await api('/api/admin/push-notifications/stats');
    const stats = data.data || {};
    
    $('activeDevicesCount').textContent = stats.activeDevices || 0;
    $('usersWithNotifCount').textContent = stats.usersWithNotifications || 0;
    $('totalPushSentCount').textContent = stats.totalNotificationsSent || 0;
    
    // Daily notification stats
    const daily = stats.dailyNotifications || {};
    $('dailyNotifSentToday').textContent = daily.sentToday || 0;
    $('dailyNotifTotalAll').textContent = daily.totalAllTime || 0;
    
    const fcmStatus = stats.firebaseEnabled ? '●' : '○';
    const fcmColor = stats.firebaseEnabled ? '#00b894' : '#636e72';
    $('fcmStatusIndicator').textContent = fcmStatus;
    $('fcmStatusIndicator').style.color = fcmColor;
    $('fcmStatusIndicator').title = stats.firebaseEnabled 
      ? 'Firebase Cloud Messaging is enabled' 
      : 'Firebase Cloud Messaging is not configured';
    
    showStatus($('pushNotifStatus'), 
      stats.firebaseEnabled 
        ? `Ready to send notifications to ${stats.activeDevices} devices` 
        : 'Push notifications not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to .env', 
      stats.firebaseEnabled ? 'ok' : 'warn'
    );
  } catch (err) {
    showStatus($('pushNotifStatus'), 'Failed to load stats: ' + err.message, 'err');
  }
}

async function loadPushNotificationHistory() {
  try {
    const data = await api('/api/admin/push-notifications/history?limit=20');
    const notifications = data.data?.notifications || [];
    
    if (notifications.length === 0) {
      $('pushNotifHistoryContainer').innerHTML = '<p style="color: #636e72">No push notifications sent yet</p>';
      return;
    }
    
    $('pushNotifHistoryContainer').innerHTML = notifications.map(notif => {
      const statusBadge = notif.status === 'sent' 
        ? `<span style="color: #00b894">●</span> Sent` 
        : notif.status === 'failed'
        ? `<span style="color: #d63031">●</span> Failed`
        : `<span style="color: #fdcb6e">●</span> ${notif.status}`;
      
      const successRate = notif.totalSent > 0 
        ? ((notif.successCount / notif.totalSent) * 100).toFixed(1) 
        : '0.0';
      
      return `
        <div class="notification-item" style="padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #dfe6e9; border-radius: 6px">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem">
            <strong style="font-size: 0.95rem">${notif.title}</strong>
            <span style="font-size: 0.8rem; color: #636e72">${formatDate(notif.createdAt)}</span>
          </div>
          <p style="margin: 0.25rem 0; color: #2d3436; font-size: 0.88rem">${notif.body}</p>
          <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.85rem; color: #636e72">
            <span>${statusBadge}</span>
            <span>Target: ${notif.targetType}</span>
            <span>Sent: ${notif.successCount}/${notif.totalSent} (${successRate}%)</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    $('pushNotifHistoryContainer').innerHTML = `<p style="color: #d63031">Failed to load history: ${err.message}</p>`;
  }
}

$('loadPushStatsBtn').addEventListener('click', () => {
  loadPushNotificationStats();
  loadPushNotificationHistory();
});

$('newPushNotifBtn').addEventListener('click', () => {
  $('pushNotifForm').reset();
  $('pushSpecificUsersFields').classList.add('hidden');
  $('pushNotifFormSection').classList.remove('hidden');
  $('pushNotifFormStatus').classList.add('hidden');
  $('pushNotifFormSection').scrollIntoView({ behavior: 'smooth' });
});

$('cancelPushNotifBtn').addEventListener('click', () => {
  $('pushNotifFormSection').classList.add('hidden');
});

$('resetPushNotifBtn')?.addEventListener('click', () => {
  $('pushTitle').value = '';
  $('pushBody').value = '';
  $('pushImage').value = '';
  $('pushTargetType').value = 'all';
  $('pushUserIds').value = '';
  $('pushDataJson').value = '';
  $('pushSpecificUsersFields').classList.add('hidden');
  showStatus($('pushNotifFormStatus'), 'Form reset', 'info');
});

$('pushTargetType').addEventListener('change', (e) => {
  const isSpecific = e.target.value === 'specific';
  $('pushSpecificUsersFields').classList.toggle('hidden', !isSpecific);
});

$('pushNotifForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = $('sendPushNotifBtn');
  const origText = btn.textContent;
  
  try {
    btn.disabled = true;
    btn.textContent = 'Sending...';
    showStatus($('pushNotifFormStatus'), 'Sending push notification...', 'info');
    
    const title = $('pushTitle').value.trim();
    const body = $('pushBody').value.trim();
    const imageUrl = $('pushImage').value.trim() || undefined;
    const targetType = $('pushTargetType').value;
    
    let data = {};
    const customDataStr = $('pushDataJson').value.trim();
    if (customDataStr) {
      try {
        data = JSON.parse(customDataStr);
      } catch (err) {
        throw new Error('Invalid JSON in custom data field');
      }
    }
    
    let targetUserIds = [];
    if (targetType === 'specific') {
      const idsStr = $('pushUserIds').value.trim();
      if (!idsStr) {
        throw new Error('Please enter at least one user ID');
      }
      targetUserIds = idsStr.split(',').map(id => id.trim()).filter(Boolean);
    }
    
    const payload = {
      title,
      body,
      imageUrl,
      targetType,
      data,
    };
    
    if (targetUserIds.length > 0) {
      payload.targetUserIds = targetUserIds;
    }
    
    const result = await api('/api/admin/push-notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    showStatus($('pushNotifFormStatus'), 
      `Push notification sent successfully! Delivered to ${result.data?.successCount || 0} devices.`, 
      'ok'
    );
    
    setTimeout(() => {
      $('pushNotifFormSection').classList.add('hidden');
      loadPushNotificationStats();
      loadPushNotificationHistory();
    }, 2000);
    
  } catch (err) {
    showStatus($('pushNotifFormStatus'), 'Failed to send: ' + err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
});

$('triggerDailyNotifBtn').addEventListener('click', async () => {
  const btn = $('triggerDailyNotifBtn');
  const origText = btn.textContent;
  
  if (!confirm('This will send daily engagement notifications to all eligible users right now. Continue?')) {
    return;
  }
  
  try {
    btn.disabled = true;
    btn.textContent = 'Sending...';
    showStatus($('pushNotifStatus'), 'Triggering daily notifications...', 'info');
    
    const result = await api('/api/admin/push-notifications/trigger-daily', {
      method: 'POST',
    });
    
    const stats = result.data || {};
    showStatus($('pushNotifStatus'), 
      `Daily notifications sent! ${stats.totalSent || 0} sent, ${stats.skipped || 0} skipped`, 
      'ok'
    );
    
    setTimeout(() => {
      loadPushNotificationStats();
      loadPushNotificationHistory();
    }, 1000);
    
  } catch (err) {
    showStatus($('pushNotifStatus'), 'Failed to trigger: ' + err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
});

$('viewDailyMessagesBtn').addEventListener('click', async () => {
  try {
    showStatus($('pushNotifStatus'), 'Loading daily message pool...', 'info');
    
    const data = await api('/api/admin/push-notifications/daily-config');
    const config = data.data || {};
    const messages = config.messagePool || [];
    
    $('dailyNotifSchedule').textContent = config.schedule || '10:00 AM IST';
    
    $('dailyMessagesContainer').innerHTML = messages.map((msg, idx) => `
      <div style="padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #dfe6e9; border-radius: 6px; background: #f8f9fa">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem">
          <strong style="font-size: 0.9rem">${msg.title}</strong>
          <span style="font-size: 0.75rem; color: #636e72; background: #e0e0e0; padding: 2px 6px; border-radius: 3px">${idx + 1}/${messages.length}</span>
        </div>
        <p style="margin: 0; color: #2d3436; font-size: 0.85rem">${msg.body}</p>
      </div>
    `).join('');
    
    $('dailyMessagesModal').classList.remove('hidden');
    $('dailyMessagesModal').scrollIntoView({ behavior: 'smooth' });
    showStatus($('pushNotifStatus'), '', 'info');
    $('pushNotifStatus').classList.add('hidden');
    
  } catch (err) {
    showStatus($('pushNotifStatus'), 'Failed to load messages: ' + err.message, 'err');
  }
});

$('closeDailyMessagesBtn').addEventListener('click', () => {
  $('dailyMessagesModal').classList.add('hidden');
});

// ============================================
// IN-APP NOTIFICATIONS
// ============================================

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
        <td>${sub.planName || 'Pro'}${sub.category && sub.category !== 'all' ? ` · ${sub.category}` : ''}${sub.couponCode ? `<br><small class="coupon-code">${sub.couponCode}</small>` : ''}</td>
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

// ============================================================================
// Category subscription plans
// ============================================================================

async function loadSubscriptionPlans() {
  const grid = $('plansGrid');
  if (!grid) return;
  try {
    const data = await api('/api/admin/subscription-plans');
    renderSubscriptionPlans(data.plans || []);
  } catch (err) {
    showStatus($('plansStatus'), 'Failed to load plans: ' + err.message, 'err');
    grid.innerHTML = '<p class="hint">Could not load subscription plans.</p>';
  }
}

function renderSubscriptionPlans(plans) {
  const grid = $('plansGrid');
  if (!plans.length) {
    grid.innerHTML = '<p class="hint">No plans found.</p>';
    return;
  }

  const order = ['beginner', 'intermediate', 'advanced'];
  const sorted = [...plans].sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category)
  );

  grid.innerHTML = sorted
    .map((plan) => {
      const on = Boolean(plan.enabled);
      return `
        <article class="plan-card" data-category="${plan.category}">
          <div class="plan-card-head">
            <div>
              <h3>${plan.title || plan.category}</h3>
              <span class="plan-badge ${on && Number(plan.price) > 0 ? 'on' : 'off'}">${on && Number(plan.price) > 0 ? 'Paid in app' : 'Free in app'}</span>
            </div>
            <label class="toggle-switch" title="Enable or disable paid subscription">
              <input type="checkbox" data-plan-toggle="${plan.category}" ${on ? 'checked' : ''} />
              <span></span>
            </label>
          </div>
          <div class="upload-field">
            <label>Price (₹)</label>
            <input type="number" min="0" step="1" data-plan-price="${plan.category}" value="${plan.price ?? 0}" />
          </div>
          <div class="upload-field">
            <label>Duration (days)</label>
            <input type="number" min="1" step="1" data-plan-days="${plan.category}" value="${plan.durationDays ?? 30}" />
          </div>
          <button type="button" class="secondary" data-plan-save="${plan.category}">Save price</button>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-plan-toggle]').forEach((el) => {
    el.addEventListener('change', () => {
      void updateSubscriptionPlan(el.getAttribute('data-plan-toggle'), { enabled: el.checked });
    });
  });
  grid.querySelectorAll('[data-plan-save]').forEach((el) => {
    el.addEventListener('click', () => {
      const category = el.getAttribute('data-plan-save');
      const price = Number(grid.querySelector(`[data-plan-price="${category}"]`)?.value);
      const durationDays = Number(grid.querySelector(`[data-plan-days="${category}"]`)?.value);
      void updateSubscriptionPlan(category, { price, durationDays });
    });
  });
}

async function updateSubscriptionPlan(category, body) {
  try {
    showStatus($('plansStatus'), 'Saving…', 'info');
    await api(`/api/admin/subscription-plans/${category}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    showStatus($('plansStatus'), 'Plan updated — app reflects this immediately', 'ok');
    await loadSubscriptionPlans();
  } catch (err) {
    showStatus($('plansStatus'), err.message, 'err');
    await loadSubscriptionPlans();
  }
}

// ============================================================================
// Coupons
// ============================================================================

function resetCouponForm() {
  $('couponEditId').value = '';
  $('couponDiscountType').value = 'percent';
  $('couponDiscountValue').value = '';
  $('couponMinPurchase').value = '';
  $('couponExpiresAt').value = '';
  $('couponMaxUses').value = '';
  $('couponDescription').value = '';
  $('couponActive').checked = true;
  $('saveCouponBtn').textContent = 'Generate coupon';
  $('cancelCouponEditBtn').classList.add('hidden');
}

async function loadCoupons() {
  try {
    const data = await api('/api/admin/coupons');
    renderCoupons(data.coupons || []);
  } catch (err) {
    showStatus($('couponsStatus'), 'Failed to load coupons: ' + err.message, 'err');
    $('couponsTableBody').innerHTML = '<tr><td colspan="7">Error loading coupons</td></tr>';
  }
}

function renderCoupons(coupons) {
  const tbody = $('couponsTableBody');
  if (!coupons.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #636e72">No coupons yet. Generate one above.</td></tr>';
    return;
  }

  tbody.innerHTML = coupons
    .map((c) => {
      const expired = c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now();
      const status = !c.active ? 'Disabled' : expired ? 'Expired' : 'Active';
      const statusColor = status === 'Active' ? '#00b894' : status === 'Expired' ? '#fdcb6e' : '#636e72';
      const discount =
        c.discountType === 'percent' ? `${c.discountValue}%` : `₹${c.discountValue}`;
      const uses = c.maxUses ? `${c.usedCount || 0} / ${c.maxUses}` : `${c.usedCount || 0}`;
      return `
        <tr>
          <td><span class="coupon-code">${c.code}</span></td>
          <td>${discount}</td>
          <td>
            <span style="display: inline-block; padding: 0.25rem 0.6rem; background: ${statusColor}; color: white; border-radius: 4px; font-size: 0.8rem">
              ${status}
            </span>
          </td>
          <td>${uses}</td>
          <td>${c.expiresAt ? formatDate(c.expiresAt) : '—'}</td>
          <td>${c.minPurchase ? '₹' + c.minPurchase : '—'}</td>
          <td>
            <button type="button" class="secondary" data-coupon-toggle="${c._id}" data-active="${c.active ? '1' : '0'}">
              ${c.active ? 'Disable' : 'Enable'}
            </button>
            <button type="button" class="secondary" data-coupon-edit="${c._id}">Edit</button>
            <button type="button" data-coupon-delete="${c._id}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-coupon-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-coupon-toggle');
      const active = el.getAttribute('data-active') !== '1';
      void updateCoupon(id, { active });
    });
  });
  tbody.querySelectorAll('[data-coupon-edit]').forEach((el) => {
    el.addEventListener('click', () => startCouponEdit(el.getAttribute('data-coupon-edit'), coupons));
  });
  tbody.querySelectorAll('[data-coupon-delete]').forEach((el) => {
    el.addEventListener('click', () => {
      if (confirm('Delete this coupon? Users will no longer be able to use it.')) {
        void deleteCoupon(el.getAttribute('data-coupon-delete'));
      }
    });
  });
}

function startCouponEdit(id, coupons) {
  const coupon = coupons.find((c) => String(c._id) === String(id));
  if (!coupon) return;
  $('couponEditId').value = coupon._id;
  $('couponDiscountType').value = coupon.discountType;
  $('couponDiscountValue').value = coupon.discountValue;
  $('couponMinPurchase').value = coupon.minPurchase || '';
  $('couponExpiresAt').value = coupon.expiresAt ? String(coupon.expiresAt).slice(0, 10) : '';
  $('couponMaxUses').value = coupon.maxUses || '';
  $('couponDescription').value = coupon.description || '';
  $('couponActive').checked = Boolean(coupon.active);
  $('saveCouponBtn').textContent = 'Save coupon';
  $('cancelCouponEditBtn').classList.remove('hidden');
  $('couponForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCoupon(event) {
  event.preventDefault();
  const editId = $('couponEditId').value;
  const payload = {
    discountType: $('couponDiscountType').value,
    discountValue: Number($('couponDiscountValue').value),
    minPurchase: $('couponMinPurchase').value ? Number($('couponMinPurchase').value) : 0,
    expiresAt: $('couponExpiresAt').value || null,
    maxUses: $('couponMaxUses').value ? Number($('couponMaxUses').value) : null,
    description: $('couponDescription').value.trim(),
    active: $('couponActive').checked,
  };

  try {
    showStatus($('couponsStatus'), editId ? 'Saving coupon…' : 'Generating coupon…', 'info');
    const data = await api(editId ? `/api/admin/coupons/${editId}` : '/api/admin/coupons', {
      method: editId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const code = data.code || data.coupon?.code;
    showStatus(
      $('couponsStatus'),
      editId ? 'Coupon updated' : `Coupon created: ${code}`,
      'ok'
    );
    resetCouponForm();
    await loadCoupons();
  } catch (err) {
    showStatus($('couponsStatus'), err.message, 'err');
  }
}

async function updateCoupon(id, body) {
  try {
    await api(`/api/admin/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    showStatus($('couponsStatus'), 'Coupon updated', 'ok');
    await loadCoupons();
  } catch (err) {
    showStatus($('couponsStatus'), err.message, 'err');
  }
}

async function deleteCoupon(id) {
  try {
    await api(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    showStatus($('couponsStatus'), 'Coupon deleted', 'ok');
    await loadCoupons();
  } catch (err) {
    showStatus($('couponsStatus'), err.message, 'err');
  }
}

$('couponForm')?.addEventListener('submit', saveCoupon);
$('cancelCouponEditBtn')?.addEventListener('click', () => {
  resetCouponForm();
  showStatus($('couponsStatus'), 'Edit cancelled', 'info');
});

// ============================================================================
// HOME PAGE HERO
// ============================================================================

let heroDraftFile = null;
let heroDraftObjectUrl = null;
let heroHasLiveImage = false;

function revokeHeroDraftUrl() {
  if (heroDraftObjectUrl) {
    URL.revokeObjectURL(heroDraftObjectUrl);
    heroDraftObjectUrl = null;
  }
}

function setHeroFrame(imageEl, emptyEl, src) {
  if (src) {
    imageEl.src = src;
    imageEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
  } else {
    imageEl.removeAttribute('src');
    imageEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
  }
}

function clearHeroDraft() {
  revokeHeroDraftUrl();
  heroDraftFile = null;
  const input = $('heroFileInput');
  if (input) input.value = '';
  setHeroFrame($('heroDraftImage'), $('heroDraftEmpty'), null);
  $('saveHeroBtn').disabled = true;
  $('clearHeroDraftBtn').disabled = true;
}

async function loadHomeHero(silent = false) {
  try {
    const data = await api('/api/admin/home-hero');
    heroHasLiveImage = Boolean(data?.imageUrl);
    const cacheBust = data?.updatedAt ? `?t=${new Date(data.updatedAt).getTime()}` : '';
    setHeroFrame(
      $('heroLiveImage'),
      $('heroLiveEmpty'),
      data?.imageUrl ? `${data.imageUrl}${cacheBust}` : null
    );
    $('deleteHeroBtn').disabled = !heroHasLiveImage;
    $('heroLiveMeta').textContent = heroHasLiveImage
      ? `Last saved ${formatDate(data.updatedAt)} · this is what the Home screen shows`
      : '';
    if (!silent) {
      showStatus($('heroStatus'), heroHasLiveImage ? 'Current hero loaded' : 'No custom hero saved yet', 'info');
    }
  } catch (err) {
    showStatus($('heroStatus'), err.message, 'err');
  }
}

function onHeroFileChosen(file) {
  if (!file) {
    clearHeroDraft();
    return;
  }
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    showStatus($('heroStatus'), 'Use a JPG, PNG, WebP, or GIF image', 'err');
    clearHeroDraft();
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showStatus($('heroStatus'), 'Image is too large. Use a file under 8 MB.', 'err');
    clearHeroDraft();
    return;
  }
  revokeHeroDraftUrl();
  heroDraftFile = file;
  heroDraftObjectUrl = URL.createObjectURL(file);
  setHeroFrame($('heroDraftImage'), $('heroDraftEmpty'), heroDraftObjectUrl);
  $('saveHeroBtn').disabled = false;
  $('clearHeroDraftBtn').disabled = false;
  showStatus($('heroStatus'), 'Preview ready — save to put this on the Home page', 'info');
}

async function saveHomeHero() {
  if (!heroDraftFile) {
    showStatus($('heroStatus'), 'Choose an image first', 'err');
    return;
  }
  if ($('saveHeroBtn').disabled) return;
  $('saveHeroBtn').disabled = true;
  $('clearHeroDraftBtn').disabled = true;
  $('heroFileInput').disabled = true;
  showStatus($('heroStatus'), 'Saving hero image…', 'info');
  try {
    const fd = new FormData();
    fd.append('image', heroDraftFile, heroDraftFile.name || 'hero.jpg');
    await uploadWithProgress('/api/admin/home-hero', fd);
    clearHeroDraft();
    await loadHomeHero(true);
    showStatus($('heroStatus'), 'Saved — the Home page now shows this image', 'ok');
  } catch (err) {
    $('saveHeroBtn').disabled = false;
    $('clearHeroDraftBtn').disabled = false;
    showStatus($('heroStatus'), err.message, 'err');
  } finally {
    $('heroFileInput').disabled = false;
  }
}

async function deleteHomeHero() {
  if (!heroHasLiveImage) return;
  if (!confirm('Remove the current hero image? The app will go back to the default Home banners.')) {
    return;
  }
  $('deleteHeroBtn').disabled = true;
  try {
    await api('/api/admin/home-hero', { method: 'DELETE' });
    await loadHomeHero(true);
    showStatus($('heroStatus'), 'Hero image removed', 'ok');
  } catch (err) {
    $('deleteHeroBtn').disabled = false;
    showStatus($('heroStatus'), err.message, 'err');
  }
}

$('heroFileInput')?.addEventListener('change', (e) => {
  onHeroFileChosen(e.target.files && e.target.files[0]);
});
$('saveHeroBtn')?.addEventListener('click', () => void saveHomeHero());
$('clearHeroDraftBtn')?.addEventListener('click', () => {
  clearHeroDraft();
  showStatus($('heroStatus'), 'Preview cleared', 'info');
});
$('deleteHeroBtn')?.addEventListener('click', () => void deleteHomeHero());

tryRestoreSession();
