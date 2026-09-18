/**
 * 项目甘特图预览（第一期：计划条 + 实际条对照，打印/另存 PDF）
 * 数据：GET /api/projects?id= + GET /api/project-subtasks?project_id=
 * 无前置依赖，仅为按日期排期的时间条图。
 */
(function () {
  const ganttRoot = document.getElementById('ganttRoot');
  const summaryBar = document.getElementById('summaryBar');
  const pageTitle = document.getElementById('pageTitle');
  const backLink = document.getElementById('backLink');
  const chkShowActual = document.getElementById('chkShowActual');
  const btnPrint = document.getElementById('btnPrintGantt');
  const btnRefresh = document.getElementById('btnRefresh');

  const projectId = queryParam('project_id');
  const from = (queryParam('from') || '').trim();

  if (!projectId) {
    showError(ganttRoot, '缺少 project_id');
    summaryBar.textContent = '';
    return;
  }

  if (from === 'dashboard') {
    backLink.href = 'index.html?view=dashboard';
    backLink.textContent = '‹ 返回总览';
  } else {
    backLink.href = `subtasks.html?project_id=${encodeURIComponent(projectId)}`;
    backLink.textContent = '‹ 返回子任务';
  }

  let project = null;
  let subtasks = [];
  let showActual = true;

  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseDate(value) {
    const s = String(value || '').trim();
    if (!s) return null;
    // 仅取 YYYY-MM-DD，避免时区偏移
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(d) {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / DAY_MS);
  }

  function membersText(st) {
    const list = Array.isArray(st.members) ? st.members : [];
    if (!list.length) return '—';
    return list
      .map((m) => (m.name || m.userid || '').trim())
      .filter(Boolean)
      .join('、') || '—';
  }

  function rangeOfTask(st) {
    const ps = parseDate(st.planned_start_date);
    const pe = parseDate(st.planned_end_date);
    const as = parseDate(st.actual_start_date);
    const ae = parseDate(st.actual_end_date);
    return { ps, pe, as, ae };
  }

  function computeTimeline(tasks) {
    let min = null;
    let max = null;
    const touch = (d) => {
      if (!d) return;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    };
    tasks.forEach((st) => {
      const r = rangeOfTask(st);
      touch(r.ps);
      touch(r.pe);
      if (showActual) {
        touch(r.as);
        touch(r.ae);
      }
    });
    if (project) {
      touch(parseDate(project.start_date));
      touch(parseDate(project.end_date));
    }
    if (!min || !max) {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start, end, totalDays: daysBetween(start, end) + 1 };
    }
    // 两端各扩几天，便于阅读
    const start = addDays(min, -2);
    let end = addDays(max, 2);
    if (end < start) end = addDays(start, 7);
    const totalDays = Math.max(1, daysBetween(start, end) + 1);
    return { start, end, totalDays };
  }

  function buildTicks(timeline) {
    const { start, end, totalDays } = timeline;
    const ticks = [];
    // 跨度决定刻度粒度
    let step = 1;
    if (totalDays > 120) step = 14;
    else if (totalDays > 60) step = 7;
    else if (totalDays > 30) step = 3;
    else step = 1;

    for (let i = 0; i < totalDays; i += step) {
      const d = addDays(start, i);
      if (d > end) break;
      ticks.push({
        leftPct: (i / totalDays) * 100,
        label: step >= 7 ? `${d.getMonth() + 1}/${d.getDate()}` : String(d.getDate()),
        monthLabel: d.getDate() === 1 || i === 0 ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '',
      });
    }
    return ticks;
  }

  function barStyle(start, end, timeline) {
    if (!start && !end) return null;
    let s = start;
    let e = end;
    if (s && !e) e = s;
    if (!s && e) s = e;
    if (e < s) {
      const t = s;
      s = e;
      e = t;
    }
    const offset = daysBetween(timeline.start, s);
    const span = Math.max(1, daysBetween(s, e) + 1);
    const left = Math.max(0, (offset / timeline.totalDays) * 100);
    const width = Math.min(100 - left, (span / timeline.totalDays) * 100);
    return {
      left: `${left}%`,
      width: `${Math.max(width, 0.6)}%`,
      title: `${fmtDate(s)} ~ ${fmtDate(e)}`,
    };
  }

  function render(tasks) {
    const timeline = computeTimeline(tasks);
    const ticks = buildTicks(timeline);
    const missingPlan = tasks.filter((st) => {
      const r = rangeOfTask(st);
      return !r.ps && !r.pe;
    }).length;

    const headMeta = project
      ? [
          project.work_no || '',
          project.year || '',
          project.manager_name || project.manager_userid || '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

    const tickHtml = ticks
      .map(
        (t) =>
          `<div class="gantt-tick" style="left:${t.leftPct}%">
            ${t.monthLabel ? `<span class="gantt-tick-month">${escapeHtml(t.monthLabel)}</span>` : ''}
            <span class="gantt-tick-day">${escapeHtml(t.label)}</span>
          </div>`
      )
      .join('');

    const rowsHtml = tasks
      .map((st) => {
        const r = rangeOfTask(st);
        const plan = barStyle(r.ps, r.pe, timeline);
        const actual = showActual ? barStyle(r.as, r.ae, timeline) : null;
        const status = (st.status || '').trim() || '—';
        return `
          <div class="gantt-row">
            <div class="gantt-label">
              <div class="gantt-task-name" title="${escapeHtml(st.content || '')}">${escapeHtml(displayOrDash(st.content))}</div>
              <div class="gantt-task-meta">
                <span>${escapeHtml(membersText(st))}</span>
                <span class="gantt-status">${escapeHtml(status)}</span>
              </div>
            </div>
            <div class="gantt-track">
              ${
                plan
                  ? `<div class="gantt-bar gantt-bar-plan" style="left:${plan.left};width:${plan.width}" title="计划 ${escapeHtml(plan.title)}"></div>`
                  : `<div class="gantt-bar-missing">无计划日期</div>`
              }
              ${
                actual
                  ? `<div class="gantt-bar gantt-bar-actual" style="left:${actual.left};width:${actual.width}" title="实际 ${escapeHtml(actual.title)}"></div>`
                  : ''
              }
            </div>
          </div>`;
      })
      .join('');

    ganttRoot.innerHTML = `
      <div class="gantt-sheet">
        <div class="gantt-print-head">
          <h2>${escapeHtml((project && project.name) || '项目甘特图')}</h2>
          <p>${escapeHtml(headMeta)}</p>
          <p>时间范围：${escapeHtml(fmtDate(timeline.start))} ~ ${escapeHtml(fmtDate(timeline.end))} · 共 ${tasks.length} 项任务</p>
        </div>
        <div class="gantt-head-row">
          <div class="gantt-corner">任务 / 成员</div>
          <div class="gantt-timeline-head">
            <div class="gantt-ticks">${tickHtml}</div>
          </div>
        </div>
        <div class="gantt-body">
          ${rowsHtml || '<div class="gantt-empty">暂无子任务</div>'}
        </div>
      </div>`;

    summaryBar.textContent = `共 ${tasks.length} 项子任务` +
      (missingPlan ? `，其中 ${missingPlan} 项无计划日期` : '') +
      ` · 轴：${fmtDate(timeline.start)} ~ ${fmtDate(timeline.end)}`;
  }

  async function load() {
    showLoading(ganttRoot, '正在加载甘特图…');
    summaryBar.textContent = '加载中…';
    try {
      const [projData, subData] = await Promise.all([
        fetchProject(projectId),
        fetchSubtasks(projectId),
      ]);
      project = projData.project || null;
      subtasks = subData.subtasks || [];
      const name = (project && project.name) || `项目 #${projectId}`;
      pageTitle.textContent = name;
      document.title = `甘特图 — ${name}`;
      render(subtasks);
    } catch (err) {
      showError(ganttRoot, err.message || '加载失败');
      summaryBar.textContent = '加载失败';
    }
  }

  if (chkShowActual) {
    chkShowActual.addEventListener('change', () => {
      showActual = !!chkShowActual.checked;
      if (project || subtasks.length) render(subtasks);
    });
  }
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => load());
  }

  load();
})();
