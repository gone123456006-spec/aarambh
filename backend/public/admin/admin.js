const API = window.location.origin.replace(/\/$/, '');
const AUTO_REFRESH_MS = 60 * 1000; // 1 minute

/** Matches frontend constants/courseData.ts lesson ids */
const CURRICULUM = {
  beginner: [
    { lessonKey: 'b1', title: 'Introduction to English', duration: '8:45', pdfTitle: 'Lesson 1 — Introduction Notes' },
    { lessonKey: 'b2', title: 'Basic Grammar Rules', duration: '12:20', pdfTitle: 'Lesson 2 — Grammar Basics PDF' },
    { lessonKey: 'b3', title: 'Common Greetings', duration: '10:15', pdfTitle: 'Lesson 3 — Greetings Worksheet' },
    { lessonKey: 'b4', title: 'Numbers & Counting', duration: '15:30', pdfTitle: 'Lesson 4 — Numbers Practice PDF' },
    { lessonKey: 'b5', title: 'Daily Objects', duration: '9:50', pdfTitle: 'Lesson 5 — Daily Objects PDF' },
  ],
  intermediate: [
    { lessonKey: 'i1', title: 'Sentence Structures', duration: '20:10', pdfTitle: 'Lesson 1 — Sentence Structures PDF' },
    { lessonKey: 'i2', title: 'Verbs & Tenses', duration: '18:45', pdfTitle: 'Lesson 2 — Verbs & Tenses PDF' },
    { lessonKey: 'i3', title: 'Travel Vocabulary', duration: '22:30', pdfTitle: 'Lesson 3 — Travel English PDF' },
    { lessonKey: 'i4', title: 'Expressing Opinions', duration: '19:15', pdfTitle: 'Lesson 4 — Opinions & Debate PDF' },
    { lessonKey: 'i5', title: 'Listening Practice', duration: '25:00', pdfTitle: 'Lesson 5 — Listening Workbook' },
  ],
  advanced: [
    { lessonKey: 'a1', title: 'Business English Basics', duration: '30:00', pdfTitle: 'Lesson 1 — Business English PDF' },
    { lessonKey: 'a2', title: 'Public Speaking Tips', duration: '28:45', pdfTitle: 'Lesson 2 — Public Speaking PDF' },
    { lessonKey: 'a3', title: 'Idioms & Phrasal Verbs', duration: '32:15', pdfTitle: 'Lesson 3 — Idioms Guide PDF' },
    { lessonKey: 'a4', title: 'Academic Writing', duration: '35:20', pdfTitle: 'Lesson 4 — Academic Writing PDF' },
    { lessonKey: 'a5', title: 'Advanced Pronunciation', duration: '25:45', pdfTitle: 'Lesson 5 — Pronunciation PDF' },
    { lessonKey: 'a6', title: 'Debating Techniques', duration: '29:30', pdfTitle: 'Lesson 6 — Debating PDF' },
    { lessonKey: 'a7', title: 'Understanding Accents', duration: '31:10', pdfTitle: 'Lesson 7 — Accents PDF' },
    { lessonKey: 'a8', title: 'Creative Storytelling', duration: '27:50', pdfTitle: 'Lesson 8 — Storytelling PDF' },
    { lessonKey: 'a9', title: 'Professional Interviews', duration: '33:40', pdfTitle: 'Lesson 9 — Interview Prep PDF' },
    { lessonKey: 'a10', title: 'Final Graduation Project', duration: '45:00', pdfTitle: 'Lesson 10 — Graduation Project PDF' },
  ],
};

