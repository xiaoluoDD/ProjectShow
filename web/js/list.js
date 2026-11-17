(function () {
  const listRoot = document.getElementById('listRoot');
  const summaryBar = document.getElementById('summaryBar');
  const filterPanel = document.getElementById('filterPanel');
  const filterName = document.getElementById('filterName');
  const filterYear = document.getElementById('filterYear');
  const filterYearSearch = document.getElementById('filterYearSearch');
  const filterWorkNo = document.getElementById('filterWorkNo');
  const filterWorkNoSearch = document.getElementById('filterWorkNoSearch');
  const filterManager = document.getElementById('filterManager');
  const filterManagerSearch = document.getElementById('filterManagerSearch');
  const filterStatus = document.getElementById('filterStatus');
  const filterStatusSearch = document.getElementById('filterStatusSearch');

  let allProjects = [];
  let loadedOnce = false;
  let touchStartY = 0;
  let pulling = false;

  document.getElementById('btnFilter').addEventListener('click', () => {
    filterPanel.classList.toggle('open');
  });

  document.getElementById('btnApplyFilter').addEventListener('click', () => {
    renderList();
    filterPanel.classList.remove('open');
  });
  document.getElementById('btnClearFilter').addEventListener('click', () => {
    filterName.value = '';
    filterYear.value = '';
    filterYearSearch.value = '';
    filterWorkNo.value = '';
    filterWorkNoSearch.value = '';
    filterManager.value = '';
    filterManagerSearch.value = '';
    filterStatus.value = '';
    filterStatusSearch.value = '';
    renderList();
  });

  [filterYear, filterWorkNo, filterManager, filterStatus].forEach((el) => {
    el.addEventListener('change', renderList);
  });
  // 名称筛选 + 每个下拉框旁的输入框：支持直接打字实时查找，不用逐个翻下拉框选项。
  [filterName, filterYearSearch, filterWorkNoSearch, filterManagerSearch, filterStatusSearch].forEach(
    (el) => {
      el.addEventListener('input', renderList);
    }
  );

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0) {
      touchStartY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!pulling) return;
    pulling = false;
    const delta = e.changedTouches[0].clientY - touchStartY;
    if (window.scrollY <= 0 && delta > 80) {
      const view = document.getElementById('viewSwitch');
      if (view && view.value === 'projects') load(true);
    }
  }, { passive: true });

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'zh-CN')
    );
  }

  function fillSelect(select, values) {
    const current = select.value;
    const opts = ['<option value="">全部</option>'].concat(
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
    );
    select.innerHTML = opts.join('');
    if (values.includes(current)) select.value = current;
  }

  function rebuildFilterOptions() {
    fillSelect(
      filterYear,
      uniqueSorted(allProjects.map((p) => (p.year || '').trim()))
    );
    fillSelect(
      filterWorkNo,
      uniqueSorted(allProjects.map((p) => (p.work_no || '').trim()))
    );
    fillSelect(
      filterManager,
      uniqueSorted(allProjects.map((p) => managerText(p)))
    );
  }

  function passesFilter(project) {
    const name = filterName.value.trim().toLowerCase();
    const year = filterYear.value;
    const yearSearch = filterYearSearch.value.trim().toLowerCase();
    const workNo = filterWorkNo.value;
    const workNoSearch = filterWorkNoSearch.value.trim().toLowerCase();
    const manager = filterManager.value;
    const managerSearch = filterManagerSearch.value.trim().toLowerCase();
    const status = filterStatus.value;
    const statusSearch = filterStatusSearch.value.trim().toLowerCase();

    if (name && !(project.name || '').toLowerCase().includes(name)) return false;

    // 每个字段：只要旁边的输入框填了关键字，就按"包含"匹配直接查找，
    // 优先于下拉框的精确选择；输入框为空时才回退到下拉框的精确匹配。
    if (yearSearch) {
      if (!(project.year || '').toLowerCase().includes(yearSearch)) return false;
    } else if (year && (project.year || '').trim() !== year) {
      return false;
    }

    if (workNoSearch) {
      if (!(project.work_no || '').toLowerCase().includes(workNoSearch)) return false;
    } else if (workNo && (project.work_no || '').trim() !== workNo) {
      return false;
    }

    if (managerSearch) {
      if (!managerText(project).toLowerCase().includes(managerSearch)) return false;
    } else if (manager && managerText(project) !== manager) {
      return false;
    }

    if (statusSearch) {
      if (!(project.status || '').toLowerCase().includes(statusSearch)) return false;
    } else if (status && (project.status || '').trim() !== status) {
      return false;
    }

    return true;
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

  function canEditThis(project) {
    if (window.Auth && typeof window.Auth.canEditProject === 'function') {
      return window.Auth.canEditProject(project);
    }
    return canEdit();
  }

  function renderCard(project) {
    const id = project.id;
    const title = displayOrDash(project.name);
    const meta = [project.year, project.work_no].filter((x) => String(x || '').trim()).join(' · ');
    const summary = (project.task_summary || '').trim();
    const subCount = project.subtask_count ?? 0;
    const editable = canEditThis(project);
    const delBtn = editable
      ? `<button type="button" class="btn btn-sm btn-danger" data-del-project="${id}">删除</button>`
      : '';

    const cardInner = `
        <a class="project-card" href="project.html?id=${encodeURIComponent(id)}">
          <div class="card-top">
            <span class="card-meta">${escapeHtml(meta || '—')}</span>
            ${statusBadgeHtml(project.status)}
          </div>
          <h2 class="card-title">${escapeHtml(title)}</h2>
          <div class="card-row"><span class="label">负责人：</span>${escapeHtml(managerText(project))}</div>
          <div class="card-row"><span class="label">启动：</span>${escapeHtml(displayOrDash(project.start_date))}</div>
          <div class="card-row"><span class="label">完结：</span>${escapeHtml(displayOrDash(project.end_date))}</div>
          ${
            summary
              ? `<div class="card-row"><span class="label">任务：</span>${escapeHtml(summary)}</div>`
              : subCount > 0
                ? `<div class="card-row"><span class="label">子任务：</span>${subCount} 项</div>`
                : ''
          }
          <div class="card-row"><span class="label">成员：</span>${escapeHtml(membersSummary(project.members))}</div>
          <div class="card-foot">查看详情 ›</div>
        </a>`;

    if (!editable) return cardInner;

    return `
      <div class="project-card-wrap">
        ${cardInner}
        <div class="account-actions">${delBtn}</div>
      </div>
    `;
  }

  function renderList() {
    const filtered = allProjects.filter(passesFilter);
    summaryBar.textContent = `共 ${allProjects.length} 个项目，当前显示 ${filtered.length} 个`;

    if (filtered.length === 0) {
      listRoot.innerHTML = '<div class="state-box"><p>暂无符合条件的项目</p></div>';
      return;
    }

    listRoot.innerHTML = filtered.map(renderCard).join('');
    listRoot.querySelectorAll('[data-del-project]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = Number(btn.getAttribute('data-del-project'));
        const project = allProjects.find((p) => p.id === pid);
        if (!canEditThis(project)) return;
        const name = project ? displayOrDash(project.name) : String(pid);
        if (!confirm(`确定删除项目「${name}」？\n子任务等关联数据也会一并删除，且不可恢复。`)) {
          return;
        }
        btn.disabled = true;
        try {
          await deleteProject(pid);
          allProjects = allProjects.filter((p) => p.id !== pid);
          rebuildFilterOptions();
          renderList();
        } catch (err) {
          alert(err.message || '删除失败');
          btn.disabled = false;
        }
      });
    });
  }

  async function load(force) {
    if (loadedOnce && !force && allProjects.length) {
      renderList();
      return;
    }
    const soft = !!force && loadedOnce && allProjects.length > 0;
    if (!soft) {
      showLoading(listRoot, '正在加载项目…');
      summaryBar.textContent = '加载中…';
    }
    try {
      const data = await fetchProjects();
      const next = data.projects || [];
      const prevKey = JSON.stringify(allProjects);
      const nextKey = JSON.stringify(next);
      allProjects = next;
      loadedOnce = true;
      rebuildFilterOptions();
      if (soft && prevKey === nextKey) return;
      renderList();
    } catch (err) {
      if (!soft) {
        showError(listRoot, err.message || '加载失败，请检查网络与后端地址');
        summaryBar.textContent = '加载失败';
      }
    }
  }

  window.ProjectListApp = { load };

  document.addEventListener('authchange', () => {
    if (loadedOnce) renderList();
  });
})();
