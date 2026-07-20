(function () {
  const dashboardRoot = document.getElementById('dashboardRoot');
  const dashSummaryBar = document.getElementById('dashSummaryBar');
  const dashYear = document.getElementById('dashYear');

  let loadedOnce = false;
  let currentSummary = null;

  const PIE_COLORS = {
    待启动: '#43a047',
    进行中: '#1e88e5',
    已完结: '#f9a825',
    逾期: '#e53935',
  };

  const KPI_DEFS = [
    { key: 'total', title: '项目总数', className: 'kpi-total' },
    { key: 'not_started', title: '待启动项目数', className: 'kpi-pending' },
    { key: 'in_progress', title: '进行中项目数', className: 'kpi-progress' },
    { key: 'completed', title: '已完结项目数', className: 'kpi-done' },
  ];

  dashYear.addEventListener('change', () => load(true));

  function roleLabel(role) {
    if (role === 'subtask_owner') return '子任务负责人';
    if (role === 'project_manager') return '项目负责人';
    return role || '—';
  }

  function statusColor(status) {
    return PIE_COLORS[status] || '#90a4ae';
  }

  function fillYearOptions(years) {
    const current = dashYear.value;
    const opts = ['<option value="">全部</option>'].concat(
      (years || []).map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`)
    );
    dashYear.innerHTML = opts.join('');
    if ((years || []).includes(current)) dashYear.value = current;
  }

  function buildPieSvg(rows) {
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const r = 78;
    const total = rows.reduce((sum, row) => sum + (row.count || 0), 0);
    if (total <= 0) {
      return `
        <svg class="pie-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="#eef1f6" />
          <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
                fill="#78909c" font-size="14">暂无数据</text>
        </svg>`;
    }

    let angle = -Math.PI / 2;
    const paths = [];
    const labels = [];

    rows.forEach((row) => {
      const count = row.count || 0;
      if (count <= 0) return;
      const slice = (count / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const next = angle + slice;
      const x2 = cx + r * Math.cos(next);
      const y2 = cy + r * Math.sin(next);
      const large = slice > Math.PI ? 1 : 0;
      const color = statusColor(row.status);
      paths.push(
        `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}"></path>`
      );

      const mid = angle + slice / 2;
      const lx = cx + (r + 28) * Math.cos(mid);
      const ly = cy + (r + 28) * Math.sin(mid);
      const pct = ((count / total) * 100).toFixed(2);
      labels.push(`
        <text x="${lx}" y="${ly - 6}" text-anchor="middle" fill="${color}" font-size="11" font-weight="600">${escapeHtml(row.status)}</text>
        <text x="${lx}" y="${ly + 8}" text-anchor="middle" fill="#546e7a" font-size="11">${count} (${pct}%)</text>
      `);
      angle = next;
    });

    return `
      <svg class="pie-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        ${paths.join('')}
        <circle cx="${cx}" cy="${cy}" r="42" fill="#fff"></circle>
        ${labels.join('')}
      </svg>`;
  }

  function legendHtml(summary) {
    const defs = [
      { status: '进行中', count: summary.in_progress || 0 },
      { status: '待启动', count: summary.not_started || 0 },
      { status: '已完结', count: summary.completed || 0 },
    ];
    return `
      <div class="pie-legend">
        ${defs
          .map(
            (d) => `
          <span class="pie-legend-item">
            <i class="pie-swatch" style="background:${statusColor(d.status)}"></i>
            ${escapeHtml(d.status)}
          </span>`
          )
          .join('')}
      </div>`;
  }

  function kpiHtml(summary) {
    const values = {
      total: summary.total || 0,
      not_started: summary.not_started || 0,
      in_progress: summary.in_progress || 0,
      completed: summary.completed || 0,
    };
    return `
      <div class="kpi-grid">
        ${KPI_DEFS.map(
          (def) => `
          <article class="kpi-card">
            <div class="kpi-title">${escapeHtml(def.title)}</div>
            <div class="kpi-value ${def.className}">${values[def.key]}</div>
          </article>`
        ).join('')}
      </div>`;
  }

  function groupedTableHtml(headers, groups, buildHref) {
    if (!groups.length) {
      return '<div class="state-box"><p>暂无数据</p></div>';
    }

    const bodyRows = [];
    groups.forEach((group) => {
      const rows = group.rows || [];
      rows.forEach((row, idx) => {
        const hrefAll = buildHref(group, '');
        const hrefStatus = buildHref(group, row.status);
        bodyRows.push(`
          <tr>
            ${
              idx === 0
                ? `<td class="col-group" rowspan="${rows.length}">
                     <a href="${hrefAll}">${escapeHtml(group.label)}</a>
                   </td>`
                : ''
            }
            <td><a class="status-link" href="${hrefStatus}">${escapeHtml(row.status)}</a></td>
            <td class="col-num"><a href="${hrefStatus}">${row.count}</a></td>
          </tr>`);
      });
    });

    return `
      <div class="table-wrap">
        <table class="dash-table">
          <thead>
            <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>${bodyRows.join('')}</tbody>
        </table>
      </div>`;
  }

  function render(summary) {
    currentSummary = summary;
    const projectSummary = summary.project_summary || {};
    const pieRows = [
      { status: '进行中', count: projectSummary.in_progress || 0 },
      { status: '待启动', count: projectSummary.not_started || 0 },
      { status: '已完结', count: projectSummary.completed || 0 },
    ].filter((r) => r.count > 0);

    const workGroups = (summary.by_work_no || []).map((g) => ({
      label: g.work_no || '（无工番号）',
      projectId: g.project_id,
      rows: g.rows || [],
    }));

    const personGroups = (summary.by_person || []).map((g) => ({
      label: g.name || g.userid || '（未指定）',
      userid: g.userid || '',
      name: g.name || '',
      rows: (g.rows || []).map((r) => ({
        status: r.status,
        count: r.count,
        role: r.role,
      })),
    }));

    // 责任人表：按 status 聚合同一人多角色（与截图列一致：责任人/任务状态/记录数）
    const personMerged = personGroups.map((g) => {
      const bucket = {};
      (g.rows || []).forEach((r) => {
        bucket[r.status] = (bucket[r.status] || 0) + (r.count || 0);
      });
      return {
        label: g.label,
        userid: g.userid,
        name: g.name,
        rows: Object.keys(bucket).map((status) => ({ status, count: bucket[status] })),
      };
    });

    const year = dashYear.value;
    dashboardRoot.innerHTML = `
      <article class="dash-card">
        <div class="dash-card-head">
          <h2>项目状态</h2>
        </div>
        ${legendHtml(projectSummary)}
        <div class="pie-wrap">${buildPieSvg(pieRows.length ? pieRows : [
          { status: '进行中', count: 0 },
          { status: '待启动', count: 0 },
          { status: '已完结', count: 0 },
        ])}</div>
      </article>

      ${kpiHtml(projectSummary)}

      <article class="dash-card">
        <div class="dash-card-head">
          <h2>相关责任人</h2>
        </div>
        ${groupedTableHtml(
          ['责任人', '任务状态', '记录数'],
          personMerged,
          (group, status) => {
            const q = new URLSearchParams();
            if (group.userid) q.set('userid', group.userid);
            if (group.name) q.set('name', group.name);
            if (status) q.set('status', status);
            if (year) q.set('year', year);
            return `person-tasks.html?${q.toString()}`;
          }
        )}
      </article>

      <article class="dash-card">
        <div class="dash-card-head">
          <h2>项目进度</h2>
        </div>
        ${groupedTableHtml(
          ['工番号', '任务状态', '记录数'],
          workGroups,
          (group, status) => {
            const q = new URLSearchParams();
            q.set('project_id', String(group.projectId || ''));
            if (status) q.set('status', status);
            q.set('from', 'dashboard');
            return `subtasks.html?${q.toString()}`;
          }
        )}
      </article>
    `;

    dashSummaryBar.textContent = `已加载 ${summary.project_count || 0} 个项目`;
  }

  async function load(force) {
    if (loadedOnce && !force && currentSummary) {
      render(currentSummary);
      return;
    }
    showLoading(dashboardRoot, '正在加载看板…');
    dashSummaryBar.textContent = '加载中…';
    try {
      const year = dashYear.value;
      const data = await fetchDashboardSummary(year);
      const summary = data.summary || {};
      fillYearOptions(summary.years || []);
      if (year) dashYear.value = year;
      loadedOnce = true;
      render(summary);
    } catch (err) {
      showError(dashboardRoot, err.message || '加载失败');
      dashSummaryBar.textContent = '加载失败';
    }
  }

  window.DashboardApp = { load };
})();
