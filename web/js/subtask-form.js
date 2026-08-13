(function () {
  const DEPT_PLACEHOLDER = '__pick__';
  const DEPT_UNASSIGNED = '0';
  const META_TIMEOUT_MS = 12000;

  const btnAddSubtask = document.getElementById('btnAddSubtask');
  const subtaskModal = document.getElementById('subtaskModal');
  const subtaskContent = document.getElementById('subtaskContent');
  const subtaskOwnerLabel = document.getElementById('subtaskOwnerLabel');
  const subtaskMemberDept = document.getElementById('subtaskMemberDept');
  const subtaskMemberList = document.getElementById('subtaskMemberList');
  const subtaskSelectedCount = document.getElementById('subtaskSelectedCount');
  const subtaskSelectedSummary = document.getElementById('subtaskSelectedSummary');
  const subtaskStatus = document.getElementById('subtaskStatus');
  const subtaskPlannedStart = document.getElementById('subtaskPlannedStart');
  const subtaskActualStart = document.getElementById('subtaskActualStart');
  const subtaskPlannedEnd = document.getElementById('subtaskPlannedEnd');
  const subtaskActualEnd = document.getElementById('subtaskActualEnd');
  const subtaskRemark = document.getElementById('subtaskRemark');
  const subtaskFormError = document.getElementById('subtaskFormError');
  const btnSubtaskCancel = document.getElementById('btnSubtaskCancel');
  const btnSubtaskSave = document.getElementById('btnSubtaskSave');

  const projectId = queryParam('project_id');

  if (!subtaskModal) {
    console.error('[subtask-form] 缺少 #subtaskModal');
    return;
  }
  if (!projectId) return;

  let allUsers = [];
  let allDepartments = [];
  let currentProject = null;
  /** @type {Record<string, string>} */
  let selectedMembers = {};
  let saving = false;
  let loadingMeta = false;

  function canEdit() {
    if (window.Auth && window.Auth.canEditProjects()) return true;
    try {
      const raw = localStorage.getItem('projectshow_auth_user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      return !!(user && user.can_edit_projects);
    } catch (e) {
      return false;
    }
  }

  function refreshAddButton() {
    // 显隐由 subtasks.js 统一控制
  }

  function ensureCanEdit() {
    if (canEdit()) return true;
    const goLogin = confirm('新增子任务需要先登录且具备编辑权限。是否前往登录？');
    if (goLogin) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `index.html?view=projects&login=1&return=${returnTo}`;
    }
    return false;
  }

  function formatOwnerLabel(project) {
    if (!project) return '（项目未设置负责人）';
    const mgrId = (project.manager_userid || '').trim();
    const mgrName = (project.manager_name || '').trim();
    if (!mgrId && !mgrName) return '（项目未设置负责人）';
    if (!mgrName) return mgrId;
    if (!mgrId) return mgrName;
    return `${mgrName}（${mgrId}）`;
  }

  function userLabel(user) {
    const userid = (user.userid || '').trim();
    const name = (user.name || '').trim();
    if (name && userid && name !== userid) return `${name} (${userid})`;
    return name || userid || '—';
  }

  function userDeptId(user) {
    const id = Number(user && user.department_id);
    return Number.isFinite(id) ? id : 0;
  }

  function departmentIdForUser(userid) {
    if (!userid) return null;
    const u = allUsers.find((x) => (x.userid || '').trim() === userid);
    if (!u) return null;
    return userDeptId(u);
  }

  function showError(msg) {
    subtaskFormError.textContent = msg || '操作失败';
    subtaskFormError.hidden = false;
  }

  function clearError() {
    subtaskFormError.hidden = true;
    subtaskFormError.textContent = '';
  }

  function fillDepartmentSelect(select) {
    const opts = [
      `<option value="${DEPT_PLACEHOLDER}">（请先选择部门）</option>`,
    ].concat(
      allDepartments.map(
        (d) =>
          `<option value="${escapeHtml(String(d.id))}">${escapeHtml(d.name || '')}</option>`
      )
    );
    opts.push(`<option value="${DEPT_UNASSIGNED}">（未分配）</option>`);
    select.innerHTML = opts.join('');
  }

  function updateSelectedSummary() {
    const entries = Object.keys(selectedMembers).map((id) => {
      const name = (selectedMembers[id] || '').trim();
      return name || id;
    });
    subtaskSelectedCount.textContent = `已选成员：${entries.length} 人`;
    subtaskSelectedSummary.textContent = entries.length
      ? entries.join('、')
      : '（暂无）';
  }

  function syncSelectionsFromList() {
    subtaskMemberList.querySelectorAll('input[type="checkbox"][data-userid]').forEach((cb) => {
      const userid = cb.getAttribute('data-userid');
      if (!userid) return;
      if (cb.checked) {
        selectedMembers[userid] = cb.getAttribute('data-name') || '';
      } else {
        delete selectedMembers[userid];
      }
    });
    updateSelectedSummary();
  }

  function refreshMemberList() {
    syncSelectionsFromList();
    const deptRaw = subtaskMemberDept.value;
    subtaskMemberList.innerHTML = '';

    if (deptRaw === DEPT_PLACEHOLDER || deptRaw === '') {
      subtaskMemberList.innerHTML =
        '<p class="muted member-empty">请先在上方选择部门</p>';
      return;
    }

    const deptId = Number(deptRaw);
    const inDept = allUsers.filter((u) => userDeptId(u) === deptId);
    if (!inDept.length) {
      subtaskMemberList.innerHTML =
        '<p class="muted member-empty">该部门暂无成员</p>';
      return;
    }

    inDept.forEach((u) => {
      const userid = (u.userid || '').trim();
      if (!userid) return;
      const name = (u.name || '').trim();
      const label = document.createElement('label');
      label.className = 'member-check-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-userid', userid);
      cb.setAttribute('data-name', name);
      cb.checked = Object.prototype.hasOwnProperty.call(selectedMembers, userid);
      cb.addEventListener('change', () => {
        if (cb.checked) selectedMembers[userid] = name;
        else delete selectedMembers[userid];
        updateSelectedSummary();
      });
      const span = document.createElement('span');
      span.textContent = userLabel(u);
      label.appendChild(cb);
      label.appendChild(span);
      subtaskMemberList.appendChild(label);
    });
  }

  function preselectMemberDepartment() {
    let deptId = null;
    const firstSelected = Object.keys(selectedMembers)[0];
    if (firstSelected) {
      deptId = departmentIdForUser(firstSelected);
    } else if (currentProject && currentProject.manager_userid) {
      deptId = departmentIdForUser(String(currentProject.manager_userid).trim());
    }
    if (deptId == null) return;
    const value = String(deptId);
    const exists = [...subtaskMemberDept.options].some((o) => o.value === value);
    if (exists) {
      subtaskMemberDept.value = value;
      refreshMemberList();
    }
  }

  function resetFormBasics() {
    clearError();
    subtaskContent.value = '';
    subtaskStatus.value = '待启动';
    subtaskPlannedStart.value = '';
    subtaskActualStart.value = '';
    subtaskPlannedEnd.value = '';
    subtaskActualEnd.value = '';
    subtaskRemark.value = '';
    selectedMembers = {};
    subtaskOwnerLabel.textContent = formatOwnerLabel(currentProject);
    updateSelectedSummary();
  }

  function applyMetaToForm() {
    fillDepartmentSelect(subtaskMemberDept);
    subtaskMemberDept.value = DEPT_PLACEHOLDER;
    refreshMemberList();
    preselectMemberDepartment();
  }

  function setMetaLoading() {
    subtaskMemberDept.innerHTML = '<option value="">加载中…</option>';
    subtaskMemberDept.disabled = true;
    subtaskMemberList.innerHTML =
      '<p class="muted member-empty">正在加载部门与成员…</p>';
  }

  function setMetaReady() {
    subtaskMemberDept.disabled = false;
  }

  function closeModal() {
    subtaskModal.hidden = true;
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label}超时（${Math.round(ms / 1000)}s）`));
      }, ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }

  async function loadMeta() {
    const [projData, deptData, userData] = await Promise.all([
      withTimeout(fetchProject(projectId), META_TIMEOUT_MS, '项目信息'),
      withTimeout(fetchDepartments(), META_TIMEOUT_MS, '部门列表'),
      withTimeout(fetchWecomUsers(), META_TIMEOUT_MS, '成员列表'),
    ]);
    currentProject = projData.project || null;
    allDepartments = deptData.departments || [];
    allUsers = userData.users || [];
  }

  async function openCreateModal() {
    if (!ensureCanEdit()) return;
    if (loadingMeta) return;

    loadingMeta = true;
    if (btnAddSubtask) btnAddSubtask.disabled = true;

    resetFormBasics();
    setMetaLoading();
    subtaskModal.hidden = false;
    setTimeout(() => {
      try {
        subtaskContent.focus();
      } catch (e) {
        /* ignore */
      }
    }, 50);

    try {
      await loadMeta();
      setMetaReady();
      resetFormBasics();
      applyMetaToForm();
      clearError();
    } catch (err) {
      allDepartments = [];
      allUsers = [];
      setMetaReady();
      applyMetaToForm();
      showError(
        (err && err.message) ||
          '加载部门/成员失败。仍可填写内容与日期创建；选人需 Nginx 已反代相关接口'
      );
    } finally {
      loadingMeta = false;
      if (btnAddSubtask) btnAddSubtask.disabled = false;
    }
  }

  function buildPayload() {
    const project = currentProject || {};
    const members = Object.keys(selectedMembers).map((userid) => ({
      userid,
      name: selectedMembers[userid] || '',
    }));
    return {
      project_id: Number(projectId),
      content: (subtaskContent.value || '').trim(),
      owner_userid: (project.manager_userid || '').trim(),
      owner_name: (project.manager_name || '').trim(),
      status: (subtaskStatus.value || '').trim(),
      planned_start_date: (subtaskPlannedStart.value || '').trim(),
      actual_start_date: (subtaskActualStart.value || '').trim(),
      planned_end_date: (subtaskPlannedEnd.value || '').trim(),
      actual_end_date: (subtaskActualEnd.value || '').trim(),
      remark: (subtaskRemark.value || '').trim(),
      members,
    };
  }

  async function saveCreate() {
    if (saving) return;
    syncSelectionsFromList();
    const payload = buildPayload();
    if (!payload.content) {
      showError('任务内容不能为空');
      return;
    }

    saving = true;
    btnSubtaskSave.disabled = true;
    clearError();
    try {
      const data = await createSubtask(payload);
      closeModal();
      if (data && data.project_completion_cleared) {
        alert(data.msg || '子任务已创建；项目原已完结，已清空实际完结日期并更新项目状态');
      }
      if (window.SubtasksApp && typeof window.SubtasksApp.reload === 'function') {
        await window.SubtasksApp.reload();
      } else {
        window.location.reload();
      }
    } catch (err) {
      showError(err.message || '创建失败');
    } finally {
      saving = false;
      btnSubtaskSave.disabled = false;
    }
  }

  btnSubtaskCancel.addEventListener('click', closeModal);
  btnSubtaskSave.addEventListener('click', saveCreate);
  subtaskModal.addEventListener('click', (e) => {
    if (e.target === subtaskModal) closeModal();
  });
  subtaskMemberDept.addEventListener('change', refreshMemberList);

  // 点击由 subtasks.js 统一绑定并控制显隐，避免旧 HTML / 脚本加载顺序问题
  window.SubtaskFormApp = { openCreate: openCreateModal };
})();