let token = sessionStorage.getItem('adminToken') || '';
let usersPage = 1;
let usersPagination = { pages: 1 };
let autoRefreshTimer = null;
let cachedCourses = [];

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
    loadCourses().then(() => {
      loadCourseList();
      loadExistingLessons();
      populateLessonSlots();
    });
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
  if (hint) hint.textContent = 'Uploads go live in app in ~2 seconds';
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
    loadCourses().then(() => {
      loadCourseList();
      loadExistingLessons();
      populateLessonSlots();
    });
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
    showStatus($('createCourseStatus'), `Course "${title}" created — select it above to upload`, 'ok');
    $('newCourseTitle').value = '';
    await loadCourses();
    loadCourseList();
    const created = cachedCourses.find((c) => c.level === level);
    if (created && $('uploadCourseId')) {
      $('uploadCourseId').value = created._id;
      populateLessonSlots();
    }
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
    fillCourseSelects(cachedCourses);
    return cachedCourses;
  } catch {
    cachedCourses = [];
    return [];
  }
}

function fillCourseSelects(courses) {
  const selects = [$('courseId'), $('uploadCourseId')];
  const noCourseHint = $('noCourseHint');

  if (noCourseHint) {
    noCourseHint.classList.toggle('hidden', courses.length > 0);
  }

  selects.forEach((select) => {
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '<option value="">Select course…</option>';
    courses.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c._id;
      opt.textContent = `${c.title} (${c.level}) — ${c.lessons?.length || 0} lessons`;
      opt.dataset.level = c.level;
      select.appendChild(opt);
    });
    if (prev && courses.some((c) => String(c._id) === String(prev))) {
      select.value = prev;
    } else if (select.id === 'uploadCourseId' && courses.length === 1) {
      select.value = courses[0]._id;
      populateLessonSlots();
    }
  });
}

function showAppLiveBanner(lessonTitle, seconds) {
  const banner = $('appLiveBanner');
  if (!banner) return;
  banner.classList.remove('hidden');

  let left = seconds;
  const tick = () => {
    if (left > 0) {
      banner.textContent = `✓ "${lessonTitle}" publishing… live in app in ${left}s (pull down My Courses to refresh)`;
      left -= 1;
      setTimeout(tick, 1000);
    } else {
      banner.textContent = `✓ "${lessonTitle}" is now live in the app! Open My Courses and pull down to refresh.`;
    }
  };
  tick();
}

