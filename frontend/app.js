

const API_BASE = window.location.port === '5500' ? 'http://localhost:5000/api/v1' : '/api/v1';
const API = API_BASE;
let token = localStorage.getItem('dp_token');
let adminData = JSON.parse(localStorage.getItem('dp_admin') || '{}');
let currentPage = 'dashboard';

// Hierarchy state
let chaptersData = [];
let topicsData = {};
let questionsData = {};
let expandedChapters = new Set();
let expandedTopics = new Set();

// ============ API HELPER ============
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  return data;
}

// ============ TOAST ============
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ============ MODAL ============
function showModal(title, bodyHTML, onSave) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'modal-overlay';
  el.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modal-save-btn" onclick="modalSave()">Save</button>
      </div>
    </div>`;
  el.onclick = closeModal;
  document.body.appendChild(el);
  window._modalOnSave = onSave;
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

async function modalSave() {
  const btn = document.getElementById('modal-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try { await window._modalOnSave(); }
  catch(e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Save'; }
}

function showConfirm(msg, onConfirm) {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'modal-overlay';
  el.innerHTML = `
    <div class="modal" style="max-width:380px" onclick="event.stopPropagation()">
      <div class="modal-header"><div class="modal-title">Confirm</div></div>
      <div class="modal-body"><p style="font-size:14px;color:var(--text2)">${msg}</p></div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="window._confirmCb()">Delete</button>
      </div>
    </div>`;
  el.onclick = closeModal;
  document.body.appendChild(el);
  window._confirmCb = async () => { closeModal(); await onConfirm(); };
}

// ============ AUTH ============
let resendInterval = null;

async function handleSendOTP(isResend = false) {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return toast('Email address enter karein', 'error');

  const btn = document.getElementById('send-otp-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    const res = await api('POST', '/auth/send-otp', { email });
    if (!res.status) {
      toast(res.message || 'OTP send nahi hua', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
      return;
    }
    toast('OTP aapki email pe bheja gaya ✉️');
    document.getElementById('login-step-1').style.display = 'none';
    document.getElementById('login-step-2').style.display = 'block';
    document.getElementById('otp-sent-to').textContent = email;
    document.getElementById('login-otp').focus();
    startResendTimer();
  } catch(e) {
    toast('Network error: Backend chal raha hai?', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
  }
}

function startResendTimer() {
  const resendBtn = document.getElementById('resend-otp-btn');
  const timerEl = document.getElementById('resend-timer');
  let seconds = 60;
  resendBtn.disabled = true;
  if (resendInterval) clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    seconds--;
    if (timerEl) timerEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(resendInterval);
      resendBtn.disabled = false;
      resendBtn.textContent = 'Resend OTP';
    }
  }, 1000);
}

function backToEmail() {
  document.getElementById('login-step-1').style.display = 'block';
  document.getElementById('login-step-2').style.display = 'none';
  document.getElementById('login-otp').value = '';
  const btn = document.getElementById('send-otp-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
  if (resendInterval) clearInterval(resendInterval);
}

async function handleVerifyOTP() {
  const email = document.getElementById('login-email').value.trim();
  const otp = document.getElementById('login-otp').value.trim();
  if (!otp || otp.length < 6) return toast('6-digit OTP enter karein', 'error');

  const btn = document.getElementById('verify-otp-btn');
  btn.disabled = true; btn.textContent = 'Verifying...';

  const res = await api('POST', '/auth/verify-otp', { email, otp });
  if (!res.status) {
    toast(res.message || 'Invalid OTP', 'error');
    btn.disabled = false; btn.textContent = 'Verify & Login';
    return;
  }
  token = res.data.token;
  adminData = res.data.admin;
  localStorage.setItem('dp_token', token);
  localStorage.setItem('dp_admin', JSON.stringify(adminData));
  initDashboard();
}

// Old password login kept as fallback (not shown in UI)
async function handleLogin() {
  await handleVerifyOTP();
}

function handleLogout() {
  localStorage.removeItem('dp_token');
  localStorage.removeItem('dp_admin');
  token = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

function initDashboard() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const name = adminData.name || 'Admin';
  document.getElementById('admin-name').textContent = name;
  document.getElementById('admin-avatar').textContent = name[0].toUpperCase();
  updateTime();
  setInterval(updateTime, 1000);
  navigate('dashboard');
}

function updateTime() {
  const el = document.getElementById('topbar-time');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ============ NAVIGATION ============
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[onclick="navigate('${page}')"]`);
  if (activeNav) activeNav.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', boards: 'Boards', languages: 'Languages',
    classes: 'Classes', subjects: 'Subjects', chapters: 'Chapters & Topics',
    questions: 'Questions', users: 'Users', subscriptions: 'Subscriptions', purchases: 'Purchases'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  const pages = {
    dashboard: renderDashboard,
    boards: renderBoards,
    languages: renderLanguages,
    classes: renderClasses,
    subjects: renderSubjects,
    chapters: renderChaptersHierarchy,
    users: renderUsers,
    subscriptions: renderSubscriptions,
    purchases: renderPurchases,
  };
  if (pages[page]) pages[page]();
}

function setContent(html) {
  document.getElementById('content').innerHTML = html;
}

function loadingState() {
  setContent('<div class="loading-state"><div class="spinner"></div>Loading...</div>');
}

