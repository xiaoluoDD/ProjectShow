/**
 * 企微成员管理
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
 *   #memberDepartment
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
  const memberDepartment = document.getElementById('memberDepartment');
  const memberError = document.getElementById('memberError');

  let loadedOnce = false;
  let deptMap = {};

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

  function deptNameOf(user) {
    if (user.department_name) return user.department_name;
    const id = Number(user.department_id);
    if (id > 0 && deptMap[id]) return deptMap[id];
    return (user.departments || '').trim() || '—';
  }

  async function ensureDepartments() {
    const data = await fetchDepartments();
    const list = data.departments || [];
    deptMap = {};
    list.forEach((d) => {
      deptMap[d.id] = d.name || '';
    });
    if (memberDepartment) {
      const current = memberDepartment.value;
      const opts = ['<option value="0">未分配</option>'].concat(
        list.map(
          (d) =>
            `<option value="${d.id}">${escapeHtml(d.name || String(d.id))}</option>`
        )
      );
      memberDepartment.innerHTML = opts.join('');
      if (current) memberDepartment.value = current;
    }
    return list;
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
    memberDepartment.value = String(user.department_id > 0 ? user.department_id : 0);
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
        department_id: Number(memberDepartment.value) || 0,
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
            <div class="card-row"><span class="label">部门：</span>${escapeHtml(deptNameOf(u))}</div>
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
