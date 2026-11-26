/**
 * 部门进度：自定义阶段表头（首列固定「采购品进度」），单元格 0–100% 或横杠。
 *
 * DOM：#deptProgressView 相关控件与 #deptProgressRoot
 */
(function () {
  const yearSelect = document.getElementById('deptProgressYear');
  const statusSelect = document.getElementById('deptProgressStatus');
  const summaryBar = document.getElementById('deptProgressSummaryBar');
  const root = document.getElementById('deptProgressRoot');
  const columnsBtn = document.getElementById('deptProgressColumnsBtn');
  const columnsModal = document.getElementById('deptProgressColumnsModal');
  const columnsList = document.getElementById('deptProgressColumnsList');
  const columnsClose = document.getElementById('deptProgressColumnsClose');
  const columnsSave = document.getElementById('deptProgressColumnsSave');

  let loadedOnce = false;
  let cacheKey = '';
  let lastCatalog = [];
  let lastColumns = [];

  if (yearSelect) yearSelect.addEventListener('change', () => load(true));
  if (statusSelect) statusSelect.addEventListener('change', () => load(true));

  if (columnsBtn) {
    columnsBtn.addEventListener('click', () => openColumnsModal());
  }
  if (columnsClose) {
    columnsClose.addEventListener('click', () => closeColumnsModal());
  }
  if (columnsModal) {
    columnsModal.addEventListener('click', (e) => {
      if (e.target === columnsModal) closeColumnsModal();
    });
  }
  if (columnsSave) {
    columnsSave.addEventListener('click', saveColumns);
  }

  function canEdit() {
    return !!(window.Auth && typeof window.Auth.isAdminOrAbove === 'function' && window.Auth.isAdminOrAbove());
  }

  function fillYearOptions(years) {
    if (!yearSelect) return;
    const current = yearSelect.value;
    const key = (years || []).join('\0');
    if (yearSelect.dataset.yearsKey === key) {
      if ((years || []).includes(current)) yearSelect.value = current;
      return;
    }
    yearSelect.dataset.yearsKey = key;
    const opts = ['<option value="">全部</option>'].concat(
      (years || []).map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`)
    );
    yearSelect.innerHTML = opts.join('');
    if ((years || []).includes(current)) yearSelect.value = current;
  }

  function cellDisplay(cell) {
    if (!cell) return '—';
    if (cell.is_na) return '—';
    if (cell.progress == null || cell.progress === '') return '';
    const n = Number(cell.progress);
    if (!Number.isFinite(n)) return '';
    return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
  }

  function renderCell(project, stageKey, cell, editable) {
    const pid = project.project_id;
    if (!editable) {
      const text = cellDisplay(cell);
      const cls = cell && cell.is_na ? 'is-na' : text === '' ? 'is-empty' : 'has-value';
      return `<td class="dept-progress-stage ${cls}">${escapeHtml(text || '—')}</td>`;
    }
    const isNA = !!(cell && cell.is_na);
    const val =
      !isNA && cell && cell.progress != null && Number.isFinite(Number(cell.progress))
        ? String(cell.progress)
        : '';
    const saved = isNA ? 'na' : val;
    return `<td class="dept-progress-stage is-editable">
      <div class="dept-progress-editor">
        <input
          type="number"
          class="dept-progress-input"
          min="0"
          max="100"
          step="1"
          inputmode="numeric"
          data-project-id="${escapeHtml(String(pid))}"
          data-stage-key="${escapeHtml(stageKey)}"
          data-saved="${escapeHtml(saved)}"
          value="${escapeHtml(val)}"
          ${isNA ? 'disabled' : ''}
          placeholder="%"
          aria-label="${escapeHtml(stageKey)}"
        />
        <button
          type="button"
          class="dept-progress-na-btn${isNA ? ' is-active' : ''}"
          data-project-id="${escapeHtml(String(pid))}"
          data-stage-key="${escapeHtml(stageKey)}"
          title="标记为不适用（横杠）"
        >—</button>
      </div>
    </td>`;
  }

  async function persistCell(projectId, stageKey, payload, control) {
    if (control) control.disabled = true;
    try {
      await updateDepartmentProgress({
        project_id: projectId,
        stage_key: stageKey,
        ...payload,
      });
      if (summaryBar) {
        const base = (summaryBar.dataset.baseText || summaryBar.textContent || '').replace(
          /\s·\s已保存.*$/,
          ''
        );
        summaryBar.dataset.baseText = base;
        summaryBar.textContent = `${base} · 已保存`;
      }
      return true;
    } catch (err) {
      if (summaryBar) summaryBar.textContent = err.message || '保存失败';
      return false;
    } finally {
      if (control) control.disabled = false;
    }
  }

  function bindEditors() {
    if (!root || !canEdit()) return;

    root.querySelectorAll('.dept-progress-input').forEach((input) => {
      const save = async () => {
        const projectId = Number(input.getAttribute('data-project-id'));
        const stageKey = input.getAttribute('data-stage-key') || '';
        const raw = String(input.value || '').trim();
        const prev = input.dataset.saved || '';
        if (raw === '') {
          if (prev === '' || prev === 'na') return;
          const ok = await persistCell(projectId, stageKey, { clear: true }, input);
          if (ok) input.dataset.saved = '';
          return;
        }
        const progress = Number(raw);
        if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
          if (summaryBar) summaryBar.textContent = '进度须为 0–100 的整数';
          input.focus();
          return;
        }
        if (prev === String(progress)) return;
        const ok = await persistCell(projectId, stageKey, { progress, is_na: false }, input);
        if (ok) {
          input.dataset.saved = String(progress);
          const btn = input.parentElement && input.parentElement.querySelector('.dept-progress-na-btn');
          if (btn) btn.classList.remove('is-active');
        } else if (prev === 'na') {
          input.value = '';
        } else {
          input.value = prev;
        }
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        }
      });
      input.addEventListener('blur', () => {
        if (input.disabled) return;
        save();
      });
    });

    root.querySelectorAll('.dept-progress-na-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const projectId = Number(btn.getAttribute('data-project-id'));
        const stageKey = btn.getAttribute('data-stage-key') || '';
        const editor = btn.parentElement;
        const input = editor && editor.querySelector('.dept-progress-input');
        const active = btn.classList.contains('is-active');
        if (active) {
          const ok = await persistCell(projectId, stageKey, { clear: true }, btn);
          if (!ok) return;
          btn.classList.remove('is-active');
          if (input) {
            input.disabled = false;
            input.value = '';
            input.dataset.saved = '';
            input.focus();
          }
          return;
        }
        const ok = await persistCell(projectId, stageKey, { is_na: true }, btn);
        if (!ok) return;
        btn.classList.add('is-active');
        if (input) {
          input.value = '';
          input.disabled = true;
          input.dataset.saved = 'na';
        }
      });
    });
  }

  function render(projects, columns) {
    if (!root) return;
    const editable = canEdit();
    const cols = Array.isArray(columns) && columns.length ? columns : [{ key: '采购品进度', label: '采购品进度', fixed: true }];

    if (!projects.length) {
      root.innerHTML = '<div class="state-box"><p>暂无项目</p></div>';
      return;
    }

    const head = [
      '<th>工番号</th>',
      '<th>项目名称</th>',
      '<th>完成状态</th>',
    ]
      .concat(cols.map((c) => `<th class="dept-progress-col-head" title="${escapeHtml(c.label || c.key)}">${escapeHtml(c.label || c.key)}</th>`))
      .join('');

    const body = projects
      .map((p) => {
        const cells = p.cells || {};
        const stageCells = cols
          .map((c) => renderCell(p, c.key, cells[c.key], editable))
          .join('');
        return `<tr>
          <td class="col-group">${escapeHtml(p.work_no || '—')}</td>
          <td>${escapeHtml(p.name || '—')}</td>
          <td>${escapeHtml(p.status || '—')}</td>
          ${stageCells}
        </tr>`;
      })
      .join('');

    root.innerHTML = `
      <div class="table-wrap dept-progress-wrap">
        <table class="dash-table dept-progress-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    bindEditors();
  }

  function openColumnsModal() {
    if (!columnsModal || !columnsList) return;
    const selected = new Set(
      (lastColumns || []).filter((c) => c && !c.fixed).map((c) => c.key)
    );
    const catalog = lastCatalog && lastCatalog.length ? lastCatalog : [];
    columnsList.innerHTML = catalog.length
      ? catalog
          .map((c) => {
            const key = c.key || c.label;
            const checked = selected.has(key) ? ' checked' : '';
            return `<label class="dept-progress-columns-item">
              <input type="checkbox" value="${escapeHtml(key)}"${checked} />
              <span>${escapeHtml(c.label || key)}</span>
            </label>`;
          })
          .join('')
      : '<p class="muted">暂无可选阶段</p>';
    columnsModal.hidden = false;
  }

  function closeColumnsModal() {
    if (columnsModal) columnsModal.hidden = true;
  }

  async function saveColumns() {
    if (!columnsList || !columnsSave) return;
    const columns = Array.from(columnsList.querySelectorAll('input[type="checkbox"]:checked')).map(
      (el) => el.value
    );
    columnsSave.disabled = true;
    try {
      await updateDepartmentProgressColumns(columns);
      closeColumnsModal();
      await load(true);
    } catch (err) {
      if (summaryBar) summaryBar.textContent = err.message || '表头保存失败';
    } finally {
      columnsSave.disabled = false;
    }
  }

  async function load(force) {
    if (!root || !summaryBar) return;
    if (columnsBtn) columnsBtn.hidden = !canEdit();

    const year = yearSelect ? yearSelect.value : '';
    const status = statusSelect ? statusSelect.value : '';
    const key = `${year}|${status}|${canEdit() ? 'edit' : 'view'}`;
    if (loadedOnce && !force && cacheKey === key && root.dataset.filled === '1') {
      return;
    }
    showLoading(root, '正在加载部门进度…');
    summaryBar.textContent = '加载中…';
    try {
      const data = await fetchDepartmentProgress(year, status);
      const projects = data.projects || [];
      lastCatalog = data.catalog || [];
      lastColumns = data.columns || [];
      fillYearOptions(data.years || []);
      if (year && yearSelect) yearSelect.value = year;
      const colCount = (lastColumns || []).length;
      const hint = canEdit()
        ? `共 ${projects.length} 个项目 · ${colCount} 列 · 填 0–100 或点「—」标不适用 · 可配置表头`
        : `共 ${projects.length} 个项目 · ${colCount} 列 · 只读`;
      summaryBar.textContent = hint;
      summaryBar.dataset.baseText = hint;
      render(projects, lastColumns);
      loadedOnce = true;
      cacheKey = key;
      root.dataset.filled = '1';
    } catch (err) {
      showError(root, err.message || '加载失败');
      summaryBar.textContent = '加载失败';
      root.dataset.filled = '0';
    }
  }

  window.DeptProgressApp = { load };
})();
