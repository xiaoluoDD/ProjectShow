(function () {
  const taskRoot = document.getElementById('taskRoot');
  const summaryBar = document.getElementById('summaryBar');
  const pageTitle = document.getElementById('pageTitle');

  const departmentId = (queryParam('department_id') || '').trim();
  const departmentName = (queryParam('department_name') || '').trim();
  const year = (queryParam('year') || '').trim();
  const kind = (queryParam('kind') || '').trim();

  if (departmentId === '' && !departmentName) {
    showError(taskRoot, '缺少部门参数');
    summaryBar.textContent = '';
    return;
  }

  const kindTitle = {
    not_due: '未到期',
    on_time: '准时',
    late: '不准时',
    scored: '计入准时率',
  }[kind] || '';
  const titleName = departmentName || '部门';
  pageTitle.textContent = kindTitle ? `${titleName} · ${kindTitle}` : `${titleName} · 部门准时率`;
  document.title = `部门准时率 — ${titleName}`;

  document.getElementById('btnRefresh').addEventListener('click', loadTasks);

  function renderCard(task) {
    const href = `subtasks.html?project_id=${encodeURIComponent(task.project_id)}&from=dashboard`;
    return `
      <a class="project-card" href="${href}">
        <div class="card-top">
          <span class="card-meta">${escapeHtml(task.work_no || '—')} · ${escapeHtml(task.project_name || '—')}</span>
          ${statusBadgeHtml(task.status)}
        </div>
        <h2 class="card-title">${escapeHtml(displayOrDash(task.content))}</h2>
        <div class="card-row"><span class="label">准时情况：</span>${escapeHtml(task.punctuality || '—')}</div>
        <div class="card-row"><span class="label">计划完成：</span>${escapeHtml(displayOrDash(task.planned_end_date))}</div>
        <div class="card-row"><span class="label">实际完成：</span>${escapeHtml(displayOrDash(task.actual_end_date))}</div>
        <div class="card-foot">查看项目子任务 ›</div>
      </a>
    `;
  }

  async function loadTasks() {
    showLoading(taskRoot, '正在加载部门明细…');
    summaryBar.textContent = '加载中…';
    try {
      if (typeof fetchDashboardDepartmentTasks !== 'function') {
        throw new Error('接口脚本未更新，请强制刷新或重新同步 web');
      }
      const data = await fetchDashboardDepartmentTasks({
        department_id: departmentId,
        department_name: departmentName,
        year: year,
        kind: kind,
      });
      const tasks = data.tasks || [];
      summaryBar.textContent = `共 ${tasks.length} 条子任务（只读）`;
      if (!tasks.length) {
        taskRoot.innerHTML = '<div class="state-box"><p>暂无相关子任务</p></div>';
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
