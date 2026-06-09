(function () {
  const subtaskRoot = document.getElementById('subtaskRoot');
  const summaryBar = document.getElementById('summaryBar');
  const backLink = document.getElementById('backLink');
  const pageTitle = document.getElementById('pageTitle');

  const projectId = queryParam('project_id');
  if (!projectId) {
    showError(subtaskRoot, '缺少 project_id');
    summaryBar.textContent = '';
    return;
  }

  backLink.href = `project.html?id=${encodeURIComponent(projectId)}`;
  document.getElementById('btnRefresh').addEventListener('click', loadSubtasks);

  function renderSubtaskCard(st) {
    return `
      <article class="subtask-card">
        <div class="card-top">
          <span class="card-meta">#${escapeHtml(st.id)}</span>
          ${statusBadgeHtml(st.status)}
        </div>
        <h2 class="card-title">${escapeHtml(displayOrDash(st.content))}</h2>
        <div class="card-row"><span class="label">负责人：</span>${escapeHtml(ownerText(st))}</div>
        <div class="card-row"><span class="label">成员：</span>${escapeHtml(subtaskMembersText(st.members))}</div>
        <div class="card-row"><span class="label">计划开始：</span>${escapeHtml(displayOrDash(st.planned_start_date))}</div>
        <div class="card-row"><span class="label">实际开始：</span>${escapeHtml(displayOrDash(st.actual_start_date))}</div>
        <div class="card-row"><span class="label">计划完成：</span>${escapeHtml(displayOrDash(st.planned_end_date))}</div>
        <div class="card-row"><span class="label">实际完成：</span>${escapeHtml(displayOrDash(st.actual_end_date))}</div>
        ${
          (st.remark || '').trim()
            ? `<div class="card-row"><span class="label">备注：</span>${escapeHtml(st.remark)}</div>`
            : ''
        }
      </article>
    `;
  }

  async function loadSubtasks() {
    showLoading(subtaskRoot, '正在加载子任务…');
    summaryBar.textContent = '加载中…';
    try {
      const data = await fetchSubtasks(projectId);
      const list = data.subtasks || [];
      summaryBar.textContent = `共 ${list.length} 条子任务（只读）`;

      if (list.length === 0) {
        subtaskRoot.innerHTML = '<div class="state-box"><p>暂无子任务</p></div>';
        return;
      }

      subtaskRoot.innerHTML = list.map(renderSubtaskCard).join('');
    } catch (err) {
      showError(subtaskRoot, err.message || '加载失败');
      summaryBar.textContent = '加载失败';
    }
  }

  // 尝试显示项目名称（可选，失败不影响子任务列表）
  fetchProject(projectId)
    .then((data) => {
      const name = (data.project && data.project.name) || '';
      if (name) pageTitle.textContent = `子任务 · ${name}`;
    })
    .catch(() => {});

  loadSubtasks();
})();