// ============ DASHBOARD ============
async function renderDashboard() {
  loadingState();
  const res = await api('GET', '/subscriptions/dashboard');
  if (!res.status) return setContent('<div class="empty-state"><div class="icon">⚠️</div><p>Failed to load dashboard</p></div>');
  const d = res.data;

  setContent(`
    <div class="stats-grid">
      <div class="stat-card">
        <div>
          <div class="stat-label">Total Users</div>
          <div class="stat-value" style="color:var(--accent2)">${d.totalUsers.toLocaleString()}</div>
          <div class="stat-change">↑ All registered users</div>
        </div>
        <div class="stat-icon">👥</div>
      </div>
      <div class="stat-card">
        <div>
          <div class="stat-label">Active Users</div>
          <div class="stat-value" style="color:var(--success)">${d.activeUsers.toLocaleString()}</div>
          <div class="stat-change" style="color:var(--success)">Currently active</div>
        </div>
        <div class="stat-icon">✅</div>
      </div>
      <div class="stat-card">
        <div>
          <div class="stat-label">Paid Users</div>
          <div class="stat-value" style="color:var(--warn)">${d.paidUsers.toLocaleString()}</div>
          <div class="stat-change" style="color:var(--warn)">Subscribed users</div>
        </div>
        <div class="stat-icon">💳</div>
      </div>
      <div class="stat-card">
        <div>
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value" style="color:var(--success)">₹${(d.revenue || 0).toLocaleString()}</div>
          <div class="stat-change" style="color:var(--success)">Total collected</div>
        </div>
        <div class="stat-icon">💰</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">
      <div class="stat-card">
        <div><div class="stat-label">Total Boards</div><div class="stat-value">${d.totalBoards}</div></div>
        <div class="stat-icon">🏫</div>
      </div>
      <div class="stat-card">
        <div><div class="stat-label">Total Subjects</div><div class="stat-value">${d.totalSubjects}</div></div>
        <div class="stat-icon">📖</div>
      </div>
      <div class="stat-card">
        <div><div class="stat-label">Total Questions</div><div class="stat-value">${d.totalQuestions}</div></div>
        <div class="stat-icon">❓</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Recent Purchases</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Subscription</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>
            ${d.recentPurchases.length ? d.recentPurchases.map(p => `
              <tr>
                <td>${p.userId?.name || '—'}</td>
                <td style="color:var(--text2)">${p.userId?.email || '—'}</td>
                <td><span class="badge badge-info">${p.subscriptionId?.name || '—'}</span></td>
                <td style="color:var(--success);font-family:var(--mono)">₹${p.amount}</td>
                <td style="color:var(--text3)">${formatDate(p.createdAt)}</td>
              </tr>`) .join('') : '<tr><td colspan="5"><div class="empty-state"><p>No purchases yet</p></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

// ============ BOARDS ============
let boardsData = [];
async function renderBoards() {
  loadingState();
  const [res, langRes] = await Promise.all([api('GET', '/boards'), api('GET', '/languages')]);
  boardsData = res.data || [];
  langsData = langRes.data || [];
  setContent(`
    <div class="card">
      <div class="card-header">
        <div class="card-title">Boards (${boardsData.length})</div>
        <button class="btn btn-primary btn-sm" onclick="openBoardModal()">+ Add Board</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Full Name</th><th>Languages</th><th>Default</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${boardsData.length ? boardsData.map(b => `
              <tr>
                <td><strong>${b.name}</strong></td>
                <td style="color:var(--text2)">${b.fullName || '—'}</td>
                <td>${renderLanguageBadges(b.languageIds)}</td>
                <td>${b.defaultLanguageId?.name || getBoardLanguages(b)[0]?.name || '—'}</td>
                <td><span class="badge ${b.isActive ? 'badge-success' : 'badge-danger'}">${b.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style="color:var(--text3)">${formatDate(b.createdAt)}</td>
                <td><div class="flex gap-2">
                  <button class="btn btn-outline btn-sm" onclick="openBoardModal('${b._id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteItem('boards','${b._id}',renderBoards)">Delete</button>
                </div></td>
              </tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="icon">🏫</div><h3>No boards yet</h3><p>Add your first board to get started</p></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`);
}

function openBoardModal(id = null) {
  const b = id ? boardsData.find(x => x._id === id) : null;
  const selectedLanguageIds = getBoardLanguageIds(b);
  const defaultLanguageId = getId(b?.defaultLanguageId) || selectedLanguageIds[0] || '';
  showModal(b ? 'Edit Board' : 'Add Board', `
    <div class="form-grid">
      <div class="form-group">
        <label>Board Name *</label>
        <input id="f-name" value="${b?.name || ''}" placeholder="e.g. CBSE" />
      </div>
      <div class="form-group">
        <label>Full Name</label>
        <input id="f-fullName" value="${b?.fullName || ''}" placeholder="e.g. Central Board of Secondary Education" />
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Supported Languages *</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:6px">
          ${langsData.filter(l => l.isActive !== false).map(l => `
            <label style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 10px;font-size:13px">
              <input type="checkbox" class="board-language-check" value="${l._id}" ${selectedLanguageIds.includes(l._id) ? 'checked' : ''} onchange="syncDefaultLanguageOptions()" />
              <span>${l.name}${l.code ? ` (${l.code})` : ''}</span>
            </label>`).join('') || '<p style="color:var(--text3);font-size:13px">Create active languages before adding a board.</p>'}
        </div>
      </div>
      <div class="form-group">
        <label>Default Language *</label>
        <select id="f-defaultLanguageId" data-selected="${defaultLanguageId}"></select>
      </div>
      ${b ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${b.isActive ? 'selected' : ''}>Active</option><option value="false" ${!b.isActive ? 'selected' : ''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const languageIds = [...document.querySelectorAll('.board-language-check:checked')].map(el => el.value);
      const body = {
        name: document.getElementById('f-name').value.trim(),
        fullName: document.getElementById('f-fullName').value.trim(),
        languageIds,
        defaultLanguageId: document.getElementById('f-defaultLanguageId').value,
      };
      if (!body.name) throw new Error('Board name is required');
      if (!body.languageIds.length) throw new Error('Select at least one language');
      if (!body.defaultLanguageId) throw new Error('Default language is required');
      if (b) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(b ? 'PUT' : 'POST', `/boards${b ? '/' + b._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(b ? 'Board updated' : 'Board created');
      closeModal();
      renderBoards();
    });
  syncDefaultLanguageOptions();
}

// ============ LANGUAGES ============
let langsData = [];
async function renderLanguages() {
  loadingState();
  const res = await api('GET', '/languages');
  langsData = res.data || [];
  setContent(`
    <div class="card">
      <div class="card-header">
        <div class="card-title">Languages (${langsData.length})</div>
        <button class="btn btn-primary btn-sm" onclick="openLangModal()">+ Add Language</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Code</th><th>Native Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${langsData.length ? langsData.map(l => `
              <tr>
                <td><strong>${l.name}</strong></td>
                <td style="font-family:var(--mono);color:var(--text2)">${l.code || '—'}</td>
                <td style="color:var(--text2)">${l.nativeName || '—'}</td>
                <td><span class="badge ${l.isActive ? 'badge-success' : 'badge-danger'}">${l.isActive ? 'Active' : 'Inactive'}</span></td>
                <td><div class="flex gap-2">
                  <button class="btn btn-outline btn-sm" onclick="openLangModal('${l._id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteItem('languages','${l._id}',renderLanguages)">Delete</button>
                </div></td>
              </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><div class="icon">🌐</div><h3>No languages yet</h3></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`);
}

function openLangModal(id = null) {
  const l = id ? langsData.find(x => x._id === id) : null;
  showModal(l ? 'Edit Language' : 'Add Language', `
    <div class="form-grid">
      <div class="form-group"><label>Language Name *</label><input id="f-name" value="${l?.name || ''}" placeholder="e.g. English" /></div>
      <div class="form-group"><label>Code</label><input id="f-code" value="${l?.code || ''}" placeholder="e.g. en" /></div>
      <div class="form-group"><label>Native Name</label><input id="f-nativeName" value="${l?.nativeName || ''}" placeholder="e.g. English" /></div>
      ${l ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${l.isActive?'selected':''}>Active</option><option value="false" ${!l.isActive?'selected':''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const body = { name: document.getElementById('f-name').value.trim(), code: document.getElementById('f-code').value.trim(), nativeName: document.getElementById('f-nativeName').value.trim() };
      if (!body.name) throw new Error('Name is required');
      if (l) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(l ? 'PUT' : 'POST', `/languages${l ? '/' + l._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(l ? 'Language updated' : 'Language created');
      closeModal(); renderLanguages();
    });
}

// ============ CLASSES ============
let classesData = [];
async function renderClasses() {
  loadingState();
  const [classRes, boardRes] = await Promise.all([api('GET', '/classes'), api('GET', '/boards')]);
  classesData = classRes.data || [];
  boardsData = boardRes.data || [];
  setContent(`
    <div style="margin-bottom:12px">
      <select id="filter-board" onchange="filterClasses()" style="max-width:200px">
        <option value="">All Boards</option>
        ${boardsData.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
      </select>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Classes (${classesData.length})</div>
        <button class="btn btn-primary btn-sm" onclick="openClassModal()">+ Add Class</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Board</th><th>Class Name</th><th>Grade Group</th><th>Sort Order</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="classes-tbody">
            ${renderClassRows(classesData)}
          </tbody>
        </table>
      </div>
    </div>`);
}

function renderClassRows(data) {
  return data.length ? data.map(c => `
    <tr>
      <td><span class="badge badge-info">${c.boardId?.name || '—'}</span></td>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--text2)">${c.gradeGroup || '—'}</td>
      <td style="font-family:var(--mono)">${c.sortOrder}</td>
      <td><span class="badge ${c.isActive?'badge-success':'badge-danger'}">${c.isActive?'Active':'Inactive'}</span></td>
      <td><div class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="openClassModal('${c._id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('classes','${c._id}',renderClasses)">Delete</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="icon">📚</div><h3>No classes yet</h3></div></td></tr>';
}

async function filterClasses() {
  const boardId = document.getElementById('filter-board').value;
  const url = boardId ? `/classes?boardId=${boardId}` : '/classes';
  const res = await api('GET', url);
  classesData = res.data || [];
  document.getElementById('classes-tbody').innerHTML = renderClassRows(classesData);
}

function openClassModal(id = null) {
  const c = id ? classesData.find(x => x._id === id) : null;
  showModal(c ? 'Edit Class' : 'Add Class', `
    <div class="form-grid">
      <div class="form-group"><label>Board *</label>
        <select id="f-boardId">
          <option value="">Select Board</option>
          ${boardsData.map(b => `<option value="${b._id}" ${c?.boardId?._id===b._id||c?.boardId===b._id?'selected':''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Class Name *</label><input id="f-name" value="${c?.name||''}" placeholder="e.g. Class 10" /></div>
      <div class="form-group"><label>Grade Group</label><input id="f-gradeGroup" value="${c?.gradeGroup||''}" placeholder="e.g. High School" /></div>
      <div class="form-group"><label>Sort Order</label><input id="f-sortOrder" type="number" value="${c?.sortOrder||0}" /></div>
      ${c ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${c.isActive?'selected':''}>Active</option><option value="false" ${!c.isActive?'selected':''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const body = {
        boardId: document.getElementById('f-boardId').value,
        name: document.getElementById('f-name').value.trim(),
        gradeGroup: document.getElementById('f-gradeGroup').value.trim(),
        sortOrder: parseInt(document.getElementById('f-sortOrder').value) || 0,
      };
      if (!body.boardId || !body.name) throw new Error('Board and Class name are required');
      if (c) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(c ? 'PUT' : 'POST', `/classes${c ? '/' + c._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(c ? 'Class updated' : 'Class created');
      closeModal(); renderClasses();
    });
}

// ============ SUBJECTS ============
let subjectsData = [];
async function renderSubjects() {
  loadingState();
  const [sRes, bRes, langRes] = await Promise.all([api('GET', '/subjects'), api('GET', '/boards'), api('GET', '/languages')]);
  subjectsData = sRes.data || [];
  boardsData = bRes.data || [];
  langsData = langRes.data || [];
  setContent(`
    <div class="search-bar">
      <select id="filter-board-sub" onchange="filterSubjects()" style="max-width:180px">
        <option value="">All Boards</option>
        ${boardsData.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
      </select>
      <select id="filter-class-sub" onchange="filterSubjects()" style="max-width:180px">
        <option value="">All Classes</option>
      </select>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Subjects (${subjectsData.length})</div>
        <button class="btn btn-primary btn-sm" onclick="openSubjectModal()">+ Add Subject</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Board</th><th>Class</th><th>Subject</th><th>Language</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="subjects-tbody">${renderSubjectRows(subjectsData)}</tbody>
        </table>
      </div>
    </div>`);

  document.getElementById('filter-board-sub').onchange = async function() {
    const boardId = this.value;
    if (boardId) {
      const res = await api('GET', `/classes?boardId=${boardId}`);
      const sel = document.getElementById('filter-class-sub');
      sel.innerHTML = '<option value="">All Classes</option>' + (res.data||[]).map(c => `<option value="${c._id}">${c.name}</option>`).join('');
    } else {
      document.getElementById('filter-class-sub').innerHTML = '<option value="">All Classes</option>';
    }
    filterSubjects();
  };
}

function renderSubjectRows(data) {
  return data.length ? data.map(s => `
    <tr>
      <td><span class="badge badge-info">${s.boardId?.name||'—'}</span></td>
      <td>${s.classId?.name||'—'}</td>
      <td><strong>${s.name}</strong></td>
      <td>${renderLanguageBadges(s.languageIds?.length ? s.languageIds : (s.languageId ? [s.languageId] : []))}</td>
      <td><span class="badge ${s.isActive?'badge-success':'badge-danger'}">${s.isActive?'Active':'Inactive'}</span></td>
      <td><div class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="openSubjectModal('${s._id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('subjects','${s._id}',renderSubjects)">Delete</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="icon">📖</div><h3>No subjects yet</h3></div></td></tr>';
}

async function filterSubjects() {
  const boardId = document.getElementById('filter-board-sub')?.value || '';
  const classId = document.getElementById('filter-class-sub')?.value || '';
  let url = '/subjects?';
  if (boardId) url += `boardId=${boardId}&`;
  if (classId) url += `classId=${classId}`;
  const res = await api('GET', url);
  subjectsData = res.data || [];
  document.getElementById('subjects-tbody').innerHTML = renderSubjectRows(subjectsData);
}

function openSubjectModal(id = null) {
  const s = id ? subjectsData.find(x => x._id === id) : null;
  showModal(s ? 'Edit Subject' : 'Add Subject', `
    <div class="form-grid">
      <div class="form-group"><label>Board *</label>
        <select id="f-boardId" onchange="loadClassesForModal(this.value,'f-classId'); refreshSubjectLanguageCheckboxes(this.value)">
          <option value="">Select Board</option>
          ${boardsData.map(b => `<option value="${b._id}" ${(s?.boardId?._id||s?.boardId)===b._id?'selected':''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Class *</label>
        <select id="f-classId">
          <option value="${s?.classId?._id||''}">Loading...</option>
        </select>
      </div>
      <div class="form-group"><label>Subject Name *</label><input id="f-name" value="${s?.name||''}" placeholder="e.g. Mathematics" /></div>
      <div id="subject-language-fields" style="grid-column:1/-1">${renderSubjectLanguageCheckboxes(getId(s?.boardId), getSubjectLanguageIds(s))}</div>
      <div class="form-group"><label>Icon URL</label><input id="f-iconUrl" value="${s?.iconUrl||''}" placeholder="https://..." /></div>
      ${s ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${s.isActive?'selected':''}>Active</option><option value="false" ${!s.isActive?'selected':''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const body = {
        boardId: document.getElementById('f-boardId').value,
        classId: document.getElementById('f-classId').value,
        languageIds: [...document.querySelectorAll('.subject-language-check:checked')].map(el => el.value),
        name: document.getElementById('f-name').value.trim(),
        iconUrl: document.getElementById('f-iconUrl').value.trim(),
      };
      if (!body.boardId || !body.classId || !body.languageIds.length || !body.name) throw new Error('Board, Class, Languages and Subject name are required');
      if (s) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(s ? 'PUT' : 'POST', `/subjects${s ? '/' + s._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(s ? 'Subject updated' : 'Subject created');
      closeModal(); renderSubjects();
    });
  if (s?.boardId) {
    const bid = s.boardId?._id || s.boardId;
    setTimeout(() => loadClassesForModal(bid, 'f-classId', s.classId?._id || s.classId), 100);
  }
}

async function loadClassesForModal(boardId, selectId, selectedId = null) {
  if (!boardId) return;
  const res = await api('GET', `/classes?boardId=${boardId}`);
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Class</option>' + (res.data||[]).map(c => `<option value="${c._id}" ${c._id===selectedId?'selected':''}>${c.name}</option>`).join('');
}

// ============ CHAPTERS & TOPICS ============

async function renderChaptersHierarchy() {
  loadingState();
  const [cRes, bRes, classRes, subjectRes, langRes] = await Promise.all([
    api('GET', '/chapters'),
    api('GET', '/boards'),
    api('GET', '/classes'),
    api('GET', '/subjects'),
    api('GET', '/languages')
  ]);
  chaptersData = cRes.data || [];
  boardsData = bRes.data || [];
  classesData = classRes.data || [];
  subjectsData = subjectRes.data || [];
  langsData = langRes.data || [];
  expandChaptersByDefault(chaptersData);
  topicsData = {};
  questionsData = {};

  setContent(`
    <div class="search-bar">
      <select id="filter-board-ch" style="max-width:160px" onchange="onBoardChangeChapterHierarchy()">
        <option value="">All Boards</option>
        ${boardsData.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
      </select>
      <select id="filter-class-ch" style="max-width:160px" onchange="onClassChangeChapterHierarchy()">
        <option value="">All Classes</option>
        ${classesData.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
      </select>
      <select id="filter-subject-ch" style="max-width:160px" onchange="filterChaptersHierarchy()">
        <option value="">All Subjects</option>
        ${subjectsData.map(s => `<option value="${s._id}">${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">Chapters & Topics (${chaptersData.length})</div>
        <button class="btn btn-primary btn-sm" onclick="openChapterModal()">+ Add Chapter</button>
      </div>
      <div id="hierarchy-container" style="padding:16px"></div>
    </div>`);
  await renderHierarchy();
}

async function renderHierarchy() {
  const container = document.getElementById('hierarchy-container');
  if (!container) return;

  if (!chaptersData.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📝</div><h3>No chapters yet</h3></div>';
    return;
  }

  let html = '';
  for (const chapter of chaptersData) {
    const isExpanded = expandedChapters.has(chapter._id);
    html += `
      <div class="hierarchy-item">
        <div class="hierarchy-header ${isExpanded?'active':''}" onclick="toggleChapterExpand('${chapter._id}')">
          <div class="hierarchy-expand">${isExpanded?'▼':'▶'}</div>
          <strong>${chapter.name}</strong>
          <span style="color:var(--text3);font-size:12px;margin-left:auto">${chapter.boardId?.name||'—'} • ${chapter.classId?.name||'—'}</span>
          <button class="btn btn-outline btn-sm" style="margin-left:8px" onclick="event.stopPropagation(); openChapterModal('${chapter._id}')">Edit</button>
          <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="event.stopPropagation(); deleteItem('chapters','${chapter._id}',renderChaptersHierarchy)">Delete</button>
        </div>`;

    if (isExpanded) {
      const topicsHtml = await renderTopicsForChapter(chapter._id);
      html += `<div class="hierarchy-content">${topicsHtml}</div>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

async function renderTopicsForChapter(chapterId) {
  if (!topicsData[chapterId]) {
    const res = await api('GET', `/topics?chapterId=${chapterId}`);
    topicsData[chapterId] = res.data || [];
  }

  const topics = topicsData[chapterId];
  if (!topics.length) {
    return `<div class="hierarchy-level-2" style="padding:16px;text-align:center;color:var(--text3)">
      No topics yet
      <button class="btn btn-primary btn-sm" style="margin-left:12px" onclick="openTopicModal('${chapterId}')">+ Add Topic</button>
    </div>`;
  }

  let html = '';
  for (const topic of topics) {
    const isExpanded = expandedTopics.has(topic._id);
    html += `
      <div class="hierarchy-level-2">
        <div class="hierarchy-header ${isExpanded?'active':''}" onclick="toggleTopicExpand('${topic._id}')">
          <div class="hierarchy-expand" style="font-size:9px">${isExpanded?'▼':'▶'}</div>
          ${topic.name}
          <button class="btn btn-outline btn-sm" style="margin-left:auto;font-size:11px;padding:4px 8px" onclick="event.stopPropagation(); openTopicModal('${chapterId}','${topic._id}')">Edit</button>
          <button class="btn btn-danger btn-sm" style="margin-left:4px;font-size:11px;padding:4px 8px" onclick="event.stopPropagation(); deleteItem('topics','${topic._id}',()=>reloadTopicsForChapter('${chapterId}'))">Delete</button>
        </div>`;

    if (isExpanded) {
      const questionsHtml = await renderQuestionsForTopic(topic._id);
      html += `<div class="hierarchy-content">${questionsHtml}</div>`;
    }
    html += '</div>';
  }

  html += `<div style="padding:8px 12px;margin-top:8px">
    <button class="btn btn-primary btn-sm" onclick="openTopicModal('${chapterId}')">+ Add Topic</button>
  </div>`;

  return html;
}

async function renderQuestionsForTopic(topicId) {
  if (!questionsData[topicId]) {
    const res = await api('GET', `/questions?topicId=${topicId}`);
    questionsData[topicId] = res.data?.questions || [];
  }

  const questions = questionsData[topicId];
  if (!questions.length) {
    return `<div class="hierarchy-level-3" style="padding:12px;text-align:center;color:var(--text3)">
      No questions yet
      <button class="btn btn-primary btn-sm" style="margin-left:12px;font-size:11px;padding:4px 8px" onclick="openQuestionModal('${topicId}')">+ Add Question</button>
    </div>`;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:6px">';
  for (const q of questions) {
    html += `
      <div class="hierarchy-level-3" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:500">${q.question.substring(0,60)}${q.question.length>60?'...':''}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Answer: ${q.answer.substring(0,50)}...</div>
        </div>
        <div style="display:flex;gap:4px;margin-left:10px;flex-shrink:0">
          <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px" onclick="viewQuestion('${q._id}')">View</button>
          <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px" onclick="openQuestionModal('${topicId}','${q._id}')">Edit</button>
          <button class="btn btn-danger btn-sm" style="font-size:11px;padding:4px 8px" onclick="deleteItem('questions','${q._id}',()=>reloadQuestionsForTopic('${topicId}'))">Del</button>
        </div>
      </div>`;
  }
  html += `</div>
    <div style="padding:8px 12px;margin-top:8px">
      <button class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 8px" onclick="openQuestionModal('${topicId}')">+ Add Question</button>
    </div>`;

  return html;
}

function toggleChapterExpand(chapterId) {
  if (expandedChapters.has(chapterId)) {
    expandedChapters.delete(chapterId);
  } else {
    expandedChapters.add(chapterId);
  }
  renderHierarchy();
}

function toggleTopicExpand(topicId) {
  if (expandedTopics.has(topicId)) {
    expandedTopics.delete(topicId);
  } else {
    expandedTopics.add(topicId);
  }
  renderHierarchy();
}

async function reloadTopicsForChapter(chapterId) {
  topicsData[chapterId] = undefined;
  renderHierarchy();
}

async function reloadQuestionsForTopic(topicId) {
  questionsData[topicId] = undefined;
  renderHierarchy();
}

async function onBoardChangeChapterHierarchy() {
  const boardId = document.getElementById('filter-board-ch').value;
  const classSel = document.getElementById('filter-class-ch');
  const subSel = document.getElementById('filter-subject-ch');
  classSel.innerHTML = '<option value="">All Classes</option>';
  subSel.innerHTML = '<option value="">All Subjects</option>';
  const [classRes, subjectRes] = await Promise.all([
    api('GET', boardId ? `/classes?boardId=${boardId}` : '/classes'),
    api('GET', boardId ? `/subjects?boardId=${boardId}` : '/subjects')
  ]);
  classSel.innerHTML += (classRes.data||[]).map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  subSel.innerHTML += (subjectRes.data||[]).map(s => `<option value="${s._id}">${s.name}</option>`).join('');
  filterChaptersHierarchy();
}

async function onClassChangeChapterHierarchy() {
  const boardId = document.getElementById('filter-board-ch').value;
  const classId = document.getElementById('filter-class-ch').value;
  const subSel = document.getElementById('filter-subject-ch');
  subSel.innerHTML = '<option value="">All Subjects</option>';
  let url = '/subjects?';
  if (boardId) url += `boardId=${boardId}&`;
  if (classId) url += `classId=${classId}`;
  const res = await api('GET', url);
  subSel.innerHTML += (res.data||[]).map(s => `<option value="${s._id}">${s.name}</option>`).join('');
  filterChaptersHierarchy();
}

async function filterChaptersHierarchy() {
  const b = document.getElementById('filter-board-ch')?.value||'';
  const c = document.getElementById('filter-class-ch')?.value||'';
  const s = document.getElementById('filter-subject-ch')?.value||'';
  let url = '/chapters?';
  if (b) url += `boardId=${b}&`;
  if (c) url += `classId=${c}&`;
  if (s) url += `subjectId=${s}`;
  const res = await api('GET', url);
  chaptersData = res.data || [];
  topicsData = {};
  questionsData = {};
  expandChaptersByDefault(chaptersData);
  await renderHierarchy();
}

function openChapterModal(id = null) {
  const ch = id ? chaptersData.find(x => x._id === id) : null;
  const selBid = ch?.boardId?._id || ch?.boardId || '';
  const selSubjectId = getId(ch?.subjectId);
  const contentLanguages = getContentLanguagesBySubjectId(selSubjectId, selBid);
  showModal(ch ? 'Edit Chapter' : 'Add Chapter', `
    <div class="form-grid">
      <div class="form-group"><label>Board *</label>
        <select id="f-boardId" onchange="loadClassesForModal(this.value,'f-classId'); refreshChapterTranslationInputs(this.value)">
          <option value="">Select Board</option>
          ${boardsData.map(b => `<option value="${b._id}" ${b._id===selBid?'selected':''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Class *</label><select id="f-classId"><option value="">Select Class</option></select></div>
      <div class="form-group"><label>Subject *</label><select id="f-subjectId" onchange="refreshChapterTranslationInputs(document.getElementById('f-boardId').value, this.value)"><option value="">Select Subject</option></select></div>
      <div id="chapter-translation-fields" style="grid-column:1/-1">${renderTranslationInputs(contentLanguages, ch?.translations, [{ key: 'name', label: 'Chapter Name', type: 'input', required: true }])}</div>
      <div class="form-group"><label>Sort Order</label><input id="f-sortOrder" type="number" value="${ch?.sortOrder||0}" /></div>
      ${ch ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${ch.isActive?'selected':''}>Active</option><option value="false" ${!ch.isActive?'selected':''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const body = {
        boardId: document.getElementById('f-boardId').value,
        classId: document.getElementById('f-classId').value,
        subjectId: document.getElementById('f-subjectId').value,
        sortOrder: parseInt(document.getElementById('f-sortOrder').value)||0,
      };
      body.translations = collectTranslations(getContentLanguagesBySubjectId(body.subjectId, body.boardId), ['name']);
      if (!body.boardId || !body.classId || !body.subjectId) throw new Error('Board, Class and Subject are required');
      if (ch) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(ch ? 'PUT' : 'POST', `/chapters${ch ? '/' + ch._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(ch ? 'Chapter updated' : 'Chapter created');
      closeModal(); renderChaptersHierarchy();
    });

  document.getElementById('f-classId').addEventListener('change', async function() {
    const boardId = document.getElementById('f-boardId').value;
    const classId = this.value;
    if (classId) {
      const res = await api('GET', `/subjects?boardId=${boardId}&classId=${classId}`);
      const sel = document.getElementById('f-subjectId');
      const sid = ch?.subjectId?._id || ch?.subjectId || '';
      sel.innerHTML = '<option value="">Select Subject</option>' + (res.data||[]).map(s => `<option value="${s._id}" ${s._id===sid?'selected':''}>${s.name}</option>`).join('');
      subjectsData = mergeById(subjectsData, res.data || []);
      refreshChapterTranslationInputs(boardId, sid || sel.value);
    }
  });

  if (ch && selBid) {
    setTimeout(async () => {
      const cid = ch.classId?._id || ch.classId || '';
      const sid = ch.subjectId?._id || ch.subjectId || '';
      await loadClassesForModal(selBid, 'f-classId', cid);
      if (cid) {
        const res = await api('GET', `/subjects?boardId=${selBid}&classId=${cid}`);
        const sel = document.getElementById('f-subjectId');
        if (sel) sel.innerHTML = '<option value="">Select Subject</option>' + (res.data||[]).map(s => `<option value="${s._id}" ${s._id===sid?'selected':''}>${s.name}</option>`).join('');
        subjectsData = mergeById(subjectsData, res.data || []);
        refreshChapterTranslationInputs(selBid, sid);
      }
    }, 150);
  }
}

async function openTopicModal(chapterId, topicId = null) {
  const chapter = chaptersData.find(c => c._id === chapterId);
  if (!chapter) return toast('Chapter not found', 'error');

  const topics = topicsData[chapterId] || [];
  const topic = topicId ? topics.find(t => t._id === topicId) : null;
  const boardId = chapter.boardId?._id || chapter.boardId;
  const boardLanguages = getContentLanguagesBySubjectId(getId(chapter.subjectId), boardId);

  showModal(topic ? 'Edit Topic' : 'Add Topic', `
    <div class="form-grid">
      <div class="form-group"><label>Chapter</label><div style="padding:8px 12px;background:var(--card2);border-radius:6px;font-size:13px">${chapter.name}</div></div>
      <div style="grid-column:1/-1">${renderTranslationInputs(boardLanguages, topic?.translations, [
        { key: 'name', label: 'Topic Name', type: 'input', required: true },
        { key: 'description', label: 'Description', type: 'textarea', rows: 2 }
      ])}</div>
      <div class="form-group"><label>Sort Order</label><input id="f-sortOrder" type="number" value="${topic?.sortOrder||0}" /></div>
      ${topic ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${topic.isActive?'selected':''}>Active</option><option value="false" ${!topic.isActive?'selected':''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const body = {
        chapterId,
        sortOrder: parseInt(document.getElementById('f-sortOrder').value)||0,
        translations: collectTranslations(boardLanguages, ['name', 'description']),
      };
      if (topic) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(topic ? 'PUT' : 'POST', `/topics${topic ? '/' + topic._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(topic ? 'Topic updated' : 'Topic created');
      closeModal();
      topicsData[chapterId] = undefined;
      renderChaptersHierarchy();
    });
}

async function renderQuestionsForTopicContent(topicId) {
  const res = await api('GET', `/questions?topicId=${topicId}`);
  questionsData[topicId] = res.data?.questions || [];
  renderHierarchy();
}

async function openQuestionModal(topicId, questionId = null) {
  const questions = questionsData[topicId] || [];
  const q = questionId ? questions.find(x => x._id === questionId) : null;
  const stepsVal = q?.steps?.join('\n') || '';

  let boardId = q?.boardId;
  let classId = q?.classId;
  let subjectId = q?.subjectId;

  if (!boardId && !q) {
    for (const chapterId of Object.keys(topicsData)) {
      const topics = topicsData[chapterId];
      if (Array.isArray(topics)) {
        const topic = topics.find(t => t._id === topicId);
        if (topic) {
          const chapter = chaptersData.find(c => c._id === chapterId);
          if (chapter) {
            boardId = chapter.boardId?._id || chapter.boardId;
            classId = chapter.classId?._id || chapter.classId;
            subjectId = chapter.subjectId?._id || chapter.subjectId;
          }
          break;
        }
      }
    }
  }
  boardId = getId(boardId);
  classId = getId(classId);
  subjectId = getId(subjectId);
  const boardLanguages = getContentLanguagesBySubjectId(subjectId, boardId);
  if (!boardLanguages.length) return toast('Subject language is not configured', 'error');

  showModal(q ? 'Edit Question' : 'Add Question', `
    <div class="form-grid">
      <div class="form-group"><label>Difficulty</label>
        <select id="f-difficulty">
          <option value="easy" ${q?.difficulty==='easy'?'selected':''}>Easy</option>
          <option value="medium" ${!q||q?.difficulty==='medium'?'selected':''}>Medium</option>
          <option value="hard" ${q?.difficulty==='hard'?'selected':''}>Hard</option>
        </select>
      </div>
      <div style="grid-column:1/-1">${renderTranslationInputs(boardLanguages, q?.translations, [
        { key: 'question', label: 'Question', type: 'textarea', rows: 3, required: true },
        { key: 'answer', label: 'Answer', type: 'textarea', rows: 2, required: true },
        { key: 'steps', label: 'Steps to Solve', type: 'textarea', rows: 4, placeholder: 'One step per line' }
      ])}</div>
    </div>`, async () => {
      const translations = collectTranslations(boardLanguages, ['question', 'answer', 'steps'], ['steps']);
      const body = {
        topicId,
        difficulty: document.getElementById('f-difficulty').value,
        translations,
      };

      if (q) {
        body.boardId = getId(q.boardId);
        body.classId = getId(q.classId);
        body.subjectId = getId(q.subjectId);
      } else {
        body.boardId = boardId;
        body.classId = classId;
        body.subjectId = subjectId;
      }

      const res = await api(q ? 'PUT' : 'POST', `/questions${q ? '/' + q._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(q ? 'Question updated' : 'Question created');
      closeModal();
      questionsData[topicId] = undefined;
      renderChaptersHierarchy();
    });
}

function viewQuestion(id) {
  let question = null;
  for (const topicId in questionsData) {
    const q = questionsData[topicId].find(x => x._id === id);
    if (q) {
      question = q;
      break;
    }
  }
  if (!question) return;

  const stepsHtml = question.steps?.length ? `<ul class="steps-list">${question.steps.map((s,i) => `<li><div class="step-num">${i+1}</div><span>${s}</span></li>`).join('')}</ul>` : '<p style="color:var(--text3);font-size:13px">No steps provided</p>';
  showModal('Question Details', `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${renderQuestionTranslationDetails(question)}
      <div class="form-group"><label>Question</label><div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.5">${question.question}</div></div>
      <div class="form-group"><label>Answer</label><div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:12px;font-size:13px;color:var(--success)">${question.answer}</div></div>
      <div class="form-group"><label>Steps to Solve</label>${stepsHtml}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label>Difficulty</label><div style="padding-top:4px"><span class="badge ${question.difficulty==='easy'?'badge-success':question.difficulty==='hard'?'badge-danger':'badge-warn'}">${question.difficulty}</span></div></div>
      </div>
    </div>`,  () => closeModal());
  document.getElementById('modal-save-btn').textContent = 'Close';
  document.getElementById('modal-save-btn').onclick = closeModal;
}

function renderQuestionTranslationDetails(question) {
  if (!question.translations?.length) return '';
  return question.translations.map(t => {
    const language = typeof t.languageId === 'object' ? t.languageId.name : (langsData.find(l => l._id === getId(t.languageId))?.name || 'Language');
    const steps = t.steps?.length ? `<ul class="steps-list">${t.steps.map((s,i) => `<li><div class="step-num">${i+1}</div><span>${s}</span></li>`).join('')}</ul>` : '<p style="color:var(--text3);font-size:13px">No steps provided</p>';
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--card2)">
      <div style="font-size:12px;font-weight:700;color:var(--cyan);margin-bottom:10px">${language}</div>
      <div class="form-group"><label>Question</label><div style="padding:10px;border-radius:8px;background:var(--bg3)">${t.question || '—'}</div></div>
      <div class="form-group"><label>Answer</label><div style="padding:10px;border-radius:8px;background:rgba(34,197,94,0.1);color:var(--success)">${t.answer || '—'}</div></div>
      <div class="form-group"><label>Steps</label>${steps}</div>
    </div>`;
  }).join('');
}

// ============ USERS ============
let usersPage = 1;
async function renderUsers(page = 1) {
  usersPage = page;
  loadingState();
  const [bRes, cRes] = await Promise.all([api('GET', '/boards'), api('GET', '/classes')]);
  boardsData = bRes.data || [];
  classesData = cRes.data || [];
  setContent(`
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input id="user-search" placeholder="Search by name or email..." onkeyup="debounceSearch()" />
      </div>
      <select id="filter-user-board" style="max-width:150px" onchange="onUserBoardFilterChange()">
        <option value="">All Boards</option>
        ${boardsData.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
      </select>
      <select id="filter-user-class" style="max-width:150px" onchange="usersPage=1;loadUsers()">
        <option value="">All Classes</option>
        ${classesData.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div id="user-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"></div>
    <div class="card">
      <div class="card-header"><div class="card-title">All Users</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Board</th><th>Class</th><th>Subscription</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody id="users-tbody"><tr><td colspan="8"><div class="loading-state"><div class="spinner"></div></div></td></tr></tbody>
        </table>
      </div>
      <div class="pagination" id="users-pagination"></div>
    </div>`);
  await loadUsers();
}

let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadUsers(), 400);
}

async function onUserBoardFilterChange() {
  usersPage = 1;
  const boardId = document.getElementById('filter-user-board')?.value || '';
  const res = await api('GET', boardId ? `/classes?boardId=${boardId}` : '/classes');
  classesData = res.data || [];
  const classSelect = document.getElementById('filter-user-class');
  if (classSelect) {
    classSelect.innerHTML = '<option value="">All Classes</option>' + classesData.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  }
  await loadUsers();
}

async function loadUsers() {
  const search = document.getElementById('user-search')?.value || '';
  const boardId = document.getElementById('filter-user-board')?.value || '';
  const classId = document.getElementById('filter-user-class')?.value || '';
  let url = `/users?page=${usersPage}&limit=15`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (boardId) url += `&boardId=${boardId}`;
  if (classId) url += `&classId=${classId}`;
  const res = await api('GET', url);
  const d = res.data || {};
  const users = d.users || [];

  const stats = document.getElementById('user-stats');
  if (stats && d.stats) {
    stats.innerHTML = `
      <div class="stat-card"><div><div class="stat-label">Total</div><div class="stat-value" style="font-size:20px;color:var(--accent2)">${d.stats.totalUsers}</div></div><div class="stat-icon">👥</div></div>
      <div class="stat-card"><div><div class="stat-label">Active</div><div class="stat-value" style="font-size:20px;color:var(--success)">${d.stats.activeUsers}</div></div><div class="stat-icon">✅</div></div>
      <div class="stat-card"><div><div class="stat-label">Paid</div><div class="stat-value" style="font-size:20px;color:var(--warn)">${d.stats.paidUsers}</div></div><div class="stat-icon">💳</div></div>
      <div class="stat-card"><div><div class="stat-label">Revenue</div><div class="stat-value" style="font-size:20px;color:var(--success)">₹${(d.stats.revenue||0).toLocaleString()}</div></div><div class="stat-icon">💰</div></div>`;
  }

  const tbody = document.getElementById('users-tbody');
  if (tbody) tbody.innerHTML = users.length ? users.map(u => `
    <tr>
      <td><strong>${u.name || '—'}</strong></td>
      <td style="color:var(--text2)">${u.email}</td>
      <td>${u.boardId?.name||'—'}</td>
      <td>${u.classId?.name||'—'}</td>
      <td>${u.subscriptionId ? `<span class="badge badge-success">${u.subscriptionId.name}</span>` : '<span class="badge badge-warn">Free</span>'}</td>
      <td><span class="badge ${u.isActive?'badge-success':'badge-danger'}">${u.isActive?'Active':'Blocked'}</span></td>
      <td style="color:var(--text3)">${formatDate(u.createdAt)}</td>
      <td><div class="flex gap-2">
        <button class="btn btn-outline btn-sm" onclick="viewUser('${u._id}')">Details</button>
        <button class="btn btn-sm ${u.isActive?'btn-danger':'btn-outline'}" onclick="toggleUser('${u._id}')">${u.isActive?'Block':'Unblock'}</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="icon">👥</div><h3>No users found</h3></div></td></tr>';

  const pg = document.getElementById('users-pagination');
  if (pg) pg.innerHTML = `
    <span class="pagination-info">Total: ${d.total||0} users</span>
    <button class="page-btn" onclick="renderUsers(${usersPage-1})" ${usersPage<=1?'disabled':''}>← Prev</button>
    <span class="page-btn active">${usersPage}</span>
    <button class="page-btn" onclick="renderUsers(${usersPage+1})" ${usersPage>=d.totalPages?'disabled':''}>Next →</button>`;
}

async function viewUser(id) {
  const res = await api('GET', `/users/${id}`);
  if (!res.status) return toast('Failed to load user', 'error');
  const u = res.data.user;
  const purchases = res.data.purchases || [];
  showModal('User Details', `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Name</label><div style="font-size:14px;padding-top:4px">${u.name||'Not set'}</div></div>
        <div class="form-group"><label>Email</label><div style="font-size:14px;padding-top:4px">${u.email}</div></div>
        <div class="form-group"><label>Board</label><div style="font-size:14px;padding-top:4px">${u.boardId?.name||'Not set'}</div></div>
        <div class="form-group"><label>Class</label><div style="font-size:14px;padding-top:4px">${u.classId?.name||'Not set'}</div></div>
        <div class="form-group"><label>Language</label><div style="font-size:14px;padding-top:4px">${u.languageId?.name||'Not set'}</div></div>
        <div class="form-group"><label>Status</label><div style="padding-top:4px"><span class="badge ${u.isActive?'badge-success':'badge-danger'}">${u.isActive?'Active':'Blocked'}</span></div></div>
        <div class="form-group"><label>Subscription</label><div style="padding-top:4px">${u.subscriptionId?`<span class="badge badge-success">${u.subscriptionId.name}</span>`:'<span class="badge badge-warn">Free</span>'}</div></div>
        <div class="form-group"><label>Joined</label><div style="font-size:14px;padding-top:4px">${formatDate(u.createdAt)}</div></div>
      </div>
      ${purchases.length ? `
        <div>
          <label style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px">Purchase History</label>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
            ${purchases.map(p => `<div style="background:var(--card2);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px">${p.subscriptionId?.name||'—'}</span>
              <span style="color:var(--success);font-family:var(--mono);font-size:13px">₹${p.amount}</span>
              <span style="color:var(--text3);font-size:12px">${formatDate(p.createdAt)}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
    </div>`, () => closeModal());
  document.getElementById('modal-save-btn').textContent = 'Close';
  document.getElementById('modal-save-btn').onclick = closeModal;
}

async function toggleUser(id) {
  const res = await api('PATCH', `/users/${id}/toggle-status`);
  if (!res.status) return toast(res.message, 'error');
  toast(`User ${res.data.isActive ? 'unblocked' : 'blocked'}`);
  loadUsers();
}

// ============ SUBSCRIPTIONS ============
let subsData = [];
async function renderSubscriptions() {
  loadingState();
  const [res, bR, cR] = await Promise.all([api('GET', '/subscriptions'), api('GET', '/boards'), api('GET', '/classes')]);
  subsData = res.data || [];
  boardsData = bR.data || [];
  classesData = cR.data || [];
  setContent(`
    <div class="card">
      <div class="card-header">
        <div class="card-title">Subscription Plans (${subsData.length})</div>
        <button class="btn btn-primary btn-sm" onclick="openSubModal()">+ Add Plan</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Board</th><th>Class</th><th>Name</th><th>Details</th><th>Price</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${subsData.length ? subsData.map(s => `
              <tr>
                <td><span class="badge badge-info">${s.boardId?.name||'—'}</span></td>
                <td>${s.classId?.name||'—'}</td>
                <td><strong>${s.name}</strong></td>
                <td style="color:var(--text2)">${s.detail||'—'}</td>
                <td><span style="color:var(--success);font-family:var(--mono);font-weight:600">₹${s.price}</span></td>
                <td>${s.durationDays} days</td>
                <td><span class="badge ${s.isActive?'badge-success':'badge-danger'}">${s.isActive?'Active':'Inactive'}</span></td>
                <td><div class="flex gap-2">
                  <button class="btn btn-outline btn-sm" onclick="openSubModal('${s._id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteItem('subscriptions','${s._id}',renderSubscriptions)">Delete</button>
                </div></td>
              </tr>`).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="icon">💳</div><h3>No subscription plans yet</h3></div></td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`);
}

function openSubModal(id = null) {
  const s = id ? subsData.find(x => x._id === id) : null;
  const selectedBoardId = s?.boardId?._id || s?.boardId || '';
  const selectedClassId = s?.classId?._id || s?.classId || '';
  showModal(s ? 'Edit Plan' : 'Add Plan', `
    <div class="form-grid">
      <div class="form-group"><label>Board *</label>
        <select id="f-boardId" onchange="loadClassesForModal(this.value,'f-classId')">
          <option value="">Select Board</option>
          ${boardsData.map(b => `<option value="${b._id}" ${selectedBoardId===b._id?'selected':''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Class *</label><select id="f-classId"><option value="">Select Class</option></select></div>
      <div class="form-group"><label>Plan Name *</label><input id="f-name" value="${s?.name||''}" placeholder="e.g. Class 10th Annual" /></div>
      <div class="form-group"><label>Price (₹) *</label><input id="f-price" type="number" value="${s?.price||''}" placeholder="999" /></div>
      <div class="form-group"><label>Duration (days) *</label><input id="f-durationDays" type="number" value="${s?.durationDays||365}" placeholder="365" /></div>
      <div class="form-group" style="grid-column:1/-1"><label>Details</label><textarea id="f-detail">${s?.detail||''}</textarea></div>
      ${s ? `<div class="form-group"><label>Status</label><select id="f-isActive"><option value="true" ${s.isActive?'selected':''}>Active</option><option value="false" ${!s.isActive?'selected':''}>Inactive</option></select></div>` : ''}
    </div>`, async () => {
      const body = {
        boardId: document.getElementById('f-boardId').value,
        classId: document.getElementById('f-classId').value,
        name: document.getElementById('f-name').value.trim(),
        price: parseFloat(document.getElementById('f-price').value),
        durationDays: parseInt(document.getElementById('f-durationDays').value),
        detail: document.getElementById('f-detail').value.trim(),
      };
      if (!body.boardId || !body.classId || !body.name || !body.price || !body.durationDays) throw new Error('Board, class, name, price and duration are required');
      if (s) body.isActive = document.getElementById('f-isActive').value === 'true';
      const res = await api(s ? 'PUT' : 'POST', `/subscriptions${s ? '/' + s._id : ''}`, body);
      if (!res.status) throw new Error(res.message);
      toast(s ? 'Plan updated' : 'Plan created');
      closeModal(); renderSubscriptions();
    });
  if (selectedBoardId) setTimeout(() => loadClassesForModal(selectedBoardId, 'f-classId', selectedClassId), 100);
}

// ============ PURCHASES ============
let purchasePage = 1;
async function renderPurchases(page = 1) {
  purchasePage = page;
  loadingState();
  const res = await api('GET', `/subscriptions/purchases?page=${page}&limit=20`);
  const d = res.data || {};
  const purchases = d.purchases || [];
  setContent(`
    <div class="card">
      <div class="card-header">
        <div class="card-title">Subscription Purchases</div>
        <span style="font-size:12px;color:var(--text3)">Total: ${d.total || 0} purchases</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Plan</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>
            ${purchases.length ? purchases.map(p => `
              <tr>
                <td><strong>${p.userId?.name||'—'}</strong></td>
                <td style="color:var(--text2)">${p.userId?.email||'—'}</td>
                <td><span class="badge badge-info">${p.subscriptionId?.name||'—'}</span></td>
                <td><span style="color:var(--success);font-family:var(--mono);font-weight:600">₹${p.amount}</span></td>
                <td style="color:var(--text3)">${formatDate(p.createdAt)}</td>
              </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state"><div class="icon">🧾</div><h3>No purchases yet</h3></div></td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span class="pagination-info">Page ${page} of ${d.totalPages||1}</span>
        <button class="page-btn" onclick="renderPurchases(${page-1})" ${page<=1?'disabled':''}>← Prev</button>
        <button class="page-btn" onclick="renderPurchases(${page+1})" ${page>=d.totalPages?'disabled':''}>Next →</button>
      </div>
    </div>`);
}

// ============ DELETE ============
async function deleteItem(resource, id, onSuccess) {
  showConfirm('Are you sure you want to delete this item? This action cannot be undone.', async () => {
    const res = await api('DELETE', `/${resource}/${id}`);
    if (!res.status) return toast(res.message, 'error');
    toast('Deleted successfully');
    if (onSuccess) onSuccess();
  });
}

// ============ HELPERS ============
function getId(value) {
  return value?._id || value || '';
}

function expandChaptersByDefault(chapters = []) {
  expandedChapters = new Set((chapters || []).map(chapter => chapter._id));
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBoardLanguages(board) {
  return (board?.languageIds || []).map(language => {
    if (typeof language === 'string') return langsData.find(l => l._id === language) || { _id: language, name: 'Language' };
    return language;
  }).filter(Boolean);
}

function getBoardLanguageIds(board) {
  return getBoardLanguages(board).map(l => l._id);
}

function getBoardLanguagesById(boardId) {
  const board = boardsData.find(b => b._id === getId(boardId));
  return getBoardLanguages(board);
}

function mergeById(current, incoming) {
  const map = new Map((current || []).map(item => [item._id, item]));
  (incoming || []).forEach(item => map.set(item._id, item));
  return [...map.values()];
}

function getContentLanguagesBySubjectId(subjectId, boardId = '') {
  const subject = subjectsData.find(s => s._id === getId(subjectId));
  const languageIds = getSubjectLanguageIds(subject);
  if (languageIds.length) {
    return languageIds.map(languageId => {
      const populated = (subject.languageIds || []).find(l => getId(l) === languageId);
      return typeof populated === 'object' ? populated : langsData.find(l => l._id === languageId) || { _id: languageId, name: 'Subject Language' };
    });
  }
  return boardId ? getBoardLanguagesById(boardId) : [];
}

function getSubjectLanguageIds(subject) {
  const ids = (subject?.languageIds || []).map(getId).filter(Boolean);
  const legacyId = getId(subject?.languageId);
  if (legacyId && !ids.includes(legacyId)) ids.push(legacyId);
  return ids;
}

function renderSubjectLanguageCheckboxes(boardId, selectedIds = []) {
  const languages = getBoardLanguagesById(boardId);
  if (!languages.length) {
    return '<div class="empty-state" style="padding:14px"><p>Select a board with configured languages first.</p></div>';
  }
  return `
    <div class="form-group">
      <label>Subject Languages *</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:6px">
        ${languages.map(l => `
          <label style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 10px;font-size:13px">
            <input type="checkbox" class="subject-language-check" value="${l._id}" ${selectedIds.includes(l._id) ? 'checked' : ''} />
            <span>${l.name}${l.code ? ` (${l.code})` : ''}</span>
          </label>`).join('')}
      </div>
    </div>`;
}

function refreshSubjectLanguageCheckboxes(boardId) {
  const container = document.getElementById('subject-language-fields');
  if (!container) return;
  container.innerHTML = renderSubjectLanguageCheckboxes(boardId, []);
}

function renderLanguageBadges(languages = []) {
  const list = languages.map(language => typeof language === 'string' ? langsData.find(l => l._id === language) : language).filter(Boolean);
  return list.length ? list.map(l => `<span class="badge badge-cyan" style="margin:2px">${l.name}</span>`).join('') : '—';
}

function syncDefaultLanguageOptions() {
  const select = document.getElementById('f-defaultLanguageId');
  if (!select) return;
  const selected = select.value || select.dataset.selected || '';
  const checkedIds = [...document.querySelectorAll('.board-language-check:checked')].map(el => el.value);
  select.innerHTML = '<option value="">Select Default</option>' + checkedIds.map(id => {
    const lang = langsData.find(l => l._id === id);
    return `<option value="${id}" ${id === selected ? 'selected' : ''}>${lang?.name || id}</option>`;
  }).join('');
  if (!select.value && checkedIds.length) select.value = checkedIds[0];
  select.dataset.selected = select.value;
}

function translationForLanguage(translations = [], languageId) {
  return (translations || []).find(t => getId(t.languageId) === languageId) || {};
}

function renderTranslationInputs(languages, translations, fields) {
  if (!languages.length) {
    return '<div class="empty-state" style="padding:14px"><p>Select a board with configured languages first.</p></div>';
  }
  return languages.map(lang => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;background:var(--surface2)">
      <div style="font-size:12px;font-weight:600;color:var(--cyan);margin-bottom:10px">${lang.name}${lang.code ? ` (${lang.code})` : ''}</div>
      <div style="display:grid;grid-template-columns:1fr;gap:10px">
        ${fields.map(field => {
          const existing = translationForLanguage(translations, lang._id);
          const rawValue = Array.isArray(existing[field.key]) ? existing[field.key].join('\n') : existing[field.key] || '';
          const id = `tr-${lang._id}-${field.key}`;
          const label = `${field.label}${field.required ? ' *' : ''}`;
          if (field.type === 'textarea') {
            return `<div class="form-group"><label>${label}</label><textarea id="${id}" rows="${field.rows || 2}" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(rawValue)}</textarea></div>`;
          }
          return `<div class="form-group"><label>${label}</label><input id="${id}" value="${escapeHtml(rawValue)}" /></div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function collectTranslations(languages, requiredFields, lineArrayFields = []) {
  if (!languages.length) throw new Error('Selected board has no configured languages');
  return languages.map(lang => {
    const translation = { languageId: lang._id };
    for (const field of requiredFields) {
      const el = document.getElementById(`tr-${lang._id}-${field}`);
      let value = el ? el.value.trim() : '';
      if (lineArrayFields.includes(field)) {
        translation[field] = value.split('\n').map(s => s.trim()).filter(Boolean);
      } else {
        translation[field] = value;
      }
    }
    if (!translation.question && requiredFields.includes('question')) throw new Error(`Question is required for ${lang.name}`);
    if (!translation.answer && requiredFields.includes('answer')) throw new Error(`Answer is required for ${lang.name}`);
    if (!translation.name && requiredFields.includes('name')) throw new Error(`Name is required for ${lang.name}`);
    return translation;
  });
}

function refreshChapterTranslationInputs(boardId, subjectId = '') {
  const container = document.getElementById('chapter-translation-fields');
  if (!container) return;
  container.innerHTML = renderTranslationInputs(getContentLanguagesBySubjectId(subjectId, boardId), [], [{ key: 'name', label: 'Chapter Name', type: 'input', required: true }]);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============ INIT ============
if (token) {
  initDashboard();
} else {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') {
    const step2 = document.getElementById('login-step-2');
    if (step2 && step2.style.display !== 'none') {
      handleVerifyOTP();
    } else {
      handleSendOTP();
    }
  }
});
