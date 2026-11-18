/**
 * 部门进度：按项目展示参与部门（负责人+成员主部门），管理员可填 0–100%。
 *
 * DOM：#deptProgressView #deptProgressYear #deptProgressSummaryBar #deptProgressRoot
 */
(function () {
  const yearSelect = document.getElementById('deptProgressYear');
  const summaryBar = document.getElementById('deptProgressSummaryBar');
  const root = document.getElementById('deptProgressRoot');

  let loadedOnce = false;
  let cacheKey = '';

  if (yearSelect) {
    yearSelect.addEventListener('change', () => load(true));
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

  function progressLabel(cell) {
    if (cell == null || cell.progress == null || cell.progress === '') return '—';
    const n = Number(cell.progress);
    if (!Number.isFinite(n)) return '—';
    return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
  }

  function renderDeptCell(project, cell, editable) {
    const deptId = cell.department_id;
    const name = escapeHtml(cell.department_name || `部门#${deptId}`);
    if (!editable) {
      return `<span class="dept-progress-chip">
        <span class="dept-progress-name">${name}</span>
        <span class="dept-progress-value">${escapeHtml(progressLabel(cell))}</span>
      </span>`;
    }
    const val = cell.progress != null && Number.isFinite(Number(cell.progress)) ? String(cell.progress) : '';
    return `<label class="dept-progress-chip is-editable">
      <span class="dept-progress-name">${name}</span>
      <input
        type="number"
        class="dept-progress-input"
        min="0"
        max="100"
        step="1"
        inputmode="numeric"
        data-project-id="${escapeHtml(String(project.project_id))}"
        data-department-id="${escapeHtml(String(deptId))}"
        value="${escapeHtml(val)}"
        placeholder="—"
        aria-label="${name}进度"
      />
      <span class="dept-progress-suffix">%</span>
    </label>`;
  }

  function bindEditors() {
    if (!root || !canEdit()) return;
    root.querySelectorAll('.dept-progress-input').forEach((input) => {
      const save = async () => {
        const projectId = Number(input.getAttribute('data-project-id'));
        const departmentId = Number(input.getAttribute('data-department-id'));
        const raw = String(input.value || '').trim();
        if (raw === '') {
          if (summaryBar) summaryBar.textContent = '进度不能为空，请填写 0–100';
          return;
        }
        const progress = Number(raw);
        if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
          if (summaryBar) summaryBar.textContent = '进度须为 0–100 的整数';
          input.focus();
          return;
        }
        input.disabled = true;
        try {
          await updateDepartmentProgress({
            project_id: projectId,
            department_id: departmentId,
            progress,
          });
          input.dataset.saved = String(progress);
          if (summaryBar) {
            const base = summaryBar.dataset.baseText || summaryBar.textContent;
            summaryBar.dataset.baseText = base.replace(/\s·\s已保存.*$/, '');
            summaryBar.textContent = `${summaryBar.dataset.baseText} · 已保存`;
          }
        } catch (err) {
          if (summaryBar) summaryBar.textContent = err.message || '保存失败';
          if (input.dataset.saved != null) input.value = input.dataset.saved;
        } finally {
          input.disabled = false;
        }
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        }
      });
      input.addEventListener('blur', () => {
        const cur = String(input.value || '').trim();
        const prev = input.dataset.saved != null ? String(input.dataset.saved) : '';
        if (cur !== prev) save();
      });
      if (input.value !== '') input.dataset.saved = input.value;
    });
  }

  function render(projects) {
    if (!root) return;
    const editable = canEdit();
    if (!projects.length) {
      root.innerHTML = '<div class="state-box"><p>暂无项目</p></div>';
      return;
    }
    const body = projects
      .map((p) => {
        const depts = Array.isArray(p.departments) ? p.departments : [];
        const deptHtml = depts.length
          ? depts.map((c) => renderDeptCell(p, c, editable)).join('')
          : '<span class="muted">暂无参与部门</span>';
        return `<tr>
          <td class="col-group">${escapeHtml(p.work_no || '—')}</td>
          <td>${escapeHtml(p.name || '—')}</td>
          <td class="dept-progress-cell">${deptHtml}</td>
        </tr>`;
      })
      .join('');

    root.innerHTML = `
      <div class="table-wrap">
        <table class="dash-table dept-progress-table">
          <thead>
            <tr>
              <th>工番号</th>
              <th>项目名称</th>
              <th>参与部门进度</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    bindEditors();
  }

  async function load(force) {
    if (!root || !summaryBar) return;
    const year = yearSelect ? yearSelect.value : '';
    const key = `${year}|${canEdit() ? 'edit' : 'view'}`;
    if (loadedOnce && !force && cacheKey === key && root.dataset.filled === '1') {
      return;
    }
    showLoading(root, '正在加载部门进度…');
    summaryBar.textContent = '加载中…';
    try {
      const data = await fetchDepartmentProgress(year);
      const projects = data.projects || [];
      fillYearOptions(data.years || []);
      if (year && yearSelect) yearSelect.value = year;
      const hint = canEdit()
        ? `共 ${projects.length} 个项目 · 管理员可直接改进度（0–100）后回车或失焦保存`
        : `共 ${projects.length} 个项目 · 只读（管理员可填写进度）`;
      summaryBar.textContent = hint;
      summaryBar.dataset.baseText = hint;
      render(projects);
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
