(function () {
  const listRoot = document.getElementById('listRoot');
  const summaryBar = document.getElementById('summaryBar');
  const filterPanel = document.getElementById('filterPanel');
  const filterYear = document.getElementById('filterYear');
  const filterWorkNo = document.getElementById('filterWorkNo');
  const filterManager = document.getElementById('filterManager');
  const filterStatus = document.getElementById('filterStatus');

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
    filterYear.value = '';
    filterWorkNo.value = '';
    filterManager.value = '';
    filterStatus.value = '';
    renderList();
  });

  [filterYear, filterWorkNo, filterManager, filterStatus].forEach((el) => {
    el.addEventListener('change', renderList);
  });

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
    const year = filterYear.value;
    const workNo = filterWorkNo.value;
    const manager = filterManager.value;
    const status = filterStatus.value;

    if (year && (project.year || '').trim() !== year) return false;
    if (workNo && (project.work_no || '').trim() !== workNo) return false;
    if (manager && managerText(project) !== manager) return false;
    if (status && (project.status || '').trim() !== status) return false;
    return true;
  }

  function canEdit() {
    if (window.Auth && window.Auth.canEditProjects()) return true;
    try {
      const raw = localStorage.getItem('projectshow_auth_user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      return !!(user && user.can_edit_projects);
    } catch (e) {
      return false;
    }
  }

  function renderCard(project) {
    const id = project.id;
    const title = displayOrDash(project.name);
    const meta = [project.year, project.work_no].filter((x) => String(x || '').trim()).join(' · ');
    const summary = (project.task_summary || '').trim();
    const subCount = project.subtask_count ?? 0;
    const editable = canEdit();
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
        if (!canEdit()) return;
        const pid = Number(btn.getAttribute('data-del-project'));
        const project = allProjects.find((p) => p.id === pid);
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
    showLoading(listRoot, '正在加载项目…');
    summaryBar.textContent = '加载中…';
    try {
      const data = await fetchProjects();
      allProjects = data.projects || [];
      loadedOnce = true;
      rebuildFilterOptions();
      renderList();
    } catch (err) {
      showError(listRoot, err.message || '加载失败，请检查网络与后端地址');
      summaryBar.textContent = '加载失败';
    }
  }

  window.ProjectListApp = { load };

  document.addEventListener('authchange', () => {
    if (loadedOnce) renderList();
  });
})();