async function loadCourseList() {
  const container = $('courseList');
  if (!container) return;

  try {
    const courses = cachedCourses.length ? cachedCourses : await loadCourses();

    if (!courses.length) {
      container.innerHTML =
        '<p style="color:#636e72; margin:0">No courses yet. Create one below.</p>';
      return;
    }

    container.innerHTML = courses
      .map(
        (c) => `
        <div class="course-row">
          <div class="course-row-meta">
            <strong>${c.title}</strong>
            <span>${c.level} · ${c.lessons?.length || 0} lesson(s) · ${c.views || 0} views</span>
          </div>
          <button type="button" class="danger" data-delete-course="${c._id}" data-course-title="${c.title}">
            Delete course
          </button>
        </div>`
      )
      .join('');

    container.querySelectorAll('[data-delete-course]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteCourse;
        const title = btn.dataset.courseTitle || 'this course';
        if (!confirm(`Delete "${title}" and all its videos/PDFs? This cannot be undone.`)) return;

        btn.disabled = true;
        try {
          await api(`/api/admin/courses/${id}`, { method: 'DELETE' });
          showStatus($('publishStatus'), 'Course deleted', 'ok');
          await loadCourses();
          loadCourseList();
          loadExistingLessons();
          populateLessonSlots();
        } catch (e) {
          showStatus($('publishStatus'), e.message, 'err');
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<p class="status err">${e.message}</p>`;
  }
}

function populateLessonSlots() {
  const courseSelect = $('uploadCourseId');
  const slotSelect = $('lessonSlot');
  if (!courseSelect || !slotSelect) return;

  const selected = courseSelect.selectedOptions[0];
  const level = selected?.dataset?.level;
  slotSelect.innerHTML = '';

  if (!level || !CURRICULUM[level]) {
    slotSelect.innerHTML = '<option value="">Select course first…</option>';
    return;
  }

  slotSelect.innerHTML = '<option value="">Select lesson…</option>';
  CURRICULUM[level].forEach((slot, i) => {
    const opt = document.createElement('option');
    opt.value = slot.lessonKey;
    opt.textContent = `Lesson ${i + 1}: ${slot.title} (${slot.lessonKey})`;
    slotSelect.appendChild(opt);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setupDropZone(zoneId, inputId, nameId) {
  const zone = $(zoneId);
  const input = $(inputId);
  const nameEl = $(nameId);
  if (!zone || !input) return;

  const showFile = (file) => {
    if (!file) return;
    nameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;
    nameEl.classList.remove('hidden');
  };

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
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

function setUploadProgress(pct, text) {
  const wrap = $('uploadProgressWrap');
  const fill = $('uploadProgressFill');
  const label = $('uploadProgressText');
  if (!wrap || !fill) return;
  wrap.classList.remove('hidden');
  fill.style.width = `${Math.round(pct * 100)}%`;
  if (label) label.textContent = text || `Uploading… ${Math.round(pct * 100)}%`;
}

function hideUploadProgress() {
  $('uploadProgressWrap')?.classList.add('hidden');
  const fill = $('uploadProgressFill');
  if (fill) fill.style.width = '0%';
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

async function publishLesson() {
  const courseId = $('uploadCourseId')?.value;
  const lessonKey = $('lessonSlot')?.value;
  const videoInput = $('videoFile');
  const pdfInput = $('pdfFile');
  const statusEl = $('publishStatus');
  const previewEl = $('videoPreview');
  const btn = $('publishLessonBtn');

  if (!courseId) {
    showStatus(statusEl, 'Select a course', 'err');
    return;
  }
  if (!lessonKey) {
    showStatus(statusEl, 'Select a lesson slot', 'err');
    return;
  }
  if (!videoInput?.files?.[0] && !pdfInput?.files?.[0]) {
    showStatus(statusEl, 'Choose a video or PDF file', 'err');
    return;
  }

  const course = cachedCourses.find((c) => String(c._id) === String(courseId));
  const slotMeta = CURRICULUM[course?.level]?.find((s) => s.lessonKey === lessonKey);
  if (!slotMeta) {
    showStatus(statusEl, 'Invalid lesson slot', 'err');
    return;
  }

  btn.disabled = true;
  hideUploadProgress();
  previewEl?.classList.add('hidden');

  try {
    let videoUrl;
    let videoAvailableAt;
    let pdfUrl;
    let pdfAvailableAt;

    if (videoInput.files?.[0]) {
      const fd = new FormData();
      fd.append('video', videoInput.files[0]);
      setUploadProgress(0, 'Uploading video…');
      const data = await uploadWithProgress('/api/admin/upload/video', fd, (p) =>
        setUploadProgress(p * 0.7, `Uploading video… ${Math.round(p * 100)}%`)
      );
      videoUrl = data.url || data.videoUrl;
      videoAvailableAt = data.videoAvailableAt || data.availableAt;
    }

    if (pdfInput.files?.[0]) {
      const fd = new FormData();
      fd.append('pdf', pdfInput.files[0]);
      setUploadProgress(0.7, 'Uploading PDF…');
      const data = await uploadWithProgress('/api/admin/upload/pdf', fd, (p) =>
        setUploadProgress(0.7 + p * 0.2, `Uploading PDF… ${Math.round(p * 100)}%`)
      );
      pdfUrl = data.url || data.pdfUrl;
      pdfAvailableAt = data.pdfAvailableAt || data.availableAt;
    }

    setUploadProgress(0.92, 'Publishing to app…');
    await api(`/api/admin/courses/${courseId}/lessons/upsert`, {
      method: 'POST',
      body: JSON.stringify({
        lessonKey,
        title: slotMeta.title,
        duration: slotMeta.duration,
        pdfTitle: slotMeta.pdfTitle,
        type: 'video',
        videoUrl,
        pdfUrl,
        videoAvailableAt,
        pdfAvailableAt,
      }),
    });

    setUploadProgress(1, 'Done!');
    showAppLiveBanner(slotMeta.title, 2);
    showStatus(
      statusEl,
      `Published "${slotMeta.title}". Check My Courses in the app within 2 seconds.`,
      'ok'
    );

    if (previewEl && videoUrl) {
      previewEl.classList.remove('hidden');
      previewEl.innerHTML = `
        <strong>Video preview</strong><br>
        <video src="${videoUrl}" controls style="max-width:100%;margin-top:0.5rem;border-radius:8px"></video>
        <p style="margin:0.35rem 0 0;color:#636e72">Slot: ${lessonKey} · ${slotMeta.title}</p>`;
    }

    videoInput.value = '';
    pdfInput.value = '';
    $('videoFileName')?.classList.add('hidden');
    $('pdfFileName')?.classList.add('hidden');

    await loadCourses();
    loadCourseList();
    loadExistingLessons();

    if ($('courseId')?.value === courseId) loadExistingLessons();
    else if ($('courseId')) {
      $('courseId').value = courseId;
      loadExistingLessons();
    }
  } catch (e) {
    showStatus(statusEl, e.message, 'err');
  } finally {
    btn.disabled = false;
    setTimeout(hideUploadProgress, 1500);
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
    const courses = cachedCourses.length ? cachedCourses : await loadCourses();
    const course = (courses || []).find((c) => String(c._id) === String(courseId));
    const lessons = course?.lessons || [];

    if (!lessons.length) {
      container.innerHTML = '<p style="color:#636e72; margin:0">No lessons yet. Use Upload above.</p>';
      return;
    }

    container.innerHTML = lessons
      .map((lesson) => {
        const videoStatus = lesson.videoUrl
          ? '<span class="badge ok">Video ✓</span>'
          : lesson.videoAvailableAt
            ? '<span class="badge warn">Video pending</span>'
            : '<span class="badge">No video</span>';

        const pdfStatus = lesson.pdfUrl
          ? '<span class="badge ok">PDF ✓</span>'
          : lesson.pdfAvailableAt
            ? '<span class="badge warn">PDF pending</span>'
            : '<span class="badge">No PDF</span>';

        const canDeleteVideo = !!lesson.videoUrl || !!lesson.videoAvailableAt;
        const canDeletePdf = !!lesson.pdfUrl || !!lesson.pdfAvailableAt;
        const keyLabel = lesson.lessonKey ? ` · ${lesson.lessonKey}` : '';

        return `
          <div class="lesson-row">
            <div class="lesson-title">
              <strong>${lesson.title || 'Untitled'}</strong>
              <span style="color:#636e72; font-size:0.82rem; margin-left:0.4rem">${lesson.duration || ''}${keyLabel}</span>
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

              <button type="button"
                class="danger"
                data-del-lesson-course="${courseId}"
                data-del-lesson-id="${lesson._id}"
              >
                Delete lesson
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('[data-del-kind]').forEach((btn) => {
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
          await loadCourses();
          loadCourseList();
          loadExistingLessons();
        } catch (e) {
          showStatus($('lessonStatus'), e.message, 'err');
        }
      });
    });

    container.querySelectorAll('[data-del-lesson-course]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const lessonId = btn.dataset.delLessonId;
        const cid = btn.dataset.delLessonCourse;
        if (!lessonId || !cid) return;

        if (!confirm('Delete this entire lesson from the app?')) return;

        try {
          await api(`/api/admin/courses/${cid}/lessons/${lessonId}`, { method: 'DELETE' });
          showStatus($('lessonStatus'), 'Lesson deleted', 'ok');
          await loadCourses();
          loadCourseList();
          loadExistingLessons();
        } catch (e) {
          showStatus($('lessonStatus'), e.message, 'err');
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<p class="status err">${e.message}</p>`;
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
$('publishLessonBtn')?.addEventListener('click', publishLesson);
$('uploadCourseId')?.addEventListener('change', populateLessonSlots);
$('createCourseBtn').addEventListener('click', createCourse);
$('courseId').addEventListener('change', () => loadExistingLessons());

setupDropZone('videoDropZone', 'videoFile', 'videoFileName');
setupDropZone('pdfDropZone', 'pdfFile', 'pdfFileName');

$('userSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadUsers(1);
});

tryRestoreSession();
