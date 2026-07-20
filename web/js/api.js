function apiBase() {
  const base = (window.APP_CONFIG && window.APP_CONFIG.apiBase) || '';
  return base.replace(/\/+$/, '');
}

async function apiGet(path) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data || data.ok === false) {
    throw new Error((data && data.error) || '接口返回失败');
  }
  return data;
}

function fetchProjects() {
  return apiGet('/api/projects');
}

function fetchProject(id) {
  return apiGet(`/api/projects?id=${encodeURIComponent(id)}`);
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
