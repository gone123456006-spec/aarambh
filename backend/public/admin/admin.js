const API = window.location.origin.replace(/\/$/, '');
const AUTO_REFRESH_MS = 60 * 1000; // 1 minute

let token = sessionStorage.getItem('adminToken') || '';
let usersPage = 1;
let usersPagination = { pages: 1 };
let autoRefreshTimer = null;

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
    loadCourses().then(() => loadExistingLessons());
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
  loadStats();
  loadUsers();
  startAutoRefresh();
  const hint = $('autoRefreshHint');
  if (hint) hint.textContent = 'Auto-refresh every 1 minute';
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
    loadCourses().then(() => loadExistingLessons());
  }
  if (!silent) {
    const hint = $('autoRefreshHint');
    if (hint) hint.textContent = `Refreshed ${new Date().toLocaleTimeString()} · auto every 1 min`;
  }
}

async function createCourse() {
  const title = $('newCourseTitle').value.trim();
  const level = $('newCourseLevel').value;
  if (!title) {
    showStatus($('createCourseStatus'), 'Enter a course title', 'err');
    return;
  }
  $('createCourseBtn').disabled = true;
  try {
    await api('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title,
        subtitle: `${title} course`,
        level,
        color: ['#e60000', '#ff6b6b'],
        lessons: [],
      }),
    });
    showStatus($('createCourseStatus'), `Course "${title}" created`, 'ok');
    loadCourses();
  } catch (e) {
    showStatus($('createCourseStatus'), e.message, 'err');
  } finally {
    $('createCourseBtn').disabled = false;
  }
}

async function loadCourses() {
  try {
    const courses = await api('/api/courses');
    const select = $('courseId');
    select.innerHTML = '<option value="">Select course…</option>';
    (courses || []).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c._id;
      opt.textContent = `${c.title} (${c.level}) — ${c.lessons?.length || 0} lessons`;
      select.appendChild(opt);
    });
  } catch {
    /* optional on content tab */
  }
}

