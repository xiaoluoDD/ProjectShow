(function () {
  const DEPT_PLACEHOLDER = '__pick__';
  const DEPT_UNASSIGNED = '0';
  const META_TIMEOUT_MS = 12000;

  const btnAddProject = document.getElementById('btnAddProject');
  const projectModal = document.getElementById('projectModal');
  const projectYear = document.getElementById('projectYear');
  const projectWorkNo = document.getElementById('projectWorkNo');
  const projectName = document.getElementById('projectName');
  const projectManagerDept = document.getElementById('projectManagerDept');
  const projectManager = document.getElementById('projectManager');
  const projectMemberDept = document.getElementById('projectMemberDept');
  const projectMemberList = document.getElementById('projectMemberList');
  const projectSelectedCount = document.getElementById('projectSelectedCount');
  const projectSelectedSummary = document.getElementById('projectSelectedSummary');
  const projectStartDate = document.getElementById('projectStartDate');
  const projectEndDate = document.getElementById('projectEndDate');
  const projectError = document.getElementById('projectError');
  const btnProjectCancel = document.getElementById('btnProjectCancel');
  const btnProjectSave = document.getElementById('btnProjectSave');

  if (!projectModal) {
    console.error('[project-form] 缺少 #projectModal，请同步最新 index.html');
    window.ProjectFormApp = {
      openCreate() {
        alert('新建项目弹窗未找到，请重新同步 web 并强制刷新（Ctrl+F5）');
      },
    };
    return;
  }

  let allUsers = [];
  let allDepartments = [];
  /** @type {Record<string, string>} userid -> name */
  let selectedMembers = {};
  let saving = false;
  let loadingMeta = false;
  /** @type {object|null} */
  let editingProject = null;

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function canEdit() {
    if (window.Auth && window.Auth.canEditProjects()) return true;
    try {
      const key = (window.AUTH_KEYS && window.AUTH_KEYS.user) || 'projectshow_auth_user';
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const user = JSON.parse(raw);
      return !!(user && user.can_edit_projects);
    } catch (e) {
      return false;
    }
  }

  function ensureCanEdit(actionLabel) {
    if (canEdit()) return true;
    const goLogin = confirm(
      `${actionLabel || '此操作'}需要先登录且具备编辑权限。是否前往登录？`
    );
    if (goLogin) {
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `index.html?view=projects&login=1&return=${returnTo}`;
    }
    return false;
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

  function showError(msg) {
    projectError.textContent = msg || '操作失败';
    projectError.hidden = false;
  }

  function clearError() {
    projectError.hidden = true;
    projectError.textContent = '';
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

  function refreshManagerCombo(keepUserid) {
    const deptRaw = projectManagerDept.value;
    const prevId =
      keepUserid != null ? keepUserid : projectManager.value || '';

    projectManager.innerHTML = '<option value="">（未指定）</option>';

    if (deptRaw === DEPT_PLACEHOLDER || deptRaw === '') {
      projectManager.disabled = true;
      return;
    }

    projectManager.disabled = false;
    const deptId = Number(deptRaw);
    allUsers.forEach((u) => {
      if (userDeptId(u) !== deptId) return;
      const userid = (u.userid || '').trim();
      if (!userid) return;
      const opt = document.createElement('option');
      opt.value = userid;
      opt.textContent = userLabel(u);
      opt.dataset.name = (u.name || '').trim();
      projectManager.appendChild(opt);
    });

    if (prevId) {
      const found = [...projectManager.options].some((o) => o.value === prevId);
      if (found) projectManager.value = prevId;
    }
  }

  function updateSelectedSummary() {
    const entries = Object.keys(selectedMembers).map((id) => {
      const name = (selectedMembers[id] || '').trim();
      return name || id;
    });
    projectSelectedCount.textContent = `已选成员：${entries.length} 人`;
    projectSelectedSummary.textContent = entries.length
      ? entries.join('、')
      : '（暂无）';
  }

  function syncSelectionsFromList() {
    projectMemberList.querySelectorAll('input[type="checkbox"][data-userid]').forEach((cb) => {
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
    const deptRaw = projectMemberDept.value;
    projectMemberList.innerHTML = '';

    if (deptRaw === DEPT_PLACEHOLDER || deptRaw === '') {
      projectMemberList.innerHTML =
        '<p class="muted member-empty">请先在上方选择成员部门</p>';
      return;
    }

    const deptId = Number(deptRaw);
    const inDept = allUsers.filter((u) => userDeptId(u) === deptId);
    if (!inDept.length) {
      projectMemberList.innerHTML =
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
      projectMemberList.appendChild(label);
    });
  }

  function resetFormBasics() {
    clearError();
    projectYear.value = String(new Date().getFullYear());
    projectWorkNo.value = '';
    projectName.value = '';
    projectStartDate.value = todayIso();
    projectEndDate.value = '';
    selectedMembers = {};
    updateSelectedSummary();
  }

  function applyMetaToForm() {
    fillDepartmentSelect(projectManagerDept);
    fillDepartmentSelect(projectMemberDept);
    projectManagerDept.value = DEPT_PLACEHOLDER;
    projectMemberDept.value = DEPT_PLACEHOLDER;
    refreshManagerCombo('');
    refreshMemberList();
  }

  function setMetaLoading() {
    projectManagerDept.innerHTML = '<option value="">加载中…</option>';
    projectManagerDept.disabled = true;
    projectManager.innerHTML = '<option value="">（未指定）</option>';
    projectManager.disabled = true;
    projectMemberDept.innerHTML = '<option value="">加载中…</option>';
    projectMemberDept.disabled = true;
    projectMemberList.innerHTML =
      '<p class="muted member-empty">正在加载部门与成员…</p>';
  }

  function setMetaReady() {
    projectManagerDept.disabled = false;
    projectMemberDept.disabled = false;
  }

  function closeModal() {
    projectModal.hidden = true;
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label}超时（${Math.round(ms / 1000)}s），请检查 Nginx 是否反代该接口`));
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
    const [deptData, userData] = await Promise.all([
      withTimeout(fetchDepartments(), META_TIMEOUT_MS, '部门列表'),
      withTimeout(fetchWecomUsers(), META_TIMEOUT_MS, '成员列表'),
    ]);
    allDepartments = deptData.departments || [];
    allUsers = userData.users || [];
  }

  async function openCreateModal() {
    if (!ensureCanEdit('新增项目')) return;
    if (loadingMeta) return;

    loadingMeta = true;
    editingProject = null;
    if (btnAddProject) btnAddProject.disabled = true;
    const titleEl = document.getElementById('projectModalTitle');
    if (titleEl) titleEl.textContent = '新建项目';
    if (btnProjectSave) btnProjectSave.textContent = '创建';

    // 先打开弹窗，避免接口卡住时「点击无反应」
    resetFormBasics();
    setMetaLoading();
    projectModal.hidden = false;
    setTimeout(() => {
      try {
        projectName.focus();
      } catch (e) {
        /* ignore */
      }
    }, 50);

    try {
      await loadMeta();
      setMetaReady();
      applyMetaToForm();
      clearError();
    } catch (err) {
      allDepartments = [];
      allUsers = [];
      setMetaReady();
      applyMetaToForm();
      showError(
        (err && err.message) ||
          '加载部门/成员失败。仍可填写名称与日期创建；选人需 Nginx 反代 /api/departments 与 /api/wecom/users'
      );
    } finally {
      loadingMeta = false;
      if (btnAddProject) btnAddProject.disabled = false;
    }
  }

  function fillFormFromProject(project) {
    clearError();
    projectYear.value = project.year || '';
    projectWorkNo.value = project.work_no || '';
    projectName.value = project.name || '';
    projectStartDate.value = String(project.start_date || '').trim();
    projectEndDate.value = String(project.end_date || '').trim();
    selectedMembers = {};
    (project.members || []).forEach((m) => {
      const userid = (m.userid || '').trim();
      if (!userid) return;
      selectedMembers[userid] = (m.name || '').trim();
    });
    updateSelectedSummary();
  }

  async function openEditModal(project) {
    if (!ensureCanEdit('编辑项目')) return;
    if (!project || !project.id) {
      alert('缺少项目数据');
      return;
    }
    if (loadingMeta) return;

    loadingMeta = true;
    editingProject = project;
    const titleEl = document.getElementById('projectModalTitle');
    if (titleEl) titleEl.textContent = '编辑项目';
    if (btnProjectSave) btnProjectSave.textContent = '保存';

    fillFormFromProject(project);
    setMetaLoading();
    projectModal.hidden = false;

    try {
      await loadMeta();
      setMetaReady();
      fillDepartmentSelect(projectManagerDept);
      fillDepartmentSelect(projectMemberDept);
      const managerId = (project.manager_userid || '').trim();
      const mgrDept = departmentIdForUser(managerId);
      if (mgrDept != null) {
        projectManagerDept.value = String(mgrDept);
      } else {
        projectManagerDept.value = DEPT_PLACEHOLDER;
      }
      refreshManagerCombo(managerId);
      projectMemberDept.value = DEPT_PLACEHOLDER;
      refreshMemberList();
      clearError();
    } catch (err) {
      allDepartments = [];
      allUsers = [];
      setMetaReady();
      fillDepartmentSelect(projectManagerDept);
      fillDepartmentSelect(projectMemberDept);
      refreshManagerCombo('');
      refreshMemberList();
      showError((err && err.message) || '加载部门/成员失败，仍可修改基本字段');
    } finally {
      loadingMeta = false;
    }
  }

  function departmentIdForUser(userid) {
    if (!userid) return null;
    const u = allUsers.find((x) => (x.userid || '').trim() === userid);
    if (!u) return null;
    return userDeptId(u);
  }

  function buildPayload() {
    const managerOpt = projectManager.selectedOptions[0];
    const managerUserid = (projectManager.value || '').trim();
    const managerName = managerOpt
      ? (managerOpt.dataset.name || '').trim()
      : '';

    const members = Object.keys(selectedMembers).map((userid) => ({
      userid,
      name: selectedMembers[userid] || '',
    }));

    const payload = {
      year: (projectYear.value || '').trim(),
      work_no: (projectWorkNo.value || '').trim(),
      name: (projectName.value || '').trim(),
      manager_userid: managerUserid,
      manager_name: managerName,
      group_chat: editingProject ? editingProject.group_chat || '' : '',
      group_chat_id: editingProject ? editingProject.group_chat_id || '' : '',
      tasks: editingProject ? editingProject.tasks || '' : '',
      start_date: (projectStartDate.value || '').trim(),
      end_date: (projectEndDate.value || '').trim(),
      members,
    };
    if (editingProject && editingProject.id) {
      payload.id = editingProject.id;
    }
    return payload;
  }

  function incompleteSubtasksBlock(project, endDate) {
    if (!endDate) return false;
    if (!project) return false;
    const subCount = Number(project.subtask_count) || 0;
    const allDone = !!project.subtask_all_completed;
    return subCount > 0 && !allDone;
  }

  async function saveProject() {
    if (saving) return;
    syncSelectionsFromList();
    const payload = buildPayload();
    if (!payload.name) {
      showError('项目名称不能为空');
      return;
    }
    if (!payload.start_date) {
      showError('请填写项目启动日期');
      return;
    }
    if (editingProject && incompleteSubtasksBlock(editingProject, payload.end_date)) {
      showError('存在未完成的子任务，不能填写实际完结日期。请先将全部子任务标记为已完结。');
      return;
    }

    saving = true;
    btnProjectSave.disabled = true;
    clearError();
    try {
      if (editingProject && editingProject.id) {
        const data = await updateProject(payload);
        closeModal();
        if (typeof window.onProjectSaved === 'function') {
          await window.onProjectSaved(data.project || payload);
        } else if (window.ProjectListApp) {
          await window.ProjectListApp.load(true);
        }
      } else {
        await createProject(payload);
        closeModal();
        if (window.ProjectListApp) await window.ProjectListApp.load(true);
      }
    } catch (err) {
      showError(err.message || '保存失败');
    } finally {
      saving = false;
      btnProjectSave.disabled = false;
    }
  }

  btnProjectCancel.addEventListener('click', closeModal);
  btnProjectSave.addEventListener('click', saveProject);
  projectModal.addEventListener('click', (e) => {
    if (e.target === projectModal) closeModal();
  });
  projectManagerDept.addEventListener('change', () => refreshManagerCombo());
  projectMemberDept.addEventListener('change', refreshMemberList);

  // 点击由 app.js 统一绑定，避免脚本未加载时完全无反馈
  window.ProjectFormApp = {
    openCreate: openCreateModal,
    openEdit: openEditModal,
  };
})();
