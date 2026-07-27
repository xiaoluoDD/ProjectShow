(function () {
  const detailRoot = document.getElementById('detailRoot');
  const actionBar = document.getElementById('actionBar');
  const btnSubtasks = document.getElementById('btnSubtasks');
  const btnComplete = document.getElementById('btnComplete');
  const btnDeleteProject = document.getElementById('btnDeleteProject');
  const editHint = document.getElementById('editHint');
  const completeModal = document.getElementById('completeModal');
  const completeTitle = document.getElementById('completeTitle');
  const completeHint = document.getElementById('completeHint');
  const completeDate = document.getElementById('completeDate');
  const completeError = document.getElementById('completeError');
  const btnCompleteCancel = document.getElementById('btnCompleteCancel');
  const btnCompleteSave = document.getElementById('btnCompleteSave');

  const id = queryParam('id');
  if (!id) {
    showError(detailRoot, '缺少项目 id');
    return;
  }

  let currentProject = null;
  let saving = false;

  btnSubtasks.href = `subtasks.html?project_id=${encodeURIComponent(id)}`;

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function hasEndDate(project) {
    return !!(project && String(project.end_date || '').trim());
  }

  function canEdit() {
    return !!(window.Auth && window.Auth.canEditProjects());
  }

  function refreshActionButtons() {
    if (!currentProject) {
      btnComplete.hidden = true;
      if (btnDeleteProject) btnDeleteProject.hidden = true;
      editHint.hidden = true;
      return;
    }
    const editable = canEdit();
    btnComplete.hidden = !editable;
    if (btnDeleteProject) btnDeleteProject.hidden = !editable;
    editHint.hidden = editable;
    if (!editable) return;
    btnComplete.textContent = hasEndDate(currentProject) ? '修改完结日期' : '标记完结';
  }

  function renderDetail(project) {
    currentProject = project;
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
    refreshActionButtons();
  }

  async function deleteCurrentProject() {
    if (!currentProject || !canEdit() || !btnDeleteProject) return;
    const name = displayOrDash(currentProject.name);
    if (!confirm(`确定删除项目「${name}」？\n子任务等关联数据也会一并删除，且不可恢复。`)) {
      return;
    }
    btnDeleteProject.disabled = true;
    try {
      await deleteProject(currentProject.id);
      window.location.href = 'index.html?view=projects';
    } catch (err) {
      alert(err.message || '删除失败');
      btnDeleteProject.disabled = false;
    }
  }

  function openCompleteModal() {
    if (!currentProject || !canEdit()) return;
    completeError.hidden = true;
    completeError.textContent = '';
    const editing = hasEndDate(currentProject);
    completeTitle.textContent = editing ? '修改完结日期' : '标记完结';
    completeHint.textContent = editing
      ? '修改实际完结日期。若需取消完结，请在桌面端清空该日期。'
      : '填写实际完结日期后，项目状态将变为「已完结」。';
    completeDate.value = editing
      ? String(currentProject.end_date || '').trim() || todayIso()
      : todayIso();
    completeModal.hidden = false;
  }

  function closeCompleteModal() {
    completeModal.hidden = true;
  }

  function projectToUpdatePayload(project, endDate) {
    return {
      id: project.id,
      year: project.year || '',
      work_no: project.work_no || '',
      name: project.name || '',
      manager_userid: project.manager_userid || '',
      manager_name: project.manager_name || '',
      group_chat: project.group_chat || '',
      group_chat_id: project.group_chat_id || '',
      start_date: project.start_date || '',
      end_date: endDate,
      tasks: project.tasks || '',
    };
  }

  async function saveCompleteDate() {
    if (saving || !currentProject) return;
    const date = (completeDate.value || '').trim();
    if (!date) {
      completeError.textContent = '请选择实际完结日期';
      completeError.hidden = false;
      return;
    }

    saving = true;
    btnCompleteSave.disabled = true;
    completeError.hidden = true;
    try {
      const data = await updateProject(projectToUpdatePayload(currentProject, date));
      closeCompleteModal();
      renderDetail(data.project || currentProject);
    } catch (err) {
      completeError.textContent = err.message || '保存失败';
      completeError.hidden = false;
    } finally {
      saving = false;
      btnCompleteSave.disabled = false;
    }
  }

  async function loadDetail() {
    showLoading(detailRoot, '正在加载详情…');
    try {
      if (window.Auth && typeof window.Auth.refreshMe === 'function') {
        await window.Auth.refreshMe();
      }
      const data = await fetchProject(id);
      renderDetail(data.project || {});
    } catch (err) {
      showError(detailRoot, err.message || '加载失败');
      actionBar.hidden = true;
      btnComplete.hidden = true;
      if (btnDeleteProject) btnDeleteProject.hidden = true;
      editHint.hidden = true;
    }
  }

  btnComplete.addEventListener('click', openCompleteModal);
  if (btnDeleteProject) {
    btnDeleteProject.addEventListener('click', deleteCurrentProject);
  }
  btnCompleteCancel.addEventListener('click', closeCompleteModal);
  btnCompleteSave.addEventListener('click', saveCompleteDate);
  completeModal.addEventListener('click', (e) => {
    if (e.target === completeModal) closeCompleteModal();
  });
  document.addEventListener('authchange', refreshActionButtons);

  loadDetail();
})();
