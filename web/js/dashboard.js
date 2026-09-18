(function () {
  const dashboardRoot = document.getElementById('dashboardRoot');
  const dashSummaryBar = document.getElementById('dashSummaryBar');
  const dashYear = document.getElementById('dashYear');

  let loadedOnce = false;
  let currentSummary = null;
  let lastSummaryKey = '';
  let tableScrollTimers = [];
  let loading = false;

  const PIE_COLORS = {
    待启动: '#90a4ae',
    进行中: '#f9a825',
    已完结: '#43a047',
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
    if (role === 'subtask_member' || role === 'subtask_owner') return '子任务成员';
    if (role === 'project_manager') return '项目负责人';
    return role || '—';
  }

  function statusColor(status) {
    return PIE_COLORS[status] || '#90a4ae';
  }

  function fillYearOptions(years) {
    const current = dashYear.value;
    const key = (years || []).join('\0');
    if (dashYear.dataset.yearsKey === key) {
      if ((years || []).includes(current)) dashYear.value = current;
      return;
    }
    dashYear.dataset.yearsKey = key;
    const opts = ['<option value="">全部</option>'].concat(
      (years || []).map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`)
    );
    dashYear.innerHTML = opts.join('');
    if ((years || []).includes(current)) dashYear.value = current;
  }

  function isKioskMode() {
    return document.body.classList.contains('kiosk-mode');
  }

  function stopTableAutoScroll() {
    tableScrollTimers.forEach((entry) => {
      if (entry && entry.id) clearInterval(entry.id);
    });
    tableScrollTimers = [];
  }

  function bindManualTableScroll(wrap, state) {
    if (!wrap || wrap.dataset.dragBound === '1') return;
    wrap.dataset.dragBound = '1';
    wrap.classList.add('table-wrap-draggable');

    let dragging = false;
    let moved = false;
    let startY = 0;
    let startScroll = 0;
    let pointerId = null;

    const pauseManual = (ms) => {
      state.manualUntil = performance.now() + (ms || 400);
    };

    wrap.addEventListener('pointerdown', (e) => {
      if (!isKioskMode() || e.button !== 0) return;
      dragging = true;
      moved = false;
      startY = e.clientY;
      startScroll = wrap.scrollTop;
      pointerId = e.pointerId;
      try {
        wrap.setPointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
      wrap.classList.add('is-dragging');
      pauseManual(60000);
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      e.preventDefault();
      wrap.scrollTop = startScroll - dy;
      pauseManual(60000);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('is-dragging');
      if (pointerId != null) {
        try {
          wrap.releasePointerCapture(pointerId);
        } catch (err) {
          /* ignore */
        }
        pointerId = null;
      }
      // 松开后稍停再继续自动滚动
      pauseManual(moved ? 600 : 200);
    };

    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);
    wrap.addEventListener('lostpointercapture', endDrag);

    wrap.addEventListener(
      'wheel',
      () => {
        if (!isKioskMode()) return;
        pauseManual(1800);
      },
      { passive: true }
    );

    // 拖动时若点在链接上且几乎没移动，保留点击；移动过则阻止误点
    wrap.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);
  }

  // 把 tbody 里的行复制一份接在后面，制造“无缝循环”所需的双份内容：
  // 滚过第一份的高度（unitHeight）时悄悄把 scrollTop 退回等量距离，
  // 因为紧接着的第二份内容和第一份一模一样，退回瞬间画面不会有跳变感。
  function buildSeamlessLoop(wrap) {
    const table = wrap.querySelector('table');
    const tbody = table && table.querySelector('tbody');
    if (!tbody || !tbody.children.length || tbody.dataset.loopBuilt === '1') {
      return 0;
    }
    const unitHeight = tbody.getBoundingClientRect().height;
    if (!(unitHeight > 0)) return 0;
    const frag = document.createDocumentFragment();
    Array.from(tbody.children).forEach((tr) => frag.appendChild(tr.cloneNode(true)));
    tbody.appendChild(frag);
    tbody.dataset.loopBuilt = '1';
    return unitHeight;
  }

  function startOneTableAutoScroll(wrap) {
    if (!wrap) return;
    const max0 = wrap.scrollHeight - wrap.clientHeight;
    if (max0 <= 2) return;

    const unitHeight = buildSeamlessLoop(wrap);

    const state = { manualUntil: 0 };
    bindManualTableScroll(wrap, state);

    const id = setInterval(() => {
      if (!wrap.isConnected) return;
      // 无缝衔接：滚过一份内容的高度就退回一份高度，画面不变，接着继续往下滚
      if (unitHeight > 1 && wrap.scrollTop >= unitHeight) {
        wrap.scrollTop -= unitHeight;
      }
      if (!isKioskMode()) return;
      const now = performance.now();
      if (now < state.manualUntil) return;
      const max = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
      if (max <= 0) return;
      wrap.scrollTop += 0.9;
      // 兜底：理论上不会真的滚到底（无缝回退会提前接手），意外情况直接绕回开头
      if (wrap.scrollTop >= max) {
        wrap.scrollTop = unitHeight > 1 ? unitHeight - 1 : 0;
      }
    }, 32);
    tableScrollTimers.push({ id, wrap, state });
  }

  function setupTableAutoScroll() {
    stopTableAutoScroll();
    if (!isKioskMode() || !dashboardRoot) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!isKioskMode()) return;
        dashboardRoot.querySelectorAll(
          '.dash-cell-work .table-wrap, .dash-cell-person .table-wrap, .dash-cell-sub-person .table-wrap, .dash-cell-punctuality .table-wrap'
        ).forEach((wrap) => {
          // 重新渲染后节点是新的，允许重新绑定
          delete wrap.dataset.dragBound;
          startOneTableAutoScroll(wrap);
        });
      });
    });
  }

  function buildPieSvg(rows) {
    const kiosk = isKioskMode();
    // 全屏时加大画布、略缩小半径，给外侧百分比标签留边，避免被裁切
    const size = kiosk ? 260 : 260;
    const cx = size / 2;
    const cy = size / 2;
    const r = kiosk ? 62 : 78;
    const labelOffset = kiosk ? 38 : 36;
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
    const fullCircle = Math.PI * 2 - 1e-6;

    rows.forEach((row) => {
      const count = row.count || 0;
      if (count <= 0) return;
      const slice = (count / total) * Math.PI * 2;
      const color = statusColor(row.status);
      const mid = angle + slice / 2;

      // 单片约 100% 时 SVG 圆弧起终点重合画不出来，改用整圆。
      if (slice >= fullCircle) {
        paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"></circle>`);
      } else {
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const next = angle + slice;
        const x2 = cx + r * Math.cos(next);
        const y2 = cy + r * Math.sin(next);
        const large = slice > Math.PI ? 1 : 0;
        paths.push(
          `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}"></path>`
        );
      }

      const lx = cx + (r + labelOffset) * Math.cos(mid);
      const ly = cy + (r + labelOffset) * Math.sin(mid);
      const pct = ((count / total) * 100).toFixed(2);
      labels.push(`
        <text x="${lx}" y="${ly - 6}" text-anchor="middle" fill="${color}" font-size="11" font-weight="600">${escapeHtml(row.status)}</text>
        <text x="${lx}" y="${ly + 8}" text-anchor="middle" fill="#546e7a" font-size="11">${count} (${pct}%)</text>
      `);
      angle += slice;
    });

    return `
      <svg class="pie-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        ${paths.join('')}
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

  // 部门准时率：总数/未到期/准时；准时率分母不含未到期。
  function punctualityHtml(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      return `
        <div class="punctuality-placeholder">
          <div class="table-wrap">
            <table class="dash-table punctuality-table">
              <thead>
                <tr>
                  <th>部门</th>
                  <th class="col-num">总数</th>
                  <th class="col-num">未到期</th>
                  <th class="col-num">准时</th>
                  <th class="col-num">准时率</th>
                </tr>
              </thead>
              <tbody>
                <tr class="punctuality-empty-row">
                  <td colspan="5">
                    <div class="punctuality-empty">
                      <p>暂无纳入统计的子任务</p>
                      <p class="punctuality-empty-hint">需有计划完成日；准时率不含未到期任务</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`;
    }

    const body = list
      .map((row) => {
        const rate = Number(row.rate) || 0;
        const rateClass =
          rate >= 80 ? 'rate-good' : rate >= 50 ? 'rate-mid' : 'rate-bad';
        return `
          <tr>
            <td class="col-group">${escapeHtml(row.department_name || '—')}</td>
            <td class="col-num">${row.total || 0}</td>
            <td class="col-num">${row.not_due || 0}</td>
            <td class="col-num">${row.on_time || 0}</td>
            <td class="col-rate">
              <div class="rate-cell ${rateClass}">
                <span class="rate-text">${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%</span>
                <span class="rate-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, rate))}%"></i></span>
              </div>
            </td>
          </tr>`;
      })
      .join('');

    return `
      <div class="punctuality-placeholder">
        <div class="table-wrap">
          <table class="dash-table punctuality-table">
            <thead>
              <tr>
                <th>部门</th>
                <th class="col-num">总数</th>
                <th class="col-num">未到期</th>
                <th class="col-num">准时</th>
                <th class="col-num">准时率</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }

  function groupedTableHtml(headers, groups, buildHref) {
    if (!groups.length) {
      return '<div class="state-box"><p>暂无数据</p></div>';
    }

    const bodyRows = [];
    groups.forEach((group) => {
      const rows = group.rows || [];
      const extras = Array.isArray(group.extraLabels) ? group.extraLabels : [];
      rows.forEach((row, idx) => {
        const hrefAll = buildHref(group, '');
        const hrefStatus = buildHref(group, row.status);
        const extraCells =
          idx === 0
            ? extras
                .map(
                  (text) =>
                    `<td class="col-extra" rowspan="${rows.length}">${escapeHtml(text || '—')}</td>`
                )
                .join('')
            : '';
        bodyRows.push(`
          <tr>
            ${
              idx === 0
                ? `<td class="col-group" rowspan="${rows.length}">
                     <a href="${hrefAll}">${escapeHtml(group.label)}</a>
                   </td>${extraCells}`
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

  function summaryKey(summary) {
    try {
      return JSON.stringify(summary || {});
    } catch (e) {
      return String(Date.now());
    }
  }

  function captureTableScrolls() {
    const map = {};
    if (!dashboardRoot) return map;
    dashboardRoot.querySelectorAll('.table-wrap').forEach((wrap, idx) => {
      map[idx] = wrap.scrollTop || 0;
    });
    return map;
  }

  function restoreTableScrolls(map) {
    if (!map || !dashboardRoot) return;
    dashboardRoot.querySelectorAll('.table-wrap').forEach((wrap, idx) => {
      if (map[idx] != null) wrap.scrollTop = map[idx];
    });
  }

  function render(summary, opts) {
    const options = opts || {};
    currentSummary = summary;
    const projectSummary = summary.project_summary || {};
    const pieRows = [
      { status: '进行中', count: projectSummary.in_progress || 0 },
      { status: '待启动', count: projectSummary.not_started || 0 },
      { status: '已完结', count: projectSummary.completed || 0 },
    ].filter((r) => r.count > 0);

    const workGroups = (summary.by_work_no || []).map((g) => ({
      label: g.work_no || '（无工番号）',
      extraLabels: [g.project_name || '—'],
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

    // 相关责任人 = 项目负责人；子任务责任人 = 子任务成员（不是 owner，owner 固定等于项目负责人）。
    const PERSON_STATUS_ORDER = ['待启动', '进行中', '逾期', '已完结'];
    function mergeByStatusForRole(groups, role) {
      return groups
        .map((g) => {
          const bucket = {};
          (g.rows || []).forEach((r) => {
            if (r.role !== role) return;
            bucket[r.status] = (bucket[r.status] || 0) + (r.count || 0);
          });
          const statuses = PERSON_STATUS_ORDER.filter((s) => bucket[s] != null);
          Object.keys(bucket).forEach((s) => {
            if (!statuses.includes(s)) statuses.push(s);
          });
          return {
            label: g.label,
            userid: g.userid,
            name: g.name,
            rows: statuses.map((status) => ({ status, count: bucket[status] })),
          };
        })
        .filter((g) => g.rows.length > 0);
    }

    const managerMerged = mergeByStatusForRole(personGroups, 'project_manager');
    const subMemberMerged = mergeByStatusForRole(personGroups, 'subtask_member');

    const year = dashYear.value;
    function personTasksHref(group, status, role) {
      const q = new URLSearchParams();
      if (group.userid) q.set('userid', group.userid);
      if (group.name) q.set('name', group.name);
      if (status) q.set('status', status);
      if (year) q.set('year', year);
      if (role) q.set('role', role);
      return `person-tasks.html?${q.toString()}`;
    }

    const pieBlock = `
      <article class="dash-card dash-cell dash-cell-pie">
        <div class="dash-card-head">
          <h2>项目状态</h2>
        </div>
        ${legendHtml(projectSummary)}
        <div class="pie-wrap">${buildPieSvg(pieRows.length ? pieRows : [
          { status: '进行中', count: 0 },
          { status: '待启动', count: 0 },
          { status: '已完结', count: 0 },
        ])}</div>
        ${kpiHtml(projectSummary)}
      </article>`;

    const punctualityBlock = `
      <article class="dash-card dash-cell dash-cell-punctuality">
        <div class="dash-card-head">
          <h2>部门准时率</h2>
        </div>
        ${punctualityHtml(summary.by_department_punctuality)}
      </article>`;

    const personBlock = `
      <div class="dash-cell dash-cell-person-stack">
        <article class="dash-card dash-cell-person">
          <div class="dash-card-head">
            <h2>相关责任人</h2>
          </div>
          ${groupedTableHtml(
            ['责任人', '任务状态', '记录数'],
            managerMerged,
            (group, status) => personTasksHref(group, status, 'project_manager')
          )}
        </article>
        <article class="dash-card dash-cell-sub-person">
          <div class="dash-card-head">
            <h2>子任务责任人</h2>
          </div>
          ${groupedTableHtml(
            ['责任人', '任务状态', '记录数'],
            subMemberMerged,
            (group, status) => personTasksHref(group, status, 'subtask_member')
          )}
        </article>
      </div>`;

    const workBlock = `
      <article class="dash-card dash-cell dash-cell-work">
        <div class="dash-card-head">
          <h2>项目进度</h2>
        </div>
        ${groupedTableHtml(
          ['工番号', '项目名称', '任务状态', '记录数'],
          workGroups,
          (group) => {
            const q = new URLSearchParams();
            q.set('id', String(group.projectId || ''));
            q.set('from', 'dashboard');
            return `project.html?${q.toString()}`;
          }
        )}
      </article>`;

    const savedScrolls = options.preserveScroll ? captureTableScrolls() : null;
    stopTableAutoScroll();
    dashboardRoot.className = 'dash-layout';
    const leftBlock = `<div class="dash-cell dash-cell-left-stack">${pieBlock}${workBlock}</div>`;
    dashboardRoot.innerHTML = `${leftBlock}${punctualityBlock}${personBlock}`;
    if (savedScrolls) restoreTableScrolls(savedScrolls);

    dashSummaryBar.textContent = `已加载 ${summary.project_count || 0} 个项目`;
    setupTableAutoScroll();
  }

  async function load(force) {
    if (loadedOnce && !force && currentSummary) {
      render(currentSummary);
      return;
    }
    if (loading) return;
    const soft =
      !!force &&
      loadedOnce &&
      !!currentSummary &&
      !!dashboardRoot &&
      !!dashboardRoot.querySelector('.dash-cell-pie');

    loading = true;
    if (!soft) {
      showLoading(dashboardRoot, '正在加载看板…');
      dashSummaryBar.textContent = '加载中…';
    }
    try {
      const year = dashYear.value;
      const data = await fetchDashboardSummary(year);
      const summary = data.summary || {};
      fillYearOptions(summary.years || []);
      if (year) dashYear.value = year;
      loadedOnce = true;

      const key = summaryKey(summary);
      if (soft && key === lastSummaryKey) {
        // 数据无变化：不重绘，避免闪烁
        return;
      }
      lastSummaryKey = key;
      render(summary, { preserveScroll: soft });
    } catch (err) {
      if (!soft) {
        showError(dashboardRoot, err.message || '加载失败');
        dashSummaryBar.textContent = '加载失败';
      } else if (dashSummaryBar) {
        // 软刷新失败时保留旧画面，仅提示
        dashSummaryBar.textContent = `刷新失败：${err.message || '网络异常'}`;
      }
    } finally {
      loading = false;
    }
  }

  window.DashboardApp = {
    load,
    onKioskChange(enabled) {
      if (enabled) {
        // 进入全屏时按全屏尺寸重绘饼图，并保留滚动位置
        if (currentSummary) {
          lastSummaryKey = '';
          render(currentSummary, { preserveScroll: true });
        } else {
          setupTableAutoScroll();
        }
      } else {
        stopTableAutoScroll();
        if (currentSummary) {
          lastSummaryKey = '';
          render(currentSummary);
        }
      }
    },
  };
})();
