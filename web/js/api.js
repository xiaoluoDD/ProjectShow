function apiBase() {
  const base = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '';
  return base.replace(/\/+$/, '');
}

function authHeaders(extra) {
  const headers = Object.assign({ Accept: 'application/json' }, extra || {});
  if (window.Auth && typeof window.Auth.setAuthHeaders === 'function') {
    return window.Auth.setAuthHeaders(headers);
  }
  return headers;
}

async function apiGet(path) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { method: 'GET', headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
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

function updateProject(payload) {
  return apiPut('/api/projects', payload);
}

function fetchSubtasks(projectId) {
  return apiGet(`/api/project-subtasks?project_id=${encodeURIComponent(projectId)}`);
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
