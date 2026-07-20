function apiBase() {
  const base = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '';
  return base.replace(/\/+$/, '');
}

function authHeaders(extra) {
  const headers = Object.assign({ Accept: 'application/json' }, extra || {});
  // 直接读 localStorage，避免 Auth 尚未挂载时丢 Token
  let token = '';
  try {
    token = localStorage.getItem('projectshow_auth_token') || '';
  } catch (e) {
    token = '';
  }
  if (!token && window.Auth && typeof window.Auth.getToken === 'function') {
    token = window.Auth.getToken() || '';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiGet(path) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { method: 'GET', headers: authHeaders() });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
  if (!data || data.ok === false) {
    throw new Error((data && data.error) || '接口返回失败');
  }
  return data;
}

async function apiSend(method, path, body) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body == null ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `HTTP ${res.status}`);
  }
  if (!data || data.ok === false) {
    throw new Error((data && data.error) || '接口返回失败');
  }
  return data;
}

function apiPost(path, body) {
  return apiSend('POST', path, body);
}

function apiPut(path, body) {
  return apiSend('PUT', path, body);
}

function apiDelete(path) {
  return apiSend('DELETE', path, null);
}

function fetchProjects() {
  return apiGet('/api/projects');
}

function fetchProject(id) {
  return apiGet(`/api/projects?id=${encodeURIComponent(id)}`);
}

function createProject(payload) {
  return apiPost('/api/projects', payload);
}

function updateProject(payload) {
  return apiPut('/api/projects', payload);
}

function fetchDepartments() {
  return apiGet('/api/departments');
}

function fetchWecomUsers() {
  return apiGet('/api/wecom/users');
}

function fetchSubtasks(projectId) {
  return apiGet(`/api/project-subtasks?project_id=${encodeURIComponent(projectId)}`);
}

function createSubtask(payload) {
  return apiPost('/api/project-subtasks', payload);
}

function updateSubtask(payload) {
  return apiPut('/api/project-subtasks', payload);
}

function fetchDashboardSummary(year) {
  const q = new URLSearchParams();
  if (year) q.set('year', year);
  const qs = q.toString();
  return apiGet(`/api/dashboard/summary${qs ? `?${qs}` : ''}`);
}

function fetchDashboardPersonTasks(params) {
  const q = new URLSearchParams();
  if (params.userid) q.set('userid', params.userid);
  if (params.name) q.set('name', params.name);
  if (params.status) q.set('status', params.status);
  if (params.year) q.set('year', params.year);
  return apiGet(`/api/dashboard/person-tasks?${q.toString()}`);
}

function fetchAccounts() {
  return apiGet('/api/accounts');
}

function createAccount(payload) {
  return apiPost('/api/accounts', payload);
}

function updateAccount(payload) {
  return apiPut('/api/accounts', payload);
}

function deleteAccount(id) {
  return apiDelete(`/api/accounts?id=${encodeURIComponent(id)}`);
}
