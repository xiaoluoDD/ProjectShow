(function () {
  const taskRoot = document.getElementById('taskRoot');
  const summaryBar = document.getElementById('summaryBar');
  const pageTitle = document.getElementById('pageTitle');

  const userid = (queryParam('userid') || '').trim();
  const name = (queryParam('name') || '').trim();
  const status = (queryParam('status') || '').trim();
  const year = (queryParam('year') || '').trim();

  if (!userid && !name) {
    showError(taskRoot, '缺少责任人参数');
    summaryBar.textContent = '';
    return;
  }

  const titleName = name || userid;
  pageTitle.textContent = status ? `${titleName} · ${status}` : titleName;
  document.title = `相关任务 — ${titleName}`;

  document.getElementById('btnRefresh').addEventListener('click', loadTasks);

  function roleLabel(role) {
    if (role === 'subtask_owner') return '子任务负责人';
    if (role === 'project_manager') return '项目负责人';
    return role || '—';
  }

  function renderCard(task) {
    const projectId = task.project_id;
    const href = `subtasks.html?project_id=${encodeURIComponent(projectId)}&from=dashboard${
      status ? `&status=${encodeURIComponent(status)}` : ''
    }`;
    return `
      <a class="project-card" href="${href}">
        <div class="card-top">
          <span class="card-meta">${escapeHtml(task.work_no || '—')} · ${escapeHtml(task.project_name || '—')}</span>
          ${statusBadgeHtml(task.status)}
        </div>
        <h2 class="card-title">${escapeHtml(displayOrDash(task.content))}</h2>
        <div class="card-row"><span class="label">责任类型：</span>${escapeHtml(roleLabel(task.role))}</div>
        <div class="card-foot">查看项目子任务 ›</div>
      </a>
    `;
  }

  async function loadTasks() {
    showLoading(taskRoot, '正在加载相关任务…');
    summaryBar.textContent = '加载中…';
    try {
      const data = await fetchDashboardPersonTasks({ userid, name, status, year });
      const tasks = data.tasks || [];
      summaryBar.textContent = `共 ${tasks.length} 条相关任务（只读）`;
      if (!tasks.length) {
        taskRoot.innerHTML = '<div class="state-box"><p>暂无相关任务</p></div>';
        return;
      }
      taskRoot.innerHTML = tasks.map(renderCard).join('');
    } catch (err) {
      showError(taskRoot, err.message || '加载失败');
      summaryBar.textContent = '加载失败';
    }
  }

  loadTasks();
})();
