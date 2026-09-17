/**
 * 企微成员管理
 *
 * 一人可同时属于多个企业微信部门：部门列表在成员卡片与编辑弹窗里都以多选/多个标签展示。
 *
 * 依赖 api.js 函数：
 *   fetchWecomUsers, syncWecomUsers, updateWecomUser, fetchDepartments
 *
 * 所需 DOM id：
 *   #membersRoot
 *   #membersSummaryBar
 *   #btnSyncMembers
 *   #memberModal
 *   #memberModalTitle
 *   #memberUserid
 *   #memberName
 *   #memberMobile
 *   #memberDepartmentList
 *   #memberError
 *   #btnMemberCancel
 *   #btnMemberSave
 */
(function () {
  const membersRoot = document.getElementById('membersRoot');
  const membersSummaryBar = document.getElementById('membersSummaryBar');
  const memberModal = document.getElementById('memberModal');
  const memberModalTitle = document.getElementById('memberModalTitle');
  const memberUserid = document.getElementById('memberUserid');
  const memberName = document.getElementById('memberName');
  const memberMobile = document.getElementById('memberMobile');
  const memberDepartmentList = document.getElementById('memberDepartmentList');
  const memberError = document.getElementById('memberError');

  let loadedOnce = false;
  let deptMap = {};
  let deptList = [];
  /** @type {Set<number>} 编辑弹窗里当前勾选的部门 id 集合 */
  let selectedDeptIds = new Set();

  const btnSync = document.getElementById('btnSyncMembers');
  if (btnSync) btnSync.addEventListener('click', syncMembers);
  const btnCancel = document.getElementById('btnMemberCancel');
  if (btnCancel) btnCancel.addEventListener('click', closeEditor);
  const btnSave = document.getElementById('btnMemberSave');
  if (btnSave) btnSave.addEventListener('click', saveEditor);
  if (memberModal) {
    memberModal.addEventListener('click', (e) => {
      if (e.target === memberModal) closeEditor();
    });
  }

  function canManage() {
    return !!(window.Auth && window.Auth.isLoggedIn() && window.Auth.canEditProjects());
  }

  function sourceLabel(sources) {
    const s = String(sources || '').trim();
    if (!s) return '—';
    return s;
  }

  function deptNamesOf(user) {
    // 一人可能属于多个部门：优先用后端已拼好的 department_name（多个部门用「、」分隔）；
    // 兜底用 department_ids + 本地 deptMap 自行拼接；都没有则展示"未分配"。
    if (user.department_name) return user.department_name;
    const ids = Array.isArray(user.department_ids) ? user.department_ids : [];
    if (ids.length) {
      return ids.map((id) => deptMap[id] || `部门#${id}`).join('、');
    }
    return '未分配';
  }

  async function ensureDepartments() {
    const data = await fetchDepartments();
    const list = data.departments || [];
    deptMap = {};
    deptList = list;
    list.forEach((d) => {
      deptMap[d.id] = d.name || '';
    });
    return list;
  }

  function renderMemberDepartmentChecklist() {
    if (!memberDepartmentList) return;
    if (!deptList.length) {
      memberDepartmentList.innerHTML =
        '<p class="muted member-empty">暂无部门，请先点击「同步可见成员」从企业微信导入部门</p>';
      return;
    }
    memberDepartmentList.innerHTML = deptList
      .map((d) => {
        const id = Number(d.id);
        const checked = selectedDeptIds.has(id) ? 'checked' : '';
        return `<label class="member-check-row">
          <input type="checkbox" data-dept-id="${id}" ${checked} />
          <span>${escapeHtml(d.name || String(id))}</span>
        </label>`;
      })
      .join('');
    memberDepartmentList.querySelectorAll('input[type="checkbox"][data-dept-id]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = Number(cb.getAttribute('data-dept-id'));
        if (cb.checked) selectedDeptIds.add(id);
        else selectedDeptIds.delete(id);
      });
    });
  }

  function openEditor(user) {
    if (!memberModal || !user) return;
    memberError.hidden = true;
    memberError.textContent = '';
    memberModalTitle.textContent = '编辑成员';
    memberUserid.value = user.userid || '';
    memberUserid.readOnly = true;
    memberName.value = user.name || '';
    memberName.readOnly = true;
    memberMobile.value = user.mobile || '';
    const ids = Array.isArray(user.department_ids) && user.department_ids.length
      ? user.department_ids
      : (Number(user.department_id) > 0 ? [Number(user.department_id)] : []);
    selectedDeptIds = new Set(ids.map(Number));
    renderMemberDepartmentChecklist();
    memberModal.hidden = false;
    memberMobile.focus();
  }

  function closeEditor() {
    if (memberModal) memberModal.hidden = true;
  }

  async function saveEditor() {
    memberError.hidden = true;
    const userid = memberUserid.value.trim();
    if (!userid) {
      memberError.textContent = '缺少 userid';
      memberError.hidden = false;
      return;
    }
    try {
      await updateWecomUser({
        userid,
        mobile: memberMobile.value.trim(),
        department_ids: Array.from(selectedDeptIds),
      });
      closeEditor();
      await load(true);
    } catch (err) {
      memberError.textContent = err.message || '保存失败';
      memberError.hidden = false;
    }
  }

  async function syncMembers() {
    if (!canManage()) {
      alert('无权限同步成员');
      return;
    }
    if (btnSync) btnSync.disabled = true;
    membersSummaryBar.textContent = '正在从企业微信同步…';
    try {
      const data = await syncWecomUsers();
      const count =
        (data.sync && (data.sync.user_count ?? data.sync.count)) ??
        data.count ??
        '';
      alert(data.msg || (count !== '' ? `同步完成，共 ${count} 人` : '同步完成'));
      await load(true);
    } catch (err) {
      alert(err.message || '同步失败');
      membersSummaryBar.textContent = '同步失败';
    } finally {
      if (btnSync) btnSync.disabled = false;
    }
  }

  function renderMembers(users) {
    if (!users.length) {
      membersRoot.innerHTML = '<div class="state-box"><p>暂无成员，可点击「同步成员」拉取</p></div>';
      return;
    }
    membersRoot.innerHTML = users
      .map((u) => {
        const uid = escapeHtml(u.userid || '');
        return `
          <article class="account-card" data-userid="${uid}">
            <div class="card-top">
              <span class="card-meta">${uid}</span>
              <span class="status-badge status-default">${escapeHtml(sourceLabel(u.sources))}</span>
            </div>
            <h2 class="card-title">${escapeHtml(u.name || u.userid || '—')}</h2>
            <div class="card-row"><span class="label">手机：</span>${escapeHtml(displayOrDash(u.mobile))}</div>
            <div class="card-row"><span class="label">部门：</span>${escapeHtml(deptNamesOf(u))}</div>
            <div class="account-actions">
              <button type="button" class="btn btn-sm" data-edit="${uid}">编辑</button>
            </div>
          </article>`;
      })
      .join('');

    membersRoot.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const userid = btn.getAttribute('data-edit') || '';
        const user = (window.__membersCache || []).find((x) => x.userid === userid);
        if (user) openEditor(user);
      });
    });
  }

  async function load(force) {
    if (!canManage()) {
      membersSummaryBar.textContent = '需要登录且具备项目管理权限';
      membersRoot.innerHTML =
        '<div class="state-box error"><p>当前无权限管理成员，请使用可编辑项目的账户登录。</p></div>';
      return;
    }
    if (loadedOnce && !force && window.__membersCache) {
      renderMembers(window.__membersCache);
      return;
    }
    showLoading(membersRoot, '正在加载成员…');
    membersSummaryBar.textContent = '加载中…';
    try {
      await ensureDepartments();
      const data = await fetchWecomUsers();
      const users = data.users || [];
      window.__membersCache = users;
      loadedOnce = true;
      membersSummaryBar.textContent = `共 ${users.length} 名成员`;
      renderMembers(users);
    } catch (err) {
      showError(membersRoot, err.message || '加载失败');
      membersSummaryBar.textContent = '加载失败';
    }
  }

  window.MembersApp = { load };
})();
