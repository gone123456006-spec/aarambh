const API = window.location.origin.replace(/\/$/, '');
let token = sessionStorage.getItem('adminToken') || '';

const $ = (id) => document.getElementById(id);

function showStatus(el, msg, type = 'info') {
  el.textContent = msg;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
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

  if (!res.ok) {
    const msg = json.message || json.data?.message || res.statusText;
    throw new Error(msg || 'Request failed');
  }
  return json.data !== undefined ? json.data : json;
}

function setLoggedIn(user) {
  token = sessionStorage.getItem('adminToken');
  $('loginCard').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('userBadge').textContent = user?.email || 'Admin';
  if (user?.role !== 'admin') {
    showStatus(
      $('globalStatus'),
      'Warning: this account is not admin. In MongoDB set role: "admin" for your user.',
      'err'
    );
  }
  loadCourses();
}

async function sendOtp() {
  const email = $('email').value.trim().toLowerCase();
  if (!email.endsWith('@gmail.com')) {
    showStatus($('loginStatus'), 'Use a Gmail address (@gmail.com)', 'err');
    return;
  }
  $('sendOtpBtn').disabled = true;
  try {
    await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    showStatus($('loginStatus'), `OTP sent to ${email}`, 'ok');
    $('otpRow').classList.remove('hidden');
  } catch (e) {
    showStatus($('loginStatus'), e.message, 'err');
  } finally {
    $('sendOtpBtn').disabled = false;
  }
}

async function verifyOtp() {
  const email = $('email').value.trim().toLowerCase();
  const code = $('otp').value.trim();
  $('verifyOtpBtn').disabled = true;
  try {
    const data = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    token = data.accessToken;
    sessionStorage.setItem('adminToken', token);
    setLoggedIn(data.user);
    showStatus($('loginStatus'), 'Logged in', 'ok');
  } catch (e) {
    showStatus($('loginStatus'), e.message, 'err');
  } finally {
    $('verifyOtpBtn').disabled = false;
  }
}

function logout() {
  sessionStorage.removeItem('adminToken');
  token = '';
  location.reload();
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
  } catch (e) {
    showStatus($('lessonStatus'), `Could not load courses: ${e.message}`, 'err');
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

    previewEl.innerHTML = `<strong>URL:</strong> ${url}<br><strong>Available at:</strong> ${availableAt}<br><em>Users see this in the app after ~30 seconds.</em>`;
    showStatus(
      statusEl,
      `Uploaded! Available in app in ${data.availableInSeconds || 30} seconds.`,
      'ok'
    );
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
    showStatus($('lessonStatus'), 'Title and duration are required', 'err');
    return;
  }

  $('addLessonBtn').disabled = true;
  try {
    await api(`/api/admin/courses/${courseId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    showStatus($('lessonStatus'), 'Lesson added to course — users will see it in the app.', 'ok');
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

$('sendOtpBtn').addEventListener('click', sendOtp);
$('verifyOtpBtn').addEventListener('click', verifyOtp);
$('logoutBtn').addEventListener('click', logout);
$('uploadVideoBtn').addEventListener('click', () => uploadFile('video'));
$('uploadPdfBtn').addEventListener('click', () => uploadFile('pdf'));
$('addLessonBtn').addEventListener('click', addLesson);
$('createCourseBtn').addEventListener('click', createCourse);

tryRestoreSession();