async function loadExistingLessons() {
  const courseId = $('courseId')?.value;
  const container = $('existingLessons');

  if (!container) return;

  if (!courseId) {
    container.innerHTML = '<p style="color:#636e72; margin:0">Select a course to see lessons.</p>';
    return;
  }

  container.innerHTML = '<p style="color:#636e72; margin:0">Loading…</p>';

  try {
    const courses = await api('/api/courses');
    const course = (courses || []).find((c) => String(c._id) === String(courseId));
    const lessons = course?.lessons || [];

    if (!lessons.length) {
      container.innerHTML = '<p style="color:#636e72; margin:0">No lessons found for this course.</p>';
      return;
    }

    container.innerHTML = lessons
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((lesson) => {
        const videoStatus = lesson.videoUrl
          ? '<span class="badge ok">Video ✓</span>'
          : lesson.videoAvailableIn
            ? `<span class="badge warn">Video in ~${lesson.videoAvailableIn}s</span>`
            : '<span class="badge">No video</span>';

        const pdfStatus = lesson.pdfUrl
          ? '<span class="badge ok">PDF ✓</span>'
          : lesson.pdfAvailableIn
            ? `<span class="badge warn">PDF in ~${lesson.pdfAvailableIn}s</span>`
            : '<span class="badge">No PDF</span>';

        const canDeleteVideo = !!lesson.videoUrl || !!lesson.videoAvailableIn;
        const canDeletePdf = !!lesson.pdfUrl || !!lesson.pdfAvailableIn;

        return `
          <div class="lesson-row">
            <div class="lesson-title">
              <strong>${lesson.title || 'Untitled'}</strong>
              <span style="color:#636e72; font-size:0.82rem; margin-left:0.4rem">${lesson.duration || ''}</span>
            </div>

            <div class="lesson-status">
              ${videoStatus} ${pdfStatus}
            </div>

            <div class="lesson-actions">
              <button type="button"
                class="danger"
                data-del-course-id="${courseId}"
                data-del-lesson-id="${lesson._id}"
                data-del-kind="video"
                ${canDeleteVideo ? '' : 'disabled'}
              >
                Delete video
              </button>

              <button type="button"
                class="danger"
                data-del-course-id="${courseId}"
                data-del-lesson-id="${lesson._id}"
                data-del-kind="pdf"
                ${canDeletePdf ? '' : 'disabled'}
              >
                Delete PDF
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('[data-del-lesson-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const lessonId = btn.dataset.delLessonId;
        const kind = btn.dataset.delKind;
        const cid = btn.dataset.delCourseId;
        if (!lessonId || !kind || !cid) return;

        const ok = confirm(`Delete ${kind} for this lesson?`);
        if (!ok) return;

        try {
          await api(
            `/api/admin/courses/${cid}/lessons/${lessonId}/media?kind=${encodeURIComponent(kind)}`,
            { method: 'DELETE' }
          );
          showStatus($('lessonStatus'), 'Deleted successfully', 'ok');
          loadExistingLessons();
          loadCourses();
        } catch (e) {
          showStatus($('lessonStatus'), e.message, 'err');
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<p class="status err">${e.message}</p>`;
  }
}

async function uploadFile(kind) {
  const input = kind === 'video' ? $('videoFile') : $('pdfFile');
  const statusEl = kind === 'video' ? $('videoStatus') : $('pdfStatus');
  const previewEl = kind === 'video' ? $('videoPreview') : $('pdfPreview');

  if (!input.files?.[0]) {
    showStatus(statusEl, 'Choose a file first', 'err');
    return;
  }

  const fd = new FormData();
  fd.append(kind, input.files[0]);
  const btn = kind === 'video' ? $('uploadVideoBtn') : $('uploadPdfBtn');
  btn.disabled = true;

  try {
    const data = await api(`/api/admin/upload/${kind}`, { method: 'POST', body: fd });
    const url = data.url || data.videoUrl || data.pdfUrl;
    const availableAt = data.videoAvailableAt || data.pdfAvailableAt || data.availableAt;

    if (kind === 'video') {
      $('lessonVideoUrl').value = url || '';
      $('lessonVideoAt').value = availableAt || '';
    } else {
      $('lessonPdfUrl').value = url || '';
      $('lessonPdfAt').value = availableAt || '';
    }

    previewEl.innerHTML = `<strong>URL:</strong> ${url}<br><em>Available in app in ~30s</em>`;
    showStatus(statusEl, 'Uploaded successfully', 'ok');
  } catch (e) {
    showStatus(statusEl, e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function addLesson() {
  const courseId = $('courseId').value;
  if (!courseId) {
    showStatus($('lessonStatus'), 'Select a course', 'err');
    return;
  }

  const body = {
    title: $('lessonTitle').value.trim(),
    duration: $('lessonDuration').value.trim(),
    description: $('lessonDesc').value.trim(),
    pdfTitle: $('lessonPdfTitle').value.trim(),
    type: 'video',
    videoUrl: $('lessonVideoUrl').value.trim() || undefined,
    pdfUrl: $('lessonPdfUrl').value.trim() || undefined,
    videoAvailableAt: $('lessonVideoAt').value || undefined,
    pdfAvailableAt: $('lessonPdfAt').value || undefined,
  };

  if (!body.title || !body.duration) {
    showStatus($('lessonStatus'), 'Title and duration required', 'err');
    return;
  }

  $('addLessonBtn').disabled = true;
  try {
    await api(`/api/admin/courses/${courseId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    showStatus($('lessonStatus'), 'Lesson saved', 'ok');
    loadCourses();
  } catch (e) {
    showStatus($('lessonStatus'), e.message, 'err');
  } finally {
    $('addLessonBtn').disabled = false;
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
$('uploadVideoBtn').addEventListener('click', () => uploadFile('video'));
$('uploadPdfBtn').addEventListener('click', () => uploadFile('pdf'));
$('addLessonBtn').addEventListener('click', addLesson);
$('createCourseBtn').addEventListener('click', createCourse);
$('courseId').addEventListener('change', () => loadExistingLessons());

$('userSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadUsers(1);
});

tryRestoreSession();
