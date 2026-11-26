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

  const viewEl = document.getElementById('deptProgressView');
  const IDLE_SHOWCASE_MS = 10 * 1000;
  const SHOWCASE_SPEED = 0.18;
  const SHOWCASE_EDGE_PAUSE_MS = 2800;

  let loadedOnce = false;
  let cacheKey = '';
  let lastCatalog = [];
  let lastColumns = [];
  let idleShowcaseTimer = null;
  let showcaseRaf = null;
  let showcaseDirY = 1;
  let showcaseEdgePauseUntil = 0;
  let showcaseBound = false;

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

  function isViewActive() {
    return !!(viewEl && !viewEl.hidden);
  }

  function getWrap() {
    return root ? root.querySelector('.dept-progress-wrap') : null;
  }

  function clearIdleShowcase() {
    if (idleShowcaseTimer) {
      clearTimeout(idleShowcaseTimer);
      idleShowcaseTimer = null;
    }
  }

  function pauseShowcaseAndRearm() {
    stopShowcase();
    scheduleIdleShowcase();
  }

  function isEditingCell() {
    const active = document.activeElement;
    return !!(active && active.classList && active.classList.contains('dept-progress-input'));
  }

  function scheduleIdleShowcase() {
    clearIdleShowcase();
    stopShowcase();
    if (!isViewActive() || !getWrap()) return;
    if (columnsModal && !columnsModal.hidden) return;
    idleShowcaseTimer = setTimeout(() => {
      idleShowcaseTimer = null;
      if (!isViewActive()) return;
      if (columnsModal && !columnsModal.hidden) {
        scheduleIdleShowcase();
        return;
      }
      // 仅在正在改单元格进度时推迟；工具栏下拉框有焦点不阻止展示
      if (isEditingCell()) {
        scheduleIdleShowcase();
        return;
      }
      const active = document.activeElement;
      if (active && viewEl && viewEl.contains(active) && typeof active.blur === 'function') {
        if (active.matches('select,button')) active.blur();
      }
      startShowcase();
    }, IDLE_SHOWCASE_MS);
  }

  function startShowcase() {
    const wrap = getWrap();
    if (!wrap || showcaseRaf) return;
    const maxY = wrap.scrollHeight - wrap.clientHeight;
    if (maxY <= 1) {
      // 纵向无可滚内容时稍后重试，避免静默失败
      scheduleIdleShowcase();
      return;
    }

    wrap.classList.add('is-showcasing');
    showcaseEdgePauseUntil = 0;
    showcaseDirY = 1;
    // 只纵向缓滚，避免列快速横移看不清；到顶/底停顿再折返
    const tick = () => {
      if (!isViewActive()) {
        stopShowcase();
        return;
      }
      const el = getWrap();
      if (!el) {
        stopShowcase();
        return;
      }
      const yMax = el.scrollHeight - el.clientHeight;
      if (yMax <= 1) {
        scheduleIdleShowcase();
        return;
      }
      const now = performance.now();
      if (now < showcaseEdgePauseUntil) {
        showcaseRaf = requestAnimationFrame(tick);
        return;
      }
      el.scrollTop += SHOWCASE_SPEED * showcaseDirY;
      if (el.scrollTop >= yMax - 0.5) {
        el.scrollTop = yMax;
        showcaseDirY = -1;
        showcaseEdgePauseUntil = now + SHOWCASE_EDGE_PAUSE_MS;
      } else if (el.scrollTop <= 0.5) {
        el.scrollTop = 0;
        showcaseDirY = 1;
        showcaseEdgePauseUntil = now + SHOWCASE_EDGE_PAUSE_MS;
      }
      showcaseRaf = requestAnimationFrame(tick);
    };
    showcaseRaf = requestAnimationFrame(tick);
  }

  function stopShowcase() {
    if (showcaseRaf) {
      cancelAnimationFrame(showcaseRaf);
      showcaseRaf = null;
    }
    const wrap = getWrap();
    if (wrap) wrap.classList.remove('is-showcasing');
  }

  function bindShowcaseIdle() {
    if (showcaseBound || !viewEl) return;
    showcaseBound = true;
    const onActivity = (e) => {
      if (!isViewActive()) return;
      // 自动滚动本身不产生这些事件；用户操作则重置计时
      if (e && e.isTrusted === false) return;
      pauseShowcaseAndRearm();
    };
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((type) => {
      viewEl.addEventListener(type, onActivity, { passive: true, capture: true });
    });
    viewEl.addEventListener(
      'focusin',
      (e) => {
        if (!e.target || !e.target.classList || !e.target.classList.contains('dept-progress-input')) return;
        stopShowcase();
        clearIdleShowcase();
      },
      true
    );
    viewEl.addEventListener(
      'focusout',
      (e) => {
        if (!e.target || !e.target.classList || !e.target.classList.contains('dept-progress-input')) return;
        setTimeout(() => {
          if (!isViewActive() || isEditingCell()) return;
          scheduleIdleShowcase();
        }, 0);
      },
      true
    );
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

  function applyNaState(input, isNA) {
    if (!input) return;
    if (isNA) {
      input.value = '—';
      input.dataset.saved = 'na';
      input.readOnly = true;
      input.classList.add('is-na');
      input.title = '右键取消横杠，恢复填写';
    } else {
      if (input.dataset.saved === 'na') input.value = '';
      input.readOnly = false;
      input.classList.remove('is-na');
      input.title = '填写 0–100；右键标为横杠（不适用）';
    }
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
      isNA
        ? '—'
        : cell && cell.progress != null && Number.isFinite(Number(cell.progress))
          ? String(cell.progress)
          : '';
    const saved = isNA ? 'na' : val;
    return `<td class="dept-progress-stage is-editable">
      <input
        type="text"
        class="dept-progress-input${isNA ? ' is-na' : ''}"
        inputmode="numeric"
        autocomplete="off"
        data-project-id="${escapeHtml(String(pid))}"
        data-stage-key="${escapeHtml(stageKey)}"
        data-saved="${escapeHtml(saved)}"
        value="${escapeHtml(val)}"
        ${isNA ? 'readonly' : ''}
        placeholder="%"
        title="${isNA ? '右键取消横杠，恢复填写' : '填写 0–100；右键标为横杠（不适用）'}"
        aria-label="${escapeHtml(stageKey)}"
      />
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
        if (input.readOnly || input.dataset.saved === 'na') return;
        const projectId = Number(input.getAttribute('data-project-id'));
        const stageKey = input.getAttribute('data-stage-key') || '';
        const raw = String(input.value || '').trim();
        const prev = input.dataset.saved || '';
        if (raw === '' || raw === '—') {
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
        if (ok) input.dataset.saved = String(progress);
        else input.value = prev === 'na' ? '—' : prev;
      };

      input.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        const projectId = Number(input.getAttribute('data-project-id'));
        const stageKey = input.getAttribute('data-stage-key') || '';
        const isNA = input.dataset.saved === 'na';
        if (isNA) {
          const ok = await persistCell(projectId, stageKey, { clear: true }, input);
          if (!ok) return;
          input.dataset.saved = '';
          applyNaState(input, false);
          input.value = '';
          input.focus();
          return;
        }
        const ok = await persistCell(projectId, stageKey, { is_na: true }, input);
        if (!ok) return;
        applyNaState(input, true);
      });

      input.addEventListener('keydown', (e) => {
        if (input.readOnly) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        }
      });
      input.addEventListener('blur', () => {
        if (input.readOnly) return;
        save();
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
      '<th class="dept-progress-sticky col-work">工番号</th>',
      '<th class="dept-progress-sticky col-name">项目名称</th>',
      '<th class="dept-progress-sticky col-status">完成状态</th>',
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
          <td class="dept-progress-sticky col-work col-group">${escapeHtml(p.work_no || '—')}</td>
          <td class="dept-progress-sticky col-name" title="${escapeHtml(p.name || '')}">${escapeHtml(p.name || '—')}</td>
          <td class="dept-progress-sticky col-status">${escapeHtml(p.status || '—')}</td>
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
    bindShowcaseIdle();
    scheduleIdleShowcase();
  }

  function openColumnsModal() {
    if (!columnsModal || !columnsList) return;
    pause();
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
    if (isViewActive()) scheduleIdleShowcase();
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
      bindShowcaseIdle();
      scheduleIdleShowcase();
      return;
    }
    stopShowcase();
    clearIdleShowcase();
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
        ? `共 ${projects.length} 个项目 · ${colCount} 列 · 填 0–100；右键标横杠 · 可配置表头 · 闲置自动滚动`
        : `共 ${projects.length} 个项目 · ${colCount} 列 · 只读 · 闲置自动滚动`;
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

  function pause() {
    stopShowcase();
    clearIdleShowcase();
  }

  window.DeptProgressApp = { load, pause };
})();
