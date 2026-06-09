function escapeHtml(text) {
  const s = String(text ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayOrDash(text) {
  const s = String(text ?? '').trim();
  return s || '—';
}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function managerText(project) {
  const name = (project.manager_name || '').trim();
  const id = (project.manager_userid || '').trim();
  if (name && id && name !== id) return `${name}（${id}）`;
  return name || id || '—';
}

function membersSummary(members, maxNames) {
  if (!Array.isArray(members) || members.length === 0) return '—';
  const names = members.map((m) => {
    const n = (m.name || '').trim();
    const id = (m.userid || '').trim();
    return n || id || '—';
  });
  const limit = maxNames ?? 3;
  if (names.length <= limit) return names.join('、');
  return `${names.slice(0, limit).join('、')} 等 ${members.length} 人`;
}

function formatMembersBlock(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return '<p class="muted">（暂无项目成员）</p>';
  }
  const rows = members
    .map((m) => {
      const name = displayOrDash(m.name);
      const id = displayOrDash(m.userid);
      return `<div class="member-row"><span>${escapeHtml(name)}</span><span class="muted">${escapeHtml(id)}</span></div>`;
    })
    .join('');
  return `<div class="member-list">${rows}</div>`;
}

function subtaskMembersText(members) {
  return membersSummary(members, 5);
}

function ownerText(subtask) {
  const name = (subtask.owner_name || '').trim();
  const id = (subtask.owner_userid || '').trim();
  if (name && id && name !== id) return `${name}（${id}）`;
  return name || id || '—';
}

function showLoading(el, text) {
  el.innerHTML = `<div class="state-box"><div class="spinner"></div><p>${escapeHtml(text || '加载中…')}</p></div>`;
}

function showError(el, text) {
  el.innerHTML = `<div class="state-box error"><p>${escapeHtml(text || '加载失败')}</p></div>`;
}
