(function () {
  applyAppVersionBadge();

  const isPreviewPage = window.location.pathname.indexOf('mobile-preview') >= 0;
  if (isPreviewPage) {
    document.body.classList.add('preview-mode');
    const previewBadge = document.createElement('div');
    previewBadge.id = 'previewBadge';
    previewBadge.textContent = '预览环境';
    previewBadge.style.position = 'fixed';
    previewBadge.style.top = '12px';
    previewBadge.style.right = '12px';
    previewBadge.style.zIndex = '9999';
    previewBadge.style.padding = '8px 12px';
    previewBadge.style.borderRadius = '999px';
    previewBadge.style.background = '#d93025';
    previewBadge.style.color = '#fff';
    previewBadge.style.fontSize = '14px';
    previewBadge.style.fontWeight = '700';
    previewBadge.style.letterSpacing = '0';
    previewBadge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)';
    previewBadge.style.pointerEvents = 'none';
    previewBadge.title = '当前页面是预览版，不是正式版';
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(previewBadge);
    });
  }
  const viewSwitch = document.getElementById('viewSwitch');
  const optAccounts = document.getElementById('optAccounts');
  const optDepartments = document.getElementById('optDepartments');
  const optMembers = document.getElementById('optMembers');
  const optTools = document.getElementById('optTools');
  const btnFilter = document.getElementById('btnFilter');
  const btnAddProject = document.getElementById('btnAddProject');
  const btnOpenWarehouse = document.getElementById('btnOpenWarehouse');
  const btnKiosk = document.getElementById('btnKiosk');
  const btnKioskExit = document.getElementById('btnKioskExit');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnLogin = document.getElementById('btnLogin');
  const btnChangePassword = document.getElementById('btnChangePassword');
  const btnLogout = document.getElementById('btnLogout');
  const authUserBar = document.getElementById('authUserBar');
  const dashboardView = document.getElementById('dashboardView');
  const projectsView = document.getElementById('projectsView');
  const warehouseView = document.getElementById('warehouseView');
  const accountsView = document.getElementById('accountsView');
  const departmentsView = document.getElementById('departmentsView');
  const membersView = document.getElementById('membersView');
  const toolsView = document.getElementById('toolsView');
  const loginModal = document.getElementById('loginModal');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const passwordModal = document.getElementById('passwordModal');
  const newPassword = document.getElementById('newPassword');
  const newPasswordConfirm = document.getElementById('newPasswordConfirm');
  const passwordError = document.getElementById('passwordError');
  const projectsHint = document.getElementById('projectsHint');
  let warehouseItems = [];
  let warehouseSaveTimer = null;

  const MANAGE_VIEWS = ['accounts', 'departments', 'members', 'tools'];

  function canChangeOwnPassword(user) {
    if (!user || !user.username) return false;
    if (user.is_super_admin || String(user.username).toLowerCase() === 'root') return false;
    return true;
  }

  function currentView() {
    const q = new URLSearchParams(window.location.search).get('view');
    if (
      q === 'projects' ||
      q === 'warehouse' ||
      q === 'dashboard' ||
      q === 'accounts' ||
      q === 'departments' ||
      q === 'members' ||
      q === 'tools'
    ) {
      return q;
    }
    return 'dashboard';
  }

  function roleText(user) {
    if (!user) return '';
    if (user.is_super_admin || user.role === 'super_admin') return '超级管理员';
    if (user.role === 'admin') return '管理员';
    if (user.role === 'user') return '普通';
    return user.role || '';
  }

  function refreshAuthUI() {
    const loggedIn = window.Auth && window.Auth.isLoggedIn();
    const canManage = window.Auth && window.Auth.canManageAccounts();
    const canEdit = window.Auth && window.Auth.canEditProjects();
    const user = window.Auth ? window.Auth.getUser() : null;

    btnLogin.hidden = !!loggedIn;
    btnLogout.hidden = !loggedIn;
    if (btnChangePassword) btnChangePassword.hidden = !(loggedIn && canChangeOwnPassword(user));
    optAccounts.hidden = !canManage;
    if (optDepartments) optDepartments.hidden = !canEdit;
    if (optMembers) optMembers.hidden = !canEdit;
    if (optTools) optTools.hidden = !canManage;

    if (loggedIn && user) {
      authUserBar.hidden = false;
      authUserBar.textContent = `已登录：${user.display_name || user.username}（${roleText(user)}）`;
    } else {
      authUserBar.hidden = true;
      authUserBar.textContent = '';
    }

    if (projectsHint) {
      projectsHint.textContent = canEdit
        ? '已登录，可点顶栏「新增项目」· 下拉页面可刷新'
        : '未登录仅可查看 · 下拉页面可刷新';
    }

    refreshAddProjectButton();

    const v = viewSwitch.value;
    if (v === 'accounts' && !canManage) setView('dashboard', true);
    else if ((v === 'departments' || v === 'members') && !canEdit) setView('dashboard', true);
    else if (v === 'tools' && !canManage) setView('dashboard', true);
  }

  function refreshAddProjectButton() {
    if (!btnAddProject) return;
    const canEdit = window.Auth && window.Auth.canEditProjects();
    const onProjects = viewSwitch.value === 'projects';
    btnAddProject.hidden = !(canEdit && onProjects);
  }

  function setView(view, pushUrl) {
    let next = view;
    const allowed = ['projects', 'warehouse', 'dashboard', 'accounts', 'departments', 'members', 'tools'];
    if (allowed.indexOf(next) < 0) next = 'dashboard';

    const canManage = window.Auth && window.Auth.canManageAccounts();
    const canEdit = window.Auth && window.Auth.canEditProjects();
    if (next === 'accounts' && !canManage) next = 'dashboard';
    if ((next === 'departments' || next === 'members') && !canEdit) next = 'dashboard';
    if (next === 'tools' && !canManage) next = 'dashboard';

    viewSwitch.value = next;
    const isDash = next === 'dashboard';
    const isProjects = next === 'projects';
    const isWarehouse = next === 'warehouse';
    const isAccounts = next === 'accounts';
    const isDepartments = next === 'departments';
    const isMembers = next === 'members';
    const isTools = next === 'tools';

    dashboardView.hidden = !isDash;
    projectsView.hidden = !isProjects;
    if (warehouseView) warehouseView.hidden = !isWarehouse;
    accountsView.hidden = !isAccounts;
    if (departmentsView) departmentsView.hidden = !isDepartments;
    if (membersView) membersView.hidden = !isMembers;
    if (toolsView) toolsView.hidden = !isTools;
    btnFilter.hidden = !isProjects;
    refreshAddProjectButton();

    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', next);
      history.replaceState(null, '', url);
    }

    if (isDash) {
      if (window.DashboardApp) window.DashboardApp.load(true);
      else {
        const bar = document.getElementById('dashSummaryBar');
        const root = document.getElementById('dashboardRoot');
        if (bar) bar.textContent = '看板脚本未加载';
        if (root) {
          root.innerHTML =
            '<div class="state-box error"><p>缺少 js/dashboard.js，请确认已同步最新 web 静态文件后强制刷新。</p></div>';
        }
      }
      scheduleIdleKiosk();
    } else if (isWarehouse) {
      const bar = document.getElementById('warehouseSummaryBar');
      const root = document.getElementById('warehouseRoot');
      if (bar) bar.textContent = '待入库清单预览版：入库、出库、库存、盘点、库位、采购与导入导出';
      if (root && !root.dataset.rendered) {
        root.innerHTML = `
          <section class="warehouse-preview-shell">
            <div class="warehouse-preview-head">
              <div>
                <h2>待入库清单</h2>
                <p>这里先按桌面端的工作流做一个网页预览版，后续再逐步接入真实入库、出库和库存联动。</p>
              </div>
              <div class="warehouse-preview-tags">
                <span class="preview-chip warning">预览环境</span>
                <span class="preview-chip">打印条码已屏蔽</span>
              </div>
            </div>

            <div class="warehouse-action-row">
              <button type="button" class="btn btn-primary" id="btnWarehouseImport">导入采购单文件</button>
              <button type="button" class="btn" id="btnWarehouseAddRow">添加行</button>
              <button type="button" class="btn" id="btnWarehouseDeleteRows">删除选中行</button>
              <button type="button" class="btn" id="btnWarehouseSelectAll">全选</button>
              <button type="button" class="btn" id="btnWarehouseDeselectAll">取消全选</button>
              <button type="button" class="btn btn-primary" id="btnWarehouseStockIn">手动入库</button>
              <button type="button" class="btn" id="btnWarehouseRegenerate">重新生成条形码</button>
              <button type="button" class="btn" disabled title="条码打印依赖本地打印机，预览版暂不开放">打印条码（暂不开放）</button>
              <button type="button" class="btn" id="btnWarehouseHistory">历史入库记录</button>
              <button type="button" class="btn">清除筛选</button>
            </div>

            <div class="warehouse-meta-row">
              <span id="warehouseSelectedCount">已选择：0 项</span>
              <span id="warehouseRowCount">当前显示：0 行</span>
              <span id="warehouseSaveState">自动保存：未触发</span>
            </div>

            <div class="warehouse-table-wrap">
              <table class="warehouse-table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>订单号</th>
                    <th>部门</th>
                    <th>申请人</th>
                    <th>项目管理号</th>
                    <th>品番</th>
                    <th>名称</th>
                    <th>规格型号</th>
                    <th>厂家品牌</th>
                    <th>数量</th>
                    <th>入库数量</th>
                    <th>单位</th>
                    <th>入库日期</th>
                    <th>放置位置</th>
                    <th>条形码</th>
                  </tr>
                </thead>
                <tbody id="warehouseTableBody"></tbody>
              </table>
            </div>
          </section>`;
        root.dataset.rendered = '1';
      }
      bindWarehouseActions();
      loadWarehousePreview();
    } else {
      clearIdleKioskTimer();
      if (isProjects) {
        if (window.ProjectListApp) window.ProjectListApp.load(true);
      } else if (isAccounts) {
        if (window.AccountsApp) window.AccountsApp.load(true);
      } else if (isDepartments) {
        if (window.DepartmentsApp) window.DepartmentsApp.load(true);
      } else if (isMembers) {
        if (window.MembersApp) window.MembersApp.load(true);
      } else if (isTools) {
        if (window.AdminToolsApp) window.AdminToolsApp.load(true);
      }
    }
  }

  async function loadWarehousePreview() {
    const root = document.getElementById('warehouseRoot');
    const body = document.getElementById('warehouseTableBody');
    const rowCount = document.getElementById('warehouseRowCount');
    if (!root || !body) return;

    body.innerHTML = '<tr><td colspan="15">加载中…</td></tr>';
    try {
      const resp = await fetch('/api/warehouse/purchase-orders');
      const data = await resp.json();
      const items = Array.isArray(data.items) ? data.items : [];
      warehouseItems = items;
      renderWarehouseTable(items);
    } catch (err) {
      body.innerHTML = `<tr><td colspan="15">加载失败：${escapeHtml(err.message || '未知错误')}</td></tr>`;
    }
  }

  function renderWarehouseTable(items) {
    const body = document.getElementById('warehouseTableBody');
    const rowCount = document.getElementById('warehouseRowCount');
    if (!body) return;
    if (rowCount) rowCount.textContent = `当前显示：${items.length} 行`;
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="15">暂无待入库数据</td></tr>';
      updateWarehouseSelectedCount();
      return;
    }
    body.innerHTML = items.map((it, idx) => `
      <tr data-idx="${idx}">
        <td><input type="checkbox" data-role="select" /></td>
        <td>${editableCell('order_number', it.order_number || '', idx)}</td>
        <td>${editableCell('department', it.department || '', idx)}</td>
        <td>${editableCell('applicant', it.applicant || '', idx)}</td>
        <td>${editableCell('project_number', it.project_number || '', idx)}</td>
        <td>${editableCell('product_code', it.product_code || '', idx)}</td>
        <td>${editableCell('product_name', it.product_name || '', idx)}</td>
        <td>${editableCell('specification', it.specification || '', idx)}</td>
        <td>${editableCell('manufacturer', it.manufacturer || '', idx)}</td>
        <td>${editableCell('quantity', String(it.quantity ?? 0), idx, 'number')}</td>
        <td><span class="warehouse-cell-static">${escapeHtml(String(it.stocked_quantity ?? 0))}</span></td>
        <td>${editableCell('unit', it.unit || '个', idx)}</td>
        <td><span class="warehouse-cell-static">${escapeHtml(it.stock_in_date || '')}</span></td>
        <td>${editableCell('location', it.location || '', idx)}</td>
        <td><span class="warehouse-cell-static warehouse-cell-code">${escapeHtml(it.barcode || '')}</span></td>
      </tr>
    `).join('');
    body.querySelectorAll('input[data-role="select"]').forEach((cb) => {
      cb.addEventListener('change', updateWarehouseSelectedCount);
    });
    body.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', onWarehouseCellEdit);
      input.addEventListener('change', onWarehouseCellEdit);
      if (input.tagName === 'TEXTAREA') autoResizeWarehouseTextarea(input);
    });
    updateWarehouseSelectedCount();
    setWarehouseSaveState('就绪');
  }

  function editableCell(field, value, idx, type = 'text') {
    const safeValue = escapeHtml(value);
    if (type === 'number') {
      return `<input class="warehouse-cell-input warehouse-cell-number" type="number" data-field="${field}" data-row="${idx}" value="${safeValue}" />`;
    }
    return `<textarea class="warehouse-cell-input warehouse-cell-textarea" rows="1" data-field="${field}" data-row="${idx}">${safeValue}</textarea>`;
  }

  function autoResizeWarehouseTextarea(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 30)}px`;
  }

  function getSelectedWarehouseRows() {
    const body = document.getElementById('warehouseTableBody');
    if (!body) return [];
    const rows = [];
    body.querySelectorAll('tr').forEach((tr, index) => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked && warehouseItems[index]) {
        rows.push(warehouseItems[index]);
      }
    });
    return rows;
  }

  function setWarehouseCheckboxes(checked) {
    const body = document.getElementById('warehouseTableBody');
    if (!body) return;
    body.querySelectorAll('input[data-role="select"]').forEach((cb) => {
      cb.checked = checked;
    });
    updateWarehouseSelectedCount();
  }

  function updateWarehouseSelectedCount() {
    const selected = getSelectedWarehouseRows().length;
    const el = document.getElementById('warehouseSelectedCount');
    if (el) el.textContent = `已选择：${selected} 项`;
  }

  function setWarehouseSaveState(text) {
    const el = document.getElementById('warehouseSaveState');
    if (el) el.textContent = `自动保存：${text}`;
  }

  function onWarehouseCellEdit(event) {
    const input = event.target;
    const tr = input.closest('tr');
    if (!tr) return;
    const idx = Number(tr.dataset.idx);
    const field = input.dataset.field;
    if (!Number.isInteger(idx) || idx < 0 || !field || !warehouseItems[idx]) return;
    const item = warehouseItems[idx];
    if (field === 'quantity' || field === 'stocked_quantity' || field === 'daily_number') {
      item[field] = Number(input.value || 0) || 0;
    } else {
      item[field] = input.value;
    }
    if (input.tagName === 'TEXTAREA') autoResizeWarehouseTextarea(input);
    normalizeWarehouseLine(item, idx);
    scheduleWarehouseSync();
  }

  function normalizeWarehouseLine(item, idx) {
    if (!item) return;
    item.order_number = item.order_number || '';
    item.department = item.department || '';
    item.applicant = item.applicant || '';
    item.project_number = item.project_number || '';
    item.product_code = item.product_code || '';
    item.product_name = item.product_name || '';
    item.specification = item.specification || '';
    item.manufacturer = item.manufacturer || '';
    item.quantity = Number(item.quantity || 0) || 0;
    item.stocked_quantity = Number(item.stocked_quantity || 0) || 0;
    item.unit = item.unit || '个';
    item.stock_in_date = item.stock_in_date || new Date().toISOString().replace('T', ' ').slice(0, 19);
    item.location = item.location || '';
    item.barcode = item.barcode || `ORT${Date.now()}${idx + 1}`;
    item.daily_number = Number(item.daily_number || 0) || idx + 1;
  }

  async function syncWarehouseItems() {
    const resp = await fetch('/api/warehouse/purchase-orders/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: warehouseItems }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || '保存失败');
    }
    await loadWarehousePreview();
  }

  function scheduleWarehouseSync() {
    setWarehouseSaveState('保存中…');
    if (warehouseSaveTimer) {
      clearTimeout(warehouseSaveTimer);
    }
    warehouseSaveTimer = setTimeout(async () => {
      try {
        await syncWarehouseItems();
        setWarehouseSaveState('已保存');
      } catch (err) {
        setWarehouseSaveState('失败');
        alert(err.message || '保存失败');
      }
    }, 800);
  }

  async function warehouseStockInSelected() {
    const selected = getSelectedWarehouseRows();
    if (!selected.length) {
      alert('请先勾选要入库的行');
      return;
    }
    const payload = {
      operator_name: window.Auth && window.Auth.getUser ? (window.Auth.getUser()?.display_name || window.Auth.getUser()?.username || '') : '',
      notes: '网页端手动入库',
      items: selected.map((it) => ({
        barcode: it.barcode || '',
        quantity: Number(it.stocked_quantity || it.quantity || 0) || 0,
        location: it.location || '',
      })),
    };
    const resp = await fetch('/api/warehouse/purchase-orders/stock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || '入库失败');
    }
    alert(`入库完成：成功 ${data.result?.success ?? 0} 条，失败 ${data.result?.failed ?? 0} 条`);
    await loadWarehousePreview();
  }

  function makeWarehouseRowFromPrompt() {
    const barcode = `ORT${Date.now()}`;
    return {
      order_number: '',
      department: '',
      applicant: '',
      project_number: '',
      product_code: '',
      product_name: '新建物料',
      specification: '',
      manufacturer: '',
      quantity: 1,
      stocked_quantity: 0,
      unit: '个',
      stock_in_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      location: '',
      barcode,
      daily_number: 0,
    };
  }

  function normalizeWarehouseItem(it) {
    const barcode = String(it && it.barcode ? it.barcode : '').trim() || `ORT${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return {
      order_number: String((it && it.order_number) || ''),
      department: String((it && it.department) || ''),
      applicant: String((it && it.applicant) || ''),
      project_number: String((it && it.project_number) || ''),
      product_code: String((it && it.product_code) || ''),
      product_name: String((it && it.product_name) || ''),
      specification: String((it && it.specification) || ''),
      manufacturer: String((it && it.manufacturer) || ''),
      quantity: Number((it && it.quantity) || 0) || 0,
      stocked_quantity: Number((it && it.stocked_quantity) || 0) || 0,
      unit: String((it && it.unit) || '个'),
      stock_in_date: String((it && it.stock_in_date) || new Date().toISOString().replace('T', ' ').slice(0, 19)),
      location: String((it && it.location) || ''),
      barcode,
      daily_number: Number((it && it.daily_number) || 0) || 0,
    };
  }

  async function addWarehouseRow() {
    const item = normalizeWarehouseItem(makeWarehouseRowFromPrompt());
    warehouseItems.push(item);
    renderWarehouseTable(warehouseItems);
    scheduleWarehouseSync();
  }

  async function deleteWarehouseRows() {
    const selectedIndexes = [];
    const body = document.getElementById('warehouseTableBody');
    if (!body) return;
    body.querySelectorAll('tr').forEach((tr, idx) => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) selectedIndexes.push(idx);
    });
    if (!selectedIndexes.length) {
      alert('请先勾选要删除的行');
      return;
    }
    warehouseItems = warehouseItems.filter((_, idx) => !selectedIndexes.includes(idx));
    renderWarehouseTable(warehouseItems);
    scheduleWarehouseSync();
  }

  async function regenerateWarehouseBarcodes() {
    const selectedIndexes = [];
    const body = document.getElementById('warehouseTableBody');
    if (!body) return;
    body.querySelectorAll('tr').forEach((tr, idx) => {
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && cb.checked) selectedIndexes.push(idx);
    });
    if (!selectedIndexes.length) {
      alert('请先勾选要重新生成条形码的行');
      return;
    }
    selectedIndexes.forEach((idx) => {
      warehouseItems[idx].barcode = `ORT${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(idx + 1).padStart(4, '0')}`;
      warehouseItems[idx].daily_number = idx + 1;
    });
    renderWarehouseTable(warehouseItems);
    scheduleWarehouseSync();
  }

  async function importWarehouseFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.csv,.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch('/api/warehouse/purchase-orders/import-file', {
        method: 'POST',
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || '导入失败，请到「运维工具 → 日志」查看 http 日志');
      alert(`导入成功：${data.count ?? 0} 条`);
      await loadWarehousePreview();
    };
    input.click();
  }

  async function showWarehouseHistory() {
    const resp = await fetch('/api/warehouse/stock-in-history');
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || '历史记录加载失败');
    const items = Array.isArray(data.items) ? data.items : [];
    const html = items.length
      ? `<div class="warehouse-history-list">${items.map((it) => `
          <div class="warehouse-history-row">
            <div><strong>${escapeHtml(it.product_name || '')}</strong> <span>${escapeHtml(it.barcode || '')}</span></div>
            <div>${escapeHtml(it.department || '')} · ${escapeHtml(it.applicant || '')} · ${escapeHtml(String(it.quantity ?? 0))}${escapeHtml(it.unit || '')}</div>
            <div>${escapeHtml(it.stock_in_date || '')} · ${escapeHtml(it.location || '')} · ${escapeHtml(it.notes || '')}</div>
          </div>
        `).join('')}</div>`
      : '<p>暂无历史入库记录</p>';
    showWarehouseModal('历史入库记录', html);
  }

  function showWarehouseModal(title, bodyHtml) {
    let modal = document.getElementById('warehouseModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'warehouseModal';
      modal.className = 'modal-mask';
      modal.innerHTML = `
        <div class="modal-card modal-card-wide" role="dialog" aria-modal="true">
          <h2 id="warehouseModalTitle"></h2>
          <div id="warehouseModalBody"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" id="warehouseModalClose">关闭</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.hidden = true;
      });
      modal.querySelector('#warehouseModalClose').addEventListener('click', () => {
        modal.hidden = true;
      });
    }
    modal.querySelector('#warehouseModalTitle').textContent = title;
    modal.querySelector('#warehouseModalBody').innerHTML = bodyHtml;
    modal.hidden = false;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bindWarehouseActions() {
    const root = document.getElementById('warehouseRoot');
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    const btnWarehouseImport = document.getElementById('btnWarehouseImport');
    const btnWarehouseAddRow = document.getElementById('btnWarehouseAddRow');
    const btnWarehouseDeleteRows = document.getElementById('btnWarehouseDeleteRows');
    const btnWarehouseSelectAll = document.getElementById('btnWarehouseSelectAll');
    const btnWarehouseDeselectAll = document.getElementById('btnWarehouseDeselectAll');
    const btnWarehouseStockIn = document.getElementById('btnWarehouseStockIn');
    const btnWarehouseRegenerate = document.getElementById('btnWarehouseRegenerate');
    const btnWarehouseHistory = document.getElementById('btnWarehouseHistory');

    if (btnWarehouseImport) btnWarehouseImport.addEventListener('click', () => importWarehouseFile());
    if (btnWarehouseAddRow) btnWarehouseAddRow.addEventListener('click', () => addWarehouseRow().catch((err) => alert(err.message || '添加失败')));
    if (btnWarehouseDeleteRows) btnWarehouseDeleteRows.addEventListener('click', () => deleteWarehouseRows().catch((err) => alert(err.message || '删除失败')));
    if (btnWarehouseSelectAll) btnWarehouseSelectAll.addEventListener('click', () => setWarehouseCheckboxes(true));
    if (btnWarehouseDeselectAll) btnWarehouseDeselectAll.addEventListener('click', () => setWarehouseCheckboxes(false));
    if (btnWarehouseStockIn) btnWarehouseStockIn.addEventListener('click', () => warehouseStockInSelected().catch((err) => alert(err.message || '入库失败')));
    if (btnWarehouseRegenerate) btnWarehouseRegenerate.addEventListener('click', () => regenerateWarehouseBarcodes().catch((err) => alert(err.message || '重生成失败')));
    if (btnWarehouseHistory) btnWarehouseHistory.addEventListener('click', () => showWarehouseHistory().catch((err) => alert(err.message || '历史记录加载失败')));
  }

  function openLogin() {
    loginError.hidden = true;
    loginError.textContent = '';
    loginUsername.value = '';
    loginPassword.value = '';
    loginModal.hidden = false;
    setTimeout(() => loginUsername.focus(), 50);
  }

  function closeLogin() {
    loginModal.hidden = true;
  }

  function openPasswordModal() {
    if (!passwordModal) return;
    passwordError.hidden = true;
    passwordError.textContent = '';
    newPassword.value = '';
    newPasswordConfirm.value = '';
    passwordModal.hidden = false;
    setTimeout(() => newPassword.focus(), 50);
  }

  function closePasswordModal() {
    if (passwordModal) passwordModal.hidden = true;
  }

  async function submitPasswordChange() {
    passwordError.hidden = true;
    const pwd = (newPassword.value || '').trim();
    const confirm = (newPasswordConfirm.value || '').trim();
    if (!pwd) {
      passwordError.textContent = '请输入新密码';
      passwordError.hidden = false;
      return;
    }
    if (pwd.length < 4) {
      passwordError.textContent = '新密码至少 4 位';
      passwordError.hidden = false;
      return;
    }
    if (pwd !== confirm) {
      passwordError.textContent = '两次输入的密码不一致';
      passwordError.hidden = false;
      return;
    }
    try {
      await changeOwnPassword(pwd);
      closePasswordModal();
      alert('密码已更新，请牢记新密码。');
    } catch (err) {
      passwordError.textContent = err.message || '修改失败';
      passwordError.hidden = false;
    }
  }

  async function submitLogin() {
    loginError.hidden = true;
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    if (!username || !password) {
      loginError.textContent = '请输入账号和密码';
      loginError.hidden = false;
      return;
    }
    try {
      await window.Auth.login(username, password);
      closeLogin();
      refreshAuthUI();
      setView(viewSwitch.value, false);
    } catch (err) {
      loginError.textContent = err.message || '登录失败';
      loginError.hidden = false;
    }
  }

  viewSwitch.addEventListener('change', () => setView(viewSwitch.value, true));

  btnRefresh.addEventListener('click', () => {
    const v = viewSwitch.value;
    if (v === 'dashboard') {
      if (window.DashboardApp) window.DashboardApp.load(true);
      else setView('dashboard', false);
    } else if (v === 'projects') {
      if (window.ProjectListApp) window.ProjectListApp.load(true);
      else setView('projects', false);
    } else if (v === 'warehouse') {
      setView('warehouse', false);
    } else if (v === 'accounts') {
      if (window.AccountsApp) window.AccountsApp.load(true);
      else setView('accounts', false);
    } else if (v === 'departments') {
      if (window.DepartmentsApp) window.DepartmentsApp.load(true);
      else setView('departments', false);
    } else if (v === 'members') {
      if (window.MembersApp) window.MembersApp.load(true);
      else setView('members', false);
    } else if (v === 'tools') {
      if (window.AdminToolsApp) window.AdminToolsApp.load(true);
      else setView('tools', false);
    }
  });

  btnLogin.addEventListener('click', openLogin);
  if (btnChangePassword) {
    btnChangePassword.addEventListener('click', openPasswordModal);
  }
  btnLogout.addEventListener('click', async () => {
    await window.Auth.logout();
    refreshAuthUI();
    const v = viewSwitch.value;
    if (v === 'accounts' || v === 'departments' || v === 'members' || v === 'tools') {
      setView('dashboard', true);
    }
  });

  if (btnAddProject) {
    btnAddProject.addEventListener('click', () => {
      if (window.ProjectFormApp && typeof window.ProjectFormApp.openCreate === 'function') {
        window.ProjectFormApp.openCreate();
        return;
      }
      alert(
        '新建项目脚本未加载。请确认已同步 js/project-form.js，并强制刷新页面（Ctrl+F5）。'
      );
    });
  }

  if (btnOpenWarehouse) {
    btnOpenWarehouse.addEventListener('click', () => {
      setView('warehouse', true);
    });
  }

  document.getElementById('btnLoginCancel').addEventListener('click', closeLogin);
  document.getElementById('btnLoginSubmit').addEventListener('click', submitLogin);
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLogin();
  });

  if (passwordModal) {
    document.getElementById('btnPasswordCancel').addEventListener('click', closePasswordModal);
    document.getElementById('btnPasswordSave').addEventListener('click', submitPasswordChange);
    newPasswordConfirm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPasswordChange();
    });
    passwordModal.addEventListener('click', (e) => {
      if (e.target === passwordModal) closePasswordModal();
    });
  }

  document.addEventListener('authchange', () => {
    refreshAuthUI();
  });

  let kioskMode = false;
  let autoRefreshTimer = null;
  let idleKioskTimer = null;
  let promoteFsHandler = null;
  const AUTO_REFRESH_MS = 60 * 1000;
  const IDLE_KIOSK_MS = 20 * 1000;

  function isKioskQuery() {
    const q = new URLSearchParams(window.location.search);
    return q.get('kiosk') === '1' || q.get('fullscreen') === '1';
  }

  function isDesktopLayout() {
    return window.matchMedia('(min-width: 960px)').matches;
  }

  function anyModalOpen() {
    return !!document.querySelector('.modal-mask:not([hidden])');
  }

  function clearIdleKioskTimer() {
    if (idleKioskTimer) {
      clearTimeout(idleKioskTimer);
      idleKioskTimer = null;
    }
  }

  function clearPromoteFullscreen() {
    if (!promoteFsHandler) return;
    document.removeEventListener('pointerdown', promoteFsHandler, true);
    document.removeEventListener('keydown', promoteFsHandler, true);
    promoteFsHandler = null;
  }

  function isBrowserFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /** 系统全屏必须在真实用户手势里调用；定时器触发会失败，需等下一次点击/按键补上 */
  function armPromoteBrowserFullscreen() {
    clearPromoteFullscreen();
    if (!kioskMode || isBrowserFullscreen()) return;
    promoteFsHandler = (e) => {
      if (!e || e.isTrusted === false) return;
      if (!kioskMode) {
        clearPromoteFullscreen();
        return;
      }
      if (isBrowserFullscreen()) {
        clearPromoteFullscreen();
        return;
      }
      clearPromoteFullscreen();
      requestBrowserFullscreen();
    };
    document.addEventListener('pointerdown', promoteFsHandler, true);
    document.addEventListener('keydown', promoteFsHandler, true);
  }

  function enterKioskLikeButton() {
    // 与手动点「全屏展示」同一条路径
    if (btnKiosk) {
      btnKiosk.click();
    } else {
      setKioskMode(true);
    }
    // 定时器触发的 click 浏览器不给系统全屏权限，下一轮真实操作时补上
    setTimeout(() => {
      if (kioskMode && !isBrowserFullscreen()) armPromoteBrowserFullscreen();
    }, 0);
  }

  function isOnDashboardView() {
    return !!(viewSwitch && viewSwitch.value === 'dashboard');
  }

  function scheduleIdleKiosk() {
    clearIdleKioskTimer();
    if (!isDesktopLayout()) return;
    // 仅总览看板才自动进全屏；其它界面不计时
    if (!isOnDashboardView()) return;
    idleKioskTimer = setTimeout(() => {
      idleKioskTimer = null;
      if (!isDesktopLayout() || !isOnDashboardView()) return;
      if (kioskMode || anyModalOpen()) {
        scheduleIdleKiosk();
        return;
      }
      enterKioskLikeButton();
    }, IDLE_KIOSK_MS);
  }

  function onUserActivityForIdleKiosk() {
    if (!isOnDashboardView()) {
      clearIdleKioskTimer();
      return;
    }
    scheduleIdleKiosk();
  }

  function syncKioskUrl(on) {
    const url = new URL(window.location.href);
    if (on) {
      url.searchParams.set('view', 'dashboard');
      url.searchParams.set('kiosk', '1');
    } else {
      url.searchParams.delete('kiosk');
      url.searchParams.delete('fullscreen');
    }
    history.replaceState(null, '', url);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function refreshDashboardSoft() {
    if (anyModalOpen()) return;
    if (!isOnDashboardView()) return;
    if (window.DashboardApp) window.DashboardApp.load(true);
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
      if (document.hidden) return;
      // 定时刷新只刷总览看板
      refreshDashboardSoft();
    }, AUTO_REFRESH_MS);
  }

  function requestBrowserFullscreen() {
    const el = document.documentElement;
    try {
      // 尽量同步发起，保留用户手势激活态
      if (el.requestFullscreen) {
        const p = el.requestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch (e) {
      /* 无用户手势时会失败；页面内 kiosk 布局仍可用 */
    }
  }

  async function exitBrowserFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (e) {
      /* ignore */
    }
  }

  function setKioskMode(on, opts) {
    const options = opts || {};
    kioskMode = !!on;
    document.body.classList.toggle('kiosk-mode', kioskMode);
    if (btnKiosk) btnKiosk.hidden = kioskMode;
    if (btnKioskExit) btnKioskExit.hidden = !kioskMode;

    if (kioskMode) {
      setView('dashboard', false);
      syncKioskUrl(true);
      if (options.browserFullscreen !== false) requestBrowserFullscreen();
      if (window.DashboardApp && typeof window.DashboardApp.onKioskChange === 'function') {
        window.DashboardApp.onKioskChange(true);
      }
    } else {
      clearPromoteFullscreen();
      syncKioskUrl(false);
      if (options.browserFullscreen !== false) exitBrowserFullscreen();
      if (window.DashboardApp && typeof window.DashboardApp.onKioskChange === 'function') {
        window.DashboardApp.onKioskChange(false);
      }
    }
    // 进入或退出全屏后都重新计时：退出后满 20 秒无操作会再进全屏
    scheduleIdleKiosk();
  }

  if (btnKiosk) {
    // 在点击回调最前面同步申请系统全屏（与用户手势同一调用栈）
    btnKiosk.addEventListener('click', () => {
      requestBrowserFullscreen();
      setKioskMode(true, { browserFullscreen: false });
    });
  }
  if (btnKioskExit) {
    btnKioskExit.addEventListener('click', () => setKioskMode(false));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && kioskMode) setKioskMode(false);
  });
  document.addEventListener('fullscreenchange', () => {
    // 用户按系统 Esc 退出浏览器全屏时，同步退出看板展示模式
    if (!document.fullscreenElement && kioskMode) {
      setKioskMode(false, { browserFullscreen: false });
    }
  });

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'pointerdown', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, onUserActivityForIdleKiosk, { passive: true });
  });
  window.addEventListener('resize', () => {
    if (isDesktopLayout() && isOnDashboardView()) scheduleIdleKiosk();
    else clearIdleKioskTimer();
  });

  refreshAuthUI();
  setView(currentView(), true);
  startAutoRefresh();

  // 电视常用：同一链接加 ?kiosk=1 开机直进展示模式
  if (isKioskQuery()) {
    setKioskMode(true, { browserFullscreen: true });
    setTimeout(() => {
      if (kioskMode && !isBrowserFullscreen()) armPromoteBrowserFullscreen();
    }, 0);
  } else {
    scheduleIdleKiosk();
  }

  // 从子任务等页面跳转回来时自动弹出登录
  const isPreviewPage = window.location && window.location.pathname.indexOf('/mobile-preview/') >= 0;
  const loginFlag = new URLSearchParams(window.location.search).get('login');
  if ((isPreviewPage || loginFlag === '1') && !(window.Auth && window.Auth.isLoggedIn())) {
    openLogin();
  }
})();

