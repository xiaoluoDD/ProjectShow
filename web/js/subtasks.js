(function () {
  const subtaskRoot = document.getElementById('subtaskRoot');
  const summaryBar = document.getElementById('summaryBar');
  const backLink = document.getElementById('backLink');
  const pageTitle = document.getElementById('pageTitle');
  const completeModal = document.getElementById('completeModal');
  const completeTitle = document.getElementById('completeTitle');
  const completeHint = document.getElementById('completeHint');
  const completeTaskName = document.getElementById('completeTaskName');
  const completeDate = document.getElementById('completeDate');
  const completeError = document.getElementById('completeError');
  const btnCompleteCancel = document.getElementById('btnCompleteCancel');
  const btnCompleteSave = document.getElementById('btnCompleteSave');
  const btnCompleteClear = document.getElementById('btnCompleteClear');

  const projectId = queryParam('project_id');
  const statusFilter = (queryParam('status') || '').trim();
  const from = (queryParam('from') || '').trim();

  if (!projectId) {
    showError(subtaskRoot, '缺少 project_id');
    summaryBar.textContent = '';
    return;
  }

  if (from === 'dashboard') {
    backLink.href = 'index.html?view=dashboard';
    backLink.textContent = '‹ 返回总览';
  } else {
    backLink.href = `project.html?id=${encodeURIComponent(projectId)}`;
  }

  let allSubtasks = [];
  let editingSubtask = null;
  let saving = false;

  const btnRefresh = document.getElementById('btnRefresh');
  let btnAddSubtask = document.getElementById('btnAddSubtask');

  // 兼容旧版 HTML（无按钮节点时动态插入）
  if (!btnAddSubtask && btnRefresh && btnRefresh.parentNode) {
    btnAddSubtask = document.createElement('button');
    btnAddSubtask.type = 'button';
    btnAddSubtask.className = 'btn btn-primary';
    btnAddSubtask.id = 'btnAddSubtask';
    btnAddSubtask.textContent = '新增子任务';
    btnRefresh.parentNode.insertBefore(btnAddSubtask, btnRefresh);
  }

  function openAddSubtask() {
    function tryOpen() {
      if (window.SubtaskFormApp && typeof window.SubtaskFormApp.openCreate === 'function') {
        window.SubtaskFormApp.openCreate();
        return true;
      }
      return false;
    }
    if (tryOpen()) return;

    // 旧版 HTML 可能未引入 subtask-form.js，动态加载一次
    if (!document.querySelector('script[data-subtask-form]')) {
      const s = document.createElement('script');
      s.src = 'js/subtask-form.js?v=1.2.19';
      s.setAttribute('data-subtask-form', '1');
      s.onload = () => {
        if (!tryOpen()) {
          alert('新增子任务弹窗未就绪，请确认已同步最新 subtasks.html 并强制刷新。');
        }
      };
      s.onerror = () => {
        alert('无法加载 js/subtask-form.js，请在服务器执行 update-all.sh 后强制刷新。');
      };
      document.body.appendChild(s);
      return;
    }
    alert('新增子任务脚本未加载。请确认已同步 js/subtask-form.js 并强制刷新（Ctrl+F5）。');
  }

  function refreshAddButton() {
    if (!btnAddSubtask) return;
    btnAddSubtask.hidden = !canEdit();
  }

  document.getElementById('btnRefresh').addEventListener('click', () => loadSubtasks(true));
  if (btnAddSubtask) {
    btnAddSubtask.addEventListener('click', openAddSubtask);
  }

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function canEdit() {
    if (window.Auth && window.Auth.canEditProjects()) return true;
    // 兜底：Auth 尚未刷新完成时，读本地缓存用户权限
    try {
      const raw = localStorage.getItem('projectshow_auth_user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      return !!(user && user.can_edit_projects);
    } catch (e) {
      return false;
    }
  }

  function ensureCanEdit() {
    if (canEdit()) return true;
    const goLogin = confirm('标记完结需要先登录。是否前往登录？');
    if (goLogin) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `index.html?view=projects&login=1&return=${returnTo}`;
    }
    return false;
  }

  function hasActualEnd(st) {
    return !!(st && String(st.actual_end_date || '').trim());
  }

  function effectiveStatus(st) {
    return (st.status || '').trim();
  }

  function filteredList() {
    if (!statusFilter) return allSubtasks.slice();
    return allSubtasks.filter((st) => effectiveStatus(st) === statusFilter);
  }

  function subtaskToPayload(st, actualEndDate) {
    return {
      id: st.id,
      project_id: st.project_id || Number(projectId),
      content: st.content || '',
      owner_userid: st.owner_userid || '',
      owner_name: st.owner_name || '',
      status: st.status || '',
      planned_start_date: st.planned_start_date || '',
      actual_start_date: st.actual_start_date || '',
      planned_end_date: st.planned_end_date || '',
      actual_end_date: actualEndDate,
      remark: st.remark || '',
      members: Array.isArray(st.members) ? st.members : [],
    };
  }

  function openCompleteModal(st) {
    if (!st || !completeModal) return;
    if (!ensureCanEdit()) return;
    editingSubtask = st;
    completeError.hidden = true;
    completeError.textContent = '';
    const editing = hasActualEnd(st);
    completeTitle.textContent = editing ? '修改实际完成日期' : '标记子任务完结';
    completeHint.textContent = editing
      ? '可修改实际完成日期；清空日期可取消「已完结」。'
      : '填写实际完成日期后，该子任务将视为已完结。';
    completeTaskName.textContent = `任务：${displayOrDash(st.content)}`;
    completeDate.value = editing
      ? String(st.actual_end_date || '').trim() || todayIso()
      : todayIso();
    if (btnCompleteClear) btnCompleteClear.hidden = !editing;
    completeModal.hidden = false;
  }

  function closeCompleteModal() {
    completeModal.hidden = true;
    editingSubtask = null;
  }

  async function saveCompleteDate(forceEmpty) {
    if (saving || !editingSubtask || !btnCompleteSave) return;
    const date = forceEmpty ? '' : (completeDate.value || '').trim();
    if (!forceEmpty && !date) {
      completeError.textContent = '请选择实际完成日期，或点「清空完成日期」取消完结';
      completeError.hidden = false;
      return;
    }
    saving = true;
    btnCompleteSave.disabled = true;
    if (btnCompleteClear) btnCompleteClear.disabled = true;
    completeError.hidden = true;
    try {
      const data = await updateSubtask(subtaskToPayload(editingSubtask, date));
      const updated = data.subtask || null;
      if (updated && updated.id) {
        const idx = allSubtasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) allSubtasks[idx] = updated;
      } else {
        await loadSubtasks(true);
        closeCompleteModal();
        return;
      }
      closeCompleteModal();
      renderList();
    } catch (err) {
      completeError.textContent = err.message || '保存失败';
      completeError.hidden = false;
    } finally {
      saving = false;
      btnCompleteSave.disabled = false;
      if (btnCompleteClear) btnCompleteClear.disabled = false;
    }
  }

  function renderSubtaskCard(st) {
    const done = hasActualEnd(st);
    const editable = canEdit();
    const completeBtn = `<button type="button" class="btn btn-sm ${done ? '' : 'btn-primary'}" data-complete-id="${st.id}">
           ${done ? '修改完成日期' : '标记完结'}
         </button>`;
    const editBtn = editable
      ? `<button type="button" class="btn btn-sm" data-edit-subtask="${st.id}">编辑</button>`
      : '';
    const deleteBtn = editable
      ? `<button type="button" class="btn btn-sm btn-danger" data-del-subtask="${st.id}">删除</button>`
      : '';

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
        <div class="account-actions">${editBtn}${completeBtn}${deleteBtn}</div>
      </article>
    `;
  }

  async function deleteOneSubtask(st, btn) {
    if (!st || !canEdit()) return;
    const name = displayOrDash(st.content);
    if (!confirm(`确定删除子任务「${name}」？\n此操作不可恢复。`)) return;
    if (btn) btn.disabled = true;
    try {
      await deleteSubtask(st.id);
      allSubtasks = allSubtasks.filter((x) => x.id !== st.id);
      renderList();
    } catch (err) {
      alert(err.message || '删除失败');
      if (btn) btn.disabled = false;
    }
  }

  function renderList() {
    const list = filteredList();
    const editable = canEdit();
    refreshAddButton();
    if (statusFilter) {
      summaryBar.textContent = editable
        ? `状态「${statusFilter}」共 ${list.length} 条 · 可新增 / 编辑 / 标记完结 / 删除`
        : `状态「${statusFilter}」共 ${list.length} 条 · 未登录仅可查看，点「标记完结」将提示登录`;
    } else {
      summaryBar.textContent = editable
        ? `共 ${list.length} 条子任务 · 可新增 / 编辑 / 标记完结 / 删除`
        : `共 ${list.length} 条子任务 · 未登录，点卡片上的「标记完结」可去登录`;
    }

    if (list.length === 0) {
      if (editable) {
        subtaskRoot.innerHTML = `
          <div class="state-box">
            <p>暂无子任务</p>
            <p style="margin-top:12px">
              <button type="button" class="btn btn-primary" id="btnAddSubtaskEmpty">新增子任务</button>
            </p>
          </div>`;
        const emptyBtn = document.getElementById('btnAddSubtaskEmpty');
        if (emptyBtn) emptyBtn.addEventListener('click', openAddSubtask);
      } else {
        subtaskRoot.innerHTML = '<div class="state-box"><p>暂无子任务</p></div>';
      }
      return;
    }

    subtaskRoot.innerHTML = list.map(renderSubtaskCard).join('');
    subtaskRoot.querySelectorAll('[data-complete-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = Number(btn.getAttribute('data-complete-id'));
        const st = allSubtasks.find((x) => x.id === sid);
        if (st) openCompleteModal(st);
      });
    });
    subtaskRoot.querySelectorAll('[data-edit-subtask]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = Number(btn.getAttribute('data-edit-subtask'));
        const st = allSubtasks.find((x) => x.id === sid);
        if (!st) return;
        if (window.SubtaskFormApp && typeof window.SubtaskFormApp.openEdit === 'function') {
          window.SubtaskFormApp.openEdit(st);
        } else {
          alert('编辑表单未加载，请强制刷新后重试');
        }
      });
    });
    subtaskRoot.querySelectorAll('[data-del-subtask]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = Number(btn.getAttribute('data-del-subtask'));
        const st = allSubtasks.find((x) => x.id === sid);
        if (st) deleteOneSubtask(st, btn);
      });
    });
  }

  async function loadSubtasks() {
    showLoading(subtaskRoot, '正在加载子任务…');
    summaryBar.textContent = '加载中…';
    try {
      // 与 fetchSubtasks 并行校验登录态，避免 /api/auth/me 慢或不可达时阻塞列表
      const refresh = window.Auth && typeof window.Auth.refreshMe === 'function'
        ? window.Auth.refreshMe()
        : Promise.resolve();
      const [data] = await Promise.all([fetchSubtasks(projectId), refresh]);
      allSubtasks = data.subtasks || [];
      renderList();
    } catch (err) {
      showError(subtaskRoot, err.message || '加载失败');
      summaryBar.textContent = '加载失败';
    }
  }

  fetchProject(projectId)
    .then((data) => {
      const name = (data.project && data.project.name) || '';
      if (name) {
        pageTitle.textContent = statusFilter
          ? `子任务 · ${name}（${statusFilter}）`
          : `子任务 · ${name}`;
      } else if (statusFilter) {
        pageTitle.textContent = `子任务（${statusFilter}）`;
      }
    })
    .catch(() => {
      if (statusFilter) pageTitle.textContent = `子任务（${statusFilter}）`;
    });

  loadSubtasks();

  if (btnCompleteCancel && btnCompleteSave && completeModal) {
    btnCompleteCancel.addEventListener('click', closeCompleteModal);
    btnCompleteSave.addEventListener('click', () => saveCompleteDate(false));
    if (btnCompleteClear) {
      btnCompleteClear.addEventListener('click', () => {
        if (!confirm('确定清空实际完成日期？该子任务将不再视为已完结。')) return;
        saveCompleteDate(true);
      });
    }
    completeModal.addEventListener('click', (e) => {
      if (e.target === completeModal) closeCompleteModal();
    });
  }
  document.addEventListener('authchange', () => {
    refreshAddButton();
    renderList();
  });

  refreshAddButton();

  window.SubtasksApp = {
    reload: () => loadSubtasks(),
  };
})();
