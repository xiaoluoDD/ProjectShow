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
 */
(function () {
  const departmentsRoot = document.getElementById('departmentsRoot');
  const departmentsSummaryBar = document.getElementById('departmentsSummaryBar');
  const departmentModal = document.getElementById('departmentModal');
  const departmentEditId = document.getElementById('departmentEditId');
  const departmentName = document.getElementById('departmentName');
  const departmentError = document.getElementById('departmentError');
  const departmentModalTitle = document.getElementById('departmentModalTitle');

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
              <span class="status-badge status-default">${count} 人</span>
            </div>
            <h2 class="card-title">${escapeHtml(d.name || '—')}</h2>
            <div class="account-actions">
              <button type="button" class="btn btn-sm" data-edit="${d.id}">编辑</button>
              <button type="button" class="btn btn-sm btn-danger" data-del="${d.id}">删除</button>
            </div>
          </article>`;
      })
      .join('');

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
