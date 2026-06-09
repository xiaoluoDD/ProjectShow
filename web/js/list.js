(function () {
  const listRoot = document.getElementById('listRoot');
  const summaryBar = document.getElementById('summaryBar');
  const filterPanel = document.getElementById('filterPanel');
  const filterYear = document.getElementById('filterYear');
  const filterWorkNo = document.getElementById('filterWorkNo');
  const filterManager = document.getElementById('filterManager');
  const filterStatus = document.getElementById('filterStatus');

  let allProjects = [];
  let touchStartY = 0;
  let pulling = false;

  document.getElementById('btnFilter').addEventListener('click', () => {
    filterPanel.classList.toggle('open');
  });

  document.getElementById('btnRefresh').addEventListener('click', () => loadList());
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

  // 简易下拉刷新
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
      loadList();
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

  function renderCard(project) {
    const id = project.id;
    const title = displayOrDash(project.name);
    const meta = [project.year, project.work_no].filter((x) => String(x || '').trim()).join(' · ');
    const summary = (project.task_summary || '').trim();
    const subCount = project.subtask_count ?? 0;

    return `
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
      </a>
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
  }

  async function loadList() {
    showLoading(listRoot, '正在加载项目…');
    summaryBar.textContent = '加载中…';
    try {
      const data = await fetchProjects();
      allProjects = data.projects || [];
      rebuildFilterOptions();
      renderList();
    } catch (err) {
      showError(listRoot, err.message || '加载失败，请检查网络与后端地址');
      summaryBar.textContent = '加载失败';
    }
  }

  loadList();
})();
