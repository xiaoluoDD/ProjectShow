(function () {
  const detailRoot = document.getElementById('detailRoot');
  const actionBar = document.getElementById('actionBar');
  const btnSubtasks = document.getElementById('btnSubtasks');

  const id = queryParam('id');
  if (!id) {
    showError(detailRoot, '缺少项目 id');
    return;
  }

  btnSubtasks.href = `subtasks.html?project_id=${encodeURIComponent(id)}`;

  function renderDetail(project) {
    document.title = project.name ? `项目详情 — ${project.name}` : '项目详情';

    const rows = [
      ['年度', displayOrDash(project.year)],
      ['工番号', displayOrDash(project.work_no)],
      ['项目名称', displayOrDash(project.name)],
      ['项目负责人', managerText(project)],
      ['项目成员', formatMembersBlock(project.members)],
      ['项目状态', statusBadgeHtml(project.status)],
      ['启动日期', displayOrDash(project.start_date)],
      ['实际完结日期', displayOrDash(project.end_date)],
      ['项目任务', displayOrDash(project.task_summary || project.tasks)],
    ];

    if ((project.group_chat || '').trim()) {
      rows.push(['关联群聊', displayOrDash(project.group_chat)]);
    }

    const subCount = project.subtask_count ?? 0;
    if (subCount > 0) {
      rows.push(['子任务数量', `${subCount} 项`]);
    }

    detailRoot.innerHTML = `
      <div class="detail-card">
        ${rows
          .map(([label, value]) => {
            const isHtml = label === '项目成员' || label === '项目状态';
            return `
              <div class="detail-row">
                <div class="detail-label">${escapeHtml(label)}</div>
                <div class="detail-value">${isHtml ? value : escapeHtml(String(value))}</div>
              </div>`;
          })
          .join('')}
      </div>
    `;

    actionBar.hidden = false;
    btnSubtasks.textContent = subCount > 0 ? `查看子任务（${subCount}）` : '查看子任务';
  }

  async function loadDetail() {
    showLoading(detailRoot, '正在加载详情…');
    try {
      const data = await fetchProject(id);
      renderDetail(data.project || {});
    } catch (err) {
      showError(detailRoot, err.message || '加载失败');
      actionBar.hidden = true;
    }
  }

  loadDetail();
})();
