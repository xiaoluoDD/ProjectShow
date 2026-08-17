/**
 * 部门管理
 *
 * 依赖 api.js 函数：
 *   fetchDepartmentsWithMembers, createDepartment, updateDepartment, deleteDepartment
 *
 * 所需 DOM id：
 *   #departmentsRoot
 *   #departmentsSummaryBar
 *   #btnAddDepartment
 *   #departmentModal
 *   #departmentModalTitle
 *   #departmentEditId
 *   #departmentName
 *   #departmentError
 *   #btnDepartmentCancel
 *   #btnDepartmentSave
 *   #departmentMembersModal
 *   #departmentMembersTitle
 *   #departmentMembersHint
 *   #departmentMembersList
 *   #btnDepartmentMembersClose
 */
(function () {
  const departmentsRoot = document.getElementById('departmentsRoot');
  const departmentsSummaryBar = document.getElementById('departmentsSummaryBar');
  const departmentModal = document.getElementById('departmentModal');
  const departmentEditId = document.getElementById('departmentEditId');
  const departmentName = document.getElementById('departmentName');
  const departmentError = document.getElementById('departmentError');
  const departmentModalTitle = document.getElementById('departmentModalTitle');
  const departmentMembersModal = document.getElementById('departmentMembersModal');
  const departmentMembersTitle = document.getElementById('departmentMembersTitle');
  const departmentMembersHint = document.getElementById('departmentMembersHint');
  const departmentMembersList = document.getElementById('departmentMembersList');

  let loadedOnce = false;

  const btnAdd = document.getElementById('btnAddDepartment');
  if (btnAdd) btnAdd.addEventListener('click', () => openEditor(null));
  const btnCancel = document.getElementById('btnDepartmentCancel');
  if (btnCancel) btnCancel.addEventListener('click', closeEditor);
  const btnSave = document.getElementById('btnDepartmentSave');
  if (btnSave) btnSave.addEventListener('click', saveEditor);
  if (departmentModal) {
    departmentModal.addEventListener('click', (e) => {
      if (e.target === departmentModal) closeEditor();
    });
  }
  const btnMembersClose = document.getElementById('btnDepartmentMembersClose');
  if (btnMembersClose) btnMembersClose.addEventListener('click', closeMembers);
  if (departmentMembersModal) {
    departmentMembersModal.addEventListener('click', (e) => {
      if (e.target === departmentMembersModal) closeMembers();
    });
  }

  function canManage() {
    return !!(window.Auth && window.Auth.isLoggedIn() && window.Auth.canEditProjects());
  }

  function openEditor(dept) {
    if (!departmentModal) return;
    departmentError.hidden = true;
    departmentError.textContent = '';
    if (dept) {
      departmentModalTitle.textContent = '编辑部门';
      departmentEditId.value = String(dept.id);
      departmentName.value = dept.name || '';
    } else {
      departmentModalTitle.textContent = '新增部门';
      departmentEditId.value = '';
      departmentName.value = '';
    }
    departmentModal.hidden = false;
    departmentName.focus();
  }

  function closeEditor() {
    if (departmentModal) departmentModal.hidden = true;
  }

  function openMembers(dept) {
    if (!departmentMembersModal || !departmentMembersList) return;
    const members = Array.isArray(dept.members) ? dept.members : [];
    const name = dept.name || '部门';
    if (departmentMembersTitle) departmentMembersTitle.textContent = name + ' · 人员';
    if (departmentMembersHint) {
      departmentMembersHint.textContent =
        members.length === 0 ? '该部门暂无成员' : `共 ${members.length} 人`;
    }
    if (!members.length) {
      departmentMembersList.innerHTML = '<p class="muted">暂无成员。可在「成员管理」中分配部门。</p>';
    } else {
      departmentMembersList.innerHTML =
        '<ul class="dept-members-ul">' +
        members
          .map((m) => {
            const display = escapeHtml(m.name || m.userid || '—');
            const uid = escapeHtml(m.userid || '—');
            const mobile = (m.mobile || '').trim();
            const mobileHtml = mobile
              ? `<span class="dept-member-mobile">${escapeHtml(mobile)}</span>`
              : '<span class="dept-member-mobile muted">无手机号</span>';
            return `<li class="dept-member-row">
              <span class="dept-member-name">${display}</span>
              <span class="dept-member-meta">
                <span class="dept-member-userid">${uid}</span>
                ${mobileHtml}
              </span>
            </li>`;
          })
          .join('') +
        '</ul>';
    }
    departmentMembersModal.hidden = false;
  }

  function closeMembers() {
    if (departmentMembersModal) departmentMembersModal.hidden = true;
  }

  async function saveEditor() {
    departmentError.hidden = true;
    const id = departmentEditId.value.trim();
    const name = departmentName.value.trim();
    if (!name) {
      departmentError.textContent = '部门名称不能为空';
      departmentError.hidden = false;
      return;
    }
    try {
      if (id) {
        await updateDepartment({ id: Number(id), name });
      } else {
        await createDepartment({ name });
      }
      closeEditor();
      await load(true);
    } catch (err) {
      departmentError.textContent = err.message || '保存失败';
      departmentError.hidden = false;
    }
  }

  function renderDepartments(departments) {
    if (!departments.length) {
      departmentsRoot.innerHTML = '<div class="state-box"><p>暂无部门</p></div>';
      return;
    }
    departmentsRoot.innerHTML = departments
      .map((d) => {
        const count = d.member_count ?? (Array.isArray(d.members) ? d.members.length : 0);
        return `
          <article class="account-card" data-id="${d.id}">
            <div class="card-top">
              <span class="card-meta">部门</span>
              <button type="button" class="status-badge status-default dept-count-btn" data-members="${d.id}" title="查看人员">${count} 人</button>
            </div>
            <h2 class="card-title">${escapeHtml(d.name || '—')}</h2>
            <div class="account-actions">
              <button type="button" class="btn btn-sm" data-members="${d.id}">查看人员</button>
              <button type="button" class="btn btn-sm" data-edit="${d.id}">编辑</button>
              <button type="button" class="btn btn-sm btn-danger" data-del="${d.id}">删除</button>
            </div>
          </article>`;
      })
      .join('');

    departmentsRoot.querySelectorAll('[data-members]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-members'));
        const dept = (window.__departmentsCache || []).find((x) => x.id === id);
        if (dept) openMembers(dept);
      });
    });
    departmentsRoot.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-edit'));
        const dept = (window.__departmentsCache || []).find((x) => x.id === id);
        if (dept) openEditor(dept);
      });
    });
    departmentsRoot.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-del'));
        if (!id) return;
        const dept = (window.__departmentsCache || []).find((x) => x.id === id);
        const name = dept ? dept.name : String(id);
        if (!confirm(`确定删除部门「${name}」？\n该部门下成员将解除关联。`)) return;
        try {
          await deleteDepartment(id);
          await load(true);
        } catch (err) {
          alert(err.message || '删除失败');
        }
      });
    });
  }

  async function load(force) {
    if (!canManage()) {
      departmentsSummaryBar.textContent = '需要登录且具备项目管理权限';
      departmentsRoot.innerHTML =
        '<div class="state-box error"><p>当前无权限管理部门，请使用可编辑项目的账户登录。</p></div>';
      return;
    }
    if (loadedOnce && !force && window.__departmentsCache) {
      renderDepartments(window.__departmentsCache);
      return;
    }
    showLoading(departmentsRoot, '正在加载部门…');
    departmentsSummaryBar.textContent = '加载中…';
    try {
      const data = await fetchDepartmentsWithMembers();
      const departments = data.departments || [];
      window.__departmentsCache = departments;
      loadedOnce = true;
      const totalMembers = departments.reduce(
        (sum, d) => sum + (d.member_count ?? (Array.isArray(d.members) ? d.members.length : 0)),
        0
      );
      departmentsSummaryBar.textContent = `共 ${departments.length} 个部门，成员合计 ${totalMembers} 人`;
      renderDepartments(departments);
    } catch (err) {
      showError(departmentsRoot, err.message || '加载失败');
      departmentsSummaryBar.textContent = '加载失败';
    }
  }

  window.DepartmentsApp = { load };
})();
