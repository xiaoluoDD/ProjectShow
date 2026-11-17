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
 *   #memberSearchInput
 *   #btnSyncMembers
 *   #btnPreviewMainDept
 *   #mainDeptPreviewModal
 *   #mainDeptPreviewHint
 *   #mainDeptOnlyMulti
 *   #mainDeptPreviewStats
 *   #mainDeptPreviewRoot
 *   #mainDeptPreviewError
 *   #btnRefreshMainDeptPreview
 *   #btnMainDeptPreviewClose
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
  const memberSearchInput = document.getElementById('memberSearchInput');
  const mainDeptPreviewModal = document.getElementById('mainDeptPreviewModal');
  const mainDeptPreviewHint = document.getElementById('mainDeptPreviewHint');
  const mainDeptOnlyMulti = document.getElementById('mainDeptOnlyMulti');
  const mainDeptPreviewStats = document.getElementById('mainDeptPreviewStats');
  const mainDeptPreviewRoot = document.getElementById('mainDeptPreviewRoot');
  const mainDeptPreviewError = document.getElementById('mainDeptPreviewError');

  let loadedOnce = false;
  let deptMap = {};
  let deptList = [];
  let searchKeyword = '';
  /** @type {Set<number>} 编辑弹窗里当前勾选的部门 id 集合 */
  let selectedDeptIds = new Set();
  /** @type {Array<object>} 主部门对照缓存 */
  let mainDeptPreviewRows = [];

  const btnSync = document.getElementById('btnSyncMembers');
  if (btnSync) btnSync.addEventListener('click', syncMembers);
  const btnPreviewMainDept = document.getElementById('btnPreviewMainDept');
  if (btnPreviewMainDept) btnPreviewMainDept.addEventListener('click', openMainDeptPreview);
  const btnRefreshMainDeptPreview = document.getElementById('btnRefreshMainDeptPreview');
  if (btnRefreshMainDeptPreview) {
    btnRefreshMainDeptPreview.addEventListener('click', () => loadMainDeptPreview(true));
  }
  const btnMainDeptPreviewClose = document.getElementById('btnMainDeptPreviewClose');
  if (btnMainDeptPreviewClose) btnMainDeptPreviewClose.addEventListener('click', closeMainDeptPreview);
  if (mainDeptOnlyMulti) {
    mainDeptOnlyMulti.addEventListener('change', renderMainDeptPreviewTable);
  }
  if (mainDeptPreviewModal) {
    mainDeptPreviewModal.addEventListener('click', (e) => {
      if (e.target === mainDeptPreviewModal) closeMainDeptPreview();
    });
  }
  if (memberSearchInput) {
    memberSearchInput.addEventListener('input', () => {
      searchKeyword = memberSearchInput.value.trim().toLowerCase();
      applyFilterAndRender();
    });
  }
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

  function mainDeptNameOf(row) {
    if (row.main_department_name) return row.main_department_name;
    if (row.department_name) return String(row.department_name).split('、')[0] || row.department_name;
    const id = Number(row.main_department_id || row.department_id);
    if (Number.isFinite(id) && id > 0) return deptMap[id] || `部门#${id}`;
    return '未分配';
  }

  function allDeptNamesOf(row) {
    if (Array.isArray(row.department_list) && row.department_list.length) {
      return row.department_list.map((d) => d.name || `部门#${d.id}`).join('、');
    }
    if (Array.isArray(row.department_ids) && row.department_ids.length) {
      return row.department_ids.map((id) => deptMap[id] || `部门#${id}`).join('、');
    }
    if (row.departments) return row.departments;
    return mainDeptNameOf(row);
  }

  function allDeptCountOf(row) {
    if (Array.isArray(row.department_ids) && row.department_ids.length) return row.department_ids.length;
    if (Array.isArray(row.department_list) && row.department_list.length) return row.department_list.length;
    const main = Number(row.main_department_id || row.department_id);
    return Number.isFinite(main) && main > 0 ? 1 : 0;
  }

  function normalizeMainDeptRows(users, fromPreviewApi) {
    return (users || []).map((u) => {
      const mainId = Number(u.main_department_id != null ? u.main_department_id : u.department_id) || 0;
      const count = allDeptCountOf(u);
      const isMulti = u.is_multi != null ? !!u.is_multi : count > 1;
      const localName = u.local_department_name || u.local_department_names || '';
      const mainName = mainDeptNameOf(u) || '未分配';
      let matches = u.main_matches_local;
      if (matches == null && fromPreviewApi) matches = false;
      if (matches == null) matches = true;
      return {
        userid: u.userid || '',
        name: u.name || u.userid || '—',
        main_department_id: mainId,
        main_department_name: mainName,
        all_department_names: allDeptNamesOf(u),
        local_department_name: localName || '—',
        department_count: count || (Array.isArray(u.wecom_departments) ? u.wecom_departments.length : 0),
        is_multi: isMulti,
        has_main: u.has_main != null ? !!u.has_main : mainId > 0 || !!u.wecom_main_department,
        main_matches_local: !!matches,
        wecom_main_department: Number(u.wecom_main_department) || 0,
        source: fromPreviewApi ? 'wecom' : 'local',
      };
    });
  }

  function renderMainDeptPreviewTable() {
    if (!mainDeptPreviewRoot) return;
    const onlyMulti = !!(mainDeptOnlyMulti && mainDeptOnlyMulti.checked);
    const rows = onlyMulti ? mainDeptPreviewRows.filter((r) => r.is_multi) : mainDeptPreviewRows;
    const multiCount = mainDeptPreviewRows.filter((r) => r.is_multi).length;
    const mismatchCount = mainDeptPreviewRows.filter((r) => !r.main_matches_local).length;
    const noMainCount = mainDeptPreviewRows.filter((r) => !r.has_main).length;
    if (mainDeptPreviewStats) {
      mainDeptPreviewStats.textContent =
        `共 ${mainDeptPreviewRows.length} 人，多部门 ${multiCount}，与本地不一致 ${mismatchCount}` +
        (noMainCount ? `，无主部门 ${noMainCount}` : '') +
        (onlyMulti ? `（当前显示 ${rows.length}）` : '');
    }
    if (!rows.length) {
      mainDeptPreviewRoot.innerHTML =
        '<div class="state-box"><p>没有可对照的成员</p></div>';
      return;
    }
    const showLocal = mainDeptPreviewRows.some((r) => r.source === 'wecom');
    mainDeptPreviewRoot.innerHTML = `
      <table class="main-dept-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>UserID</th>
            <th>企微主部门</th>
            <th>企微全部部门</th>
            ${showLocal ? '<th>本地当前主部门</th><th>对照</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const badge = r.is_multi
                ? `<span class="main-dept-badge">${r.department_count} 个部门</span>`
                : '';
              const rowClass = [
                r.is_multi ? 'is-multi' : '',
                showLocal && !r.main_matches_local ? 'is-mismatch' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const matchCell = showLocal
                ? `<td class="${r.main_matches_local ? 'match-ok' : 'match-bad'}">${
                    r.main_matches_local ? '一致' : '不一致'
                  }</td>`
                : '';
              const localCell = showLocal
                ? `<td>${escapeHtml(r.local_department_name || '—')}</td>`
                : '';
              return `<tr class="${rowClass}">
                <td>${escapeHtml(r.name)}${badge}</td>
                <td>${escapeHtml(r.userid)}</td>
                <td class="main-dept-cell">${escapeHtml(r.main_department_name || '未分配')}</td>
                <td class="all-dept-cell">${escapeHtml(r.all_department_names)}</td>
                ${localCell}${matchCell}
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
  }

  function closeMainDeptPreview() {
    if (mainDeptPreviewModal) mainDeptPreviewModal.hidden = true;
  }

  async function openMainDeptPreview() {
    if (!canManage()) {
      alert('无权限查看主部门');
      return;
    }
    if (!mainDeptPreviewModal) return;
    mainDeptPreviewModal.hidden = false;
    await loadMainDeptPreview(false);
  }

  async function loadMainDeptPreview(force) {
    if (mainDeptPreviewError) {
      mainDeptPreviewError.hidden = true;
      mainDeptPreviewError.textContent = '';
    }
    if (!force && mainDeptPreviewRows.length) {
      renderMainDeptPreviewTable();
      return;
    }
    if (mainDeptPreviewRoot) {
      showLoading(mainDeptPreviewRoot, '正在获取主部门对照…');
    }
    if (btnPreviewMainDept) btnPreviewMainDept.disabled = true;
    if (btnRefreshMainDeptPreview) btnRefreshMainDeptPreview.disabled = true;
    try {
      await ensureDepartments();
      let rows = [];
      let hint =
        '展示最近一次同步写入的「主部门」与「全部部门」，可与企微通讯录对照。本次只读，不会改库。';
      let usedPreviewApi = false;
      try {
        if (typeof previewWecomMainDepartments === 'function') {
          const preview = await previewWecomMainDepartments();
          const list = preview.users || preview.items || preview.data || [];
          if (Array.isArray(list) && list.length) {
            rows = normalizeMainDeptRows(list, true);
            usedPreviewApi = true;
            const s = preview.summary || {};
            hint =
              `已从企业微信实时拉取主部门（未改库）。合计 ${s.total ?? list.length} 人，` +
              `有主部门 ${s.with_main ?? '—'}，多部门 ${s.multi ?? '—'}，与本地不一致 ${s.mismatch ?? '—'}。` +
              '请重点核对橙色多部门行、红色不一致行。';
          }
        }
      } catch (previewErr) {
        // 后端 dry-run 尚未部署时回退到本地已同步数据，不打断对照流程。
        usedPreviewApi = false;
      }
      if (!rows.length) {
        const data = await fetchWecomUsers();
        rows = normalizeMainDeptRows(data.users || [], false);
        hint =
          '后端主部门预览接口暂不可用，当前展示为最近一次同步落库结果（只读）。' +
          '部署后端后点击「重新拉取」可对照企微真实 main_department。';
      }
      mainDeptPreviewRows = rows.sort((a, b) => {
        if (a.is_multi !== b.is_multi) return a.is_multi ? -1 : 1;
        if (a.main_matches_local !== b.main_matches_local) return a.main_matches_local ? 1 : -1;
        return String(a.name).localeCompare(String(b.name), 'zh');
      });
      if (mainDeptPreviewHint) mainDeptPreviewHint.textContent = hint;
      renderMainDeptPreviewTable();
    } catch (err) {
      if (mainDeptPreviewRoot) {
        showError(mainDeptPreviewRoot, err.message || '获取失败');
      }
      if (mainDeptPreviewError) {
        mainDeptPreviewError.textContent = err.message || '获取失败';
        mainDeptPreviewError.hidden = false;
      }
    } finally {
      if (btnPreviewMainDept) btnPreviewMainDept.disabled = false;
      if (btnRefreshMainDeptPreview) btnRefreshMainDeptPreview.disabled = false;
    }
  }

  // 搜索匹配：姓名 / userid / 手机号 / 部门 / 来源，任一命中即算匹配（大小写不敏感）。
  function matchesSearch(u, keyword) {
    if (!keyword) return true;
    const haystacks = [u.userid, u.name, u.mobile, deptNamesOf(u), sourceLabel(u.sources)];
    return haystacks.some((v) => String(v || '').toLowerCase().includes(keyword));
  }

  function applyFilterAndRender() {
    const all = window.__membersCache || [];
    const filtered = searchKeyword ? all.filter((u) => matchesSearch(u, searchKeyword)) : all;
    membersSummaryBar.textContent = searchKeyword
      ? `共 ${all.length} 名成员，匹配 ${filtered.length} 个`
      : `共 ${all.length} 名成员`;
    renderMembers(filtered);
  }

  function renderMembers(users) {
    if (!users.length) {
      membersRoot.innerHTML = window.__membersCache && window.__membersCache.length
        ? '<div class="state-box"><p>没有匹配的成员，换个关键字试试</p></div>'
        : '<div class="state-box"><p>暂无成员，可点击「同步成员」拉取</p></div>';
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
      applyFilterAndRender();
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
      applyFilterAndRender();
    } catch (err) {
      showError(membersRoot, err.message || '加载失败');
      membersSummaryBar.textContent = '加载失败';
    }
  }

  window.MembersApp = { load };
})();
