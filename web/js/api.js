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
