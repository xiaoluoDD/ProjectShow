/**
 * 项目甘特图（精简版，界面与 Excel 导出同结构）
 * 左侧：计划任务 / 状态 / 责任人 / 进度% / 计划开始 / 计划结束 / 天数
 * 部门作为分组标题行（不占列）；进度可在本页填写，本地保存并随导出带出
 */
(function () {
  const ganttRoot = document.getElementById('ganttRoot');
  const summaryBar = document.getElementById('summaryBar');
  const pageTitle = document.getElementById('pageTitle');
  const backLink = document.getElementById('backLink');
  const btnPrint = document.getElementById('btnPrintGantt');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnRefresh = document.getElementById('btnRefresh');

  const projectId = queryParam('project_id');
  const from = (queryParam('from') || '').trim();
  const UNASSIGNED_DEPT = '（未分配部门）';
  const PROGRESS_KEY = `projectshow_gantt_progress_${projectId}`;

  if (!projectId) {
    showError(ganttRoot, '缺少 project_id');
    summaryBar.textContent = '';
    return;
  }

  if (from === 'dashboard') {
    backLink.href = 'index.html?view=dashboard';
    backLink.textContent = '‹ 返回总览';
  } else if (from === 'project') {
    backLink.href = `project.html?id=${encodeURIComponent(projectId)}`;
    backLink.textContent = '‹ 返回项目详情';
  } else {
    backLink.href = `subtasks.html?project_id=${encodeURIComponent(projectId)}`;
    backLink.textContent = '‹ 返回子任务';
  }

  let project = null;
  let subtasks = [];
  /** @type {Record<string, number>} */
  let progressMap = {};
  /** @type {ReturnType<typeof groupByDepartment>|null} */
  let lastGroups = null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  function parseDate(value) {
    const s = String(value || '').trim();
    if (!s) return null;
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

  function fmtDateSlash(d) {
    if (!d) return '';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
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
    if (!list.length) return '';
    return list
      .map((m) => (m.name || m.userid || '').trim())
      .filter(Boolean)
      .join('、');
  }

  function firstDepartmentName(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    return s.split(/[、,，]/)[0].trim();
  }

  function taskDepartment(st) {
    const list = Array.isArray(st.members) ? st.members : [];
    for (let i = 0; i < list.length; i++) {
      const dept = firstDepartmentName(list[i] && list[i].department_name);
      if (dept) return dept;
    }
    return UNASSIGNED_DEPT;
  }

  function planRange(st) {
    const ps = parseDate(st.planned_start_date);
    const pe = parseDate(st.planned_end_date);
    return { ps, pe };
  }

  function planDaysText(st) {
    const { ps, pe } = planRange(st);
    if (!ps && !pe) return '';
    const s = ps || pe;
    const e = pe || ps;
    return String(Math.max(1, daysBetween(s, e) + 1));
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      progressMap = raw ? JSON.parse(raw) || {} : {};
    } catch (e) {
      progressMap = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressMap));
    } catch (e) {
      /* ignore */
    }
  }

  function getProgress(st) {
    const id = String(st.id);
    if (progressMap[id] != null && progressMap[id] !== '') {
      const n = Number(progressMap[id]);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : '';
    }
    // 已完结默认 100，便于首次打开；仍可改
    if ((st.status || '').trim() === '已完结') return 100;
    return '';
  }

  function setProgress(stId, value) {
    const id = String(stId);
    if (value === '' || value == null) {
      delete progressMap[id];
    } else {
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      progressMap[id] = Math.max(0, Math.min(100, Math.round(n)));
    }
    saveProgress();
  }

  function groupOwners(tasks) {
    const seen = new Set();
    const names = [];
    (tasks || []).forEach((st) => {
      (st.members || []).forEach((m) => {
        const n = (m.name || m.userid || '').trim();
        if (!n || seen.has(n)) return;
        seen.add(n);
        names.push(n);
      });
    });
    return names.join('、');
  }

  function groupByDepartment(tasks) {
    const map = new Map();
    (tasks || []).forEach((st) => {
      const dept = taskDepartment(st);
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept).push(st);
    });
    const names = Array.from(map.keys()).sort((a, b) => {
      if (a === UNASSIGNED_DEPT) return 1;
      if (b === UNASSIGNED_DEPT) return -1;
      return a.localeCompare(b, 'zh-CN');
    });
    return names.map((name) => {
      const items = map.get(name) || [];
      let minPs = null;
      let maxPe = null;
      items.forEach((st) => {
        const r = planRange(st);
        if (r.ps && (!minPs || r.ps < minPs)) minPs = r.ps;
        if (r.pe && (!maxPe || r.pe > maxPe)) maxPe = r.pe;
        if (!r.ps && r.pe && (!minPs || r.pe < minPs)) minPs = r.pe;
        if (!r.pe && r.ps && (!maxPe || r.ps > maxPe)) maxPe = r.ps;
      });
      return {
        name,
        tasks: items,
        minPs,
        maxPe,
        owners: groupOwners(items),
      };
    });
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
      const r = planRange(st);
      touch(r.ps);
      touch(r.pe);
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
    const start = addDays(min, -1);
    let end = addDays(max, 1);
    if (end < start) end = addDays(start, 7);
    return { start, end, totalDays: Math.max(1, daysBetween(start, end) + 1) };
  }

  function buildTicks(timeline) {
    const { start, end, totalDays } = timeline;
    const ticks = [];
    let step = 1;
    if (totalDays > 120) step = 14;
    else if (totalDays > 60) step = 7;
    else if (totalDays > 30) step = 3;
    for (let i = 0; i < totalDays; i += step) {
      const d = addDays(start, i);
      if (d > end) break;
      ticks.push({
        leftPct: (i / totalDays) * 100,
        label: step >= 7 ? `${d.getMonth() + 1}/${d.getDate()}` : String(d.getDate()),
        monthLabel:
          d.getDate() === 1 || i === 0
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : '',
      });
    }
    return ticks;
  }

  function barStyle(start, end, timeline) {
    if (!start && !end) return null;
    let s = start || end;
    let e = end || start;
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

  function inRange(day, start, end) {
    if (!day || (!start && !end)) return false;
    const s = start || end;
    const e = end || start;
    const t0 = s < e ? s : e;
    const t1 = s < e ? e : s;
    return day >= t0 && day <= t1;
  }

  function renderGroupRow(group, timeline) {
    const plan = barStyle(group.minPs, group.maxPe, timeline);
    const days =
      group.minPs || group.maxPe
        ? String(Math.max(1, daysBetween(group.minPs || group.maxPe, group.maxPe || group.minPs) + 1))
        : '';
    return `
      <div class="gantt-row gantt-row-group">
        <div class="gantt-label gantt-label-lean">
          <div class="gantt-c-task gantt-group-name" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</div>
          <div class="gantt-c-status"></div>
          <div class="gantt-c-owner" title="${escapeHtml(group.owners)}">${escapeHtml(group.owners || '')}</div>
          <div class="gantt-c-progress"></div>
          <div class="gantt-c-date">${escapeHtml(fmtDateSlash(group.minPs))}</div>
          <div class="gantt-c-date">${escapeHtml(fmtDateSlash(group.maxPe))}</div>
          <div class="gantt-c-days">${escapeHtml(days)}</div>
        </div>
        <div class="gantt-track">
          ${
            plan
              ? `<div class="gantt-bar gantt-bar-group" style="left:${plan.left};width:${plan.width}" title="${escapeHtml(plan.title)}"></div>`
              : ''
          }
        </div>
      </div>`;
  }

  function renderTaskRow(st, timeline) {
    const r = planRange(st);
    const plan = barStyle(r.ps, r.pe, timeline);
    const status = (st.status || '').trim() || '';
    const prog = getProgress(st);
    const progVal = prog === '' ? '' : String(prog);
    return `
      <div class="gantt-row" data-subtask-id="${st.id}">
        <div class="gantt-label gantt-label-lean">
          <div class="gantt-c-task" title="${escapeHtml(st.content || '')}">${escapeHtml(displayOrDash(st.content))}</div>
          <div class="gantt-c-status">${escapeHtml(status)}</div>
          <div class="gantt-c-owner" title="${escapeHtml(membersText(st))}">${escapeHtml(membersText(st))}</div>
          <div class="gantt-c-progress">
            <input type="number" class="gantt-progress-input no-print" min="0" max="100" step="1"
              data-progress-id="${st.id}" value="${escapeHtml(progVal)}" placeholder="%" title="进度%，可编辑，导出时带出" />
            <span class="gantt-progress-print">${progVal === '' ? '' : progVal + '%'}</span>
          </div>
          <div class="gantt-c-date">${escapeHtml(fmtDateSlash(r.ps))}</div>
          <div class="gantt-c-date">${escapeHtml(fmtDateSlash(r.pe))}</div>
          <div class="gantt-c-days">${escapeHtml(planDaysText(st))}</div>
        </div>
        <div class="gantt-track">
          ${
            plan
              ? `<div class="gantt-bar gantt-bar-plan gantt-bar-plan-only" style="left:${plan.left};width:${plan.width}" title="计划 ${escapeHtml(plan.title)}"></div>`
              : `<div class="gantt-bar-missing">无计划日期</div>`
          }
        </div>
      </div>`;
  }

  function bindProgressInputs() {
    if (!ganttRoot) return;
    ganttRoot.querySelectorAll('[data-progress-id]').forEach((input) => {
      input.addEventListener('change', () => {
        setProgress(input.getAttribute('data-progress-id'), input.value);
        const printEl = input.parentNode && input.parentNode.querySelector('.gantt-progress-print');
        if (printEl) {
          const v = input.value === '' ? '' : `${input.value}%`;
          printEl.textContent = v;
        }
      });
      input.addEventListener('blur', () => {
        setProgress(input.getAttribute('data-progress-id'), input.value);
      });
    });
  }

  function render(tasks) {
    const groups = groupByDepartment(tasks);
    lastGroups = groups;
    const timeline = computeTimeline(tasks);
    const ticks = buildTicks(timeline);
    const missingPlan = tasks.filter((st) => {
      const r = planRange(st);
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

    const rowsHtml = groups
      .map((g) => renderGroupRow(g, timeline) + g.tasks.map((st) => renderTaskRow(st, timeline)).join(''))
      .join('');

    ganttRoot.innerHTML = `
      <div class="gantt-sheet gantt-sheet-lean">
        <div class="gantt-print-head">
          <h2>${escapeHtml((project && project.name) || '项目甘特图')}</h2>
          <p>${escapeHtml(headMeta)}</p>
          <p>项目开始：${escapeHtml(fmtDateSlash(parseDate(project && project.start_date)) || '—')} · 时间轴 ${escapeHtml(fmtDate(timeline.start))} ~ ${escapeHtml(fmtDate(timeline.end))} · ${tasks.length} 项 / ${groups.length} 个部门</p>
        </div>
        <div class="gantt-head-row gantt-head-lean">
          <div class="gantt-label gantt-label-lean gantt-corner-lean">
            <div class="gantt-c-task">计划任务项目</div>
            <div class="gantt-c-status">状态</div>
            <div class="gantt-c-owner">责任人</div>
            <div class="gantt-c-progress">进度</div>
            <div class="gantt-c-date">开始日期</div>
            <div class="gantt-c-date">结束日期</div>
            <div class="gantt-c-days">天数</div>
          </div>
          <div class="gantt-timeline-head">
            <div class="gantt-ticks">${tickHtml}</div>
          </div>
        </div>
        <div class="gantt-body">
          ${rowsHtml || '<div class="gantt-empty">暂无子任务</div>'}
        </div>
      </div>`;

    bindProgressInputs();

    summaryBar.textContent =
      `共 ${tasks.length} 项子任务，${groups.length} 个部门` +
      (missingPlan ? `，其中 ${missingPlan} 项无计划日期` : '') +
      ` · 进度可在本页填写，导出 Excel 时一并带出`;
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function excelCell(colIndex, value, styleId) {
    const attrs = [`ss:Index="${colIndex}"`];
    if (styleId) attrs.push(`ss:StyleID="${styleId}"`);
    if (value === '' || value == null) return `<Cell ${attrs.join(' ')}/>`;
    return `<Cell ${attrs.join(' ')}><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
  }

  function excelRow(cellsXml) {
    return `<Row>${cellsXml}</Row>`;
  }

  // 与页面同结构：部门作标题行；列=任务/状态/责任人/进度/开始/结束/天数 + 右侧按日色块
  function buildExcelXml(groups) {
    const title = (project && project.name) || '项目甘特图';
    const workNo = (project && project.work_no) || '';
    const allTasks = (groups || []).reduce((acc, g) => acc.concat(g.tasks), []);
    const timeline = computeTimeline(allTasks);
    const dayCount = Math.min(Math.max(1, timeline.totalDays), 370);
    const days = [];
    for (let i = 0; i < dayCount; i++) days.push(addDays(timeline.start, i));

    const LEFT = 7;
    const headers = ['计划任务项目', '状态', '责任人', '进度', '开始日期', '结束日期', '天数'];
    const sheetRows = [];

    sheetRows.push(
      excelRow(
        excelCell(1, `${workNo ? workNo + ' ' : ''}${title}`.trim(), 'Title') +
          excelCell(LEFT + 1, '图例：', 'Meta') +
          excelCell(LEFT + 2, '部门', 'Group') +
          excelCell(LEFT + 3, '计划', 'Plan')
      )
    );
    sheetRows.push(
      excelRow(
        excelCell(
          1,
          `项目开始：${fmtDateSlash(parseDate(project && project.start_date)) || '—'}  ·  负责人：${(project && (project.manager_name || project.manager_userid)) || '—'}  ·  导出：${fmtDateSlash(new Date())}`,
          'Meta'
        )
      )
    );

    // 月份行
    let monthCells = excelCell(1, '月份', 'Head');
    for (let i = 1; i < LEFT; i++) monthCells += excelCell(i + 1, '', 'Head');
    let mi = 0;
    while (mi < days.length) {
      const d0 = days[mi];
      let mj = mi + 1;
      while (
        mj < days.length &&
        days[mj].getFullYear() === d0.getFullYear() &&
        days[mj].getMonth() === d0.getMonth()
      ) {
        mj++;
      }
      monthCells += excelCell(
        LEFT + 1 + mi,
        `${d0.getMonth() + 1}月`,
        'Head'
      );
      for (let k = mi + 1; k < mj; k++) monthCells += excelCell(LEFT + 1 + k, '', 'Head');
      mi = mj;
    }
    sheetRows.push(excelRow(monthCells));

    let dayCells = '';
    let weekCells = '';
    headers.forEach((h, i) => {
      dayCells += excelCell(i + 1, h, 'Head');
      weekCells += excelCell(i + 1, '', 'Head');
    });
    days.forEach((d, i) => {
      dayCells += excelCell(LEFT + 1 + i, String(d.getDate()), 'HeadDay');
      weekCells += excelCell(LEFT + 1 + i, WEEK[d.getDay()], 'HeadDay');
    });
    sheetRows.push(excelRow(dayCells));
    sheetRows.push(excelRow(weekCells));

    function leftCells(vals, styleId) {
      let xml = '';
      for (let i = 0; i < LEFT; i++) {
        xml += excelCell(i + 1, vals[i] == null ? '' : vals[i], styleId || '');
      }
      return xml;
    }

    function paintDays(start, end, styleId) {
      let xml = '';
      days.forEach((d, i) => {
        xml += excelCell(LEFT + 1 + i, '', inRange(d, start, end) ? styleId : 'Grid');
      });
      return xml;
    }

    (groups || []).forEach((g) => {
      const gDays =
        g.minPs || g.maxPe
          ? String(Math.max(1, daysBetween(g.minPs || g.maxPe, g.maxPe || g.minPs) + 1))
          : '';
      // 部门作标题行：任务列写部门名，责任人写汇总
      sheetRows.push(
        excelRow(
          leftCells(
            [
              g.name,
              '',
              g.owners || '',
              '',
              fmtDateSlash(g.minPs),
              fmtDateSlash(g.maxPe),
              gDays,
            ],
            'GroupRow'
          ) + paintDays(g.minPs, g.maxPe, 'Group')
        )
      );
      g.tasks.forEach((st) => {
        const r = planRange(st);
        const prog = getProgress(st);
        sheetRows.push(
          excelRow(
            leftCells([
              (st.content || '').trim(),
              (st.status || '').trim(),
              membersText(st),
              prog === '' ? '' : `${prog}%`,
              fmtDateSlash(r.ps),
              fmtDateSlash(r.pe),
              planDaysText(st),
            ]) + paintDays(r.ps, r.pe, 'Plan')
          )
        );
      });
    });

    let cols = '';
    const leftWidths = [120, 44, 56, 40, 68, 68, 32];
    leftWidths.forEach((w, i) => {
      cols += `<Column ss:Index="${i + 1}" ss:AutoFitWidth="0" ss:Width="${w}"/>`;
    });
    cols += `<Column ss:Index="${LEFT + 1}" ss:AutoFitWidth="0" ss:Width="12" ss:Span="${Math.max(0, dayCount - 1)}"/>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="微软雅黑" ss:Size="9"/>
  </Style>
  <Style ss:ID="Title"><Font ss:FontName="微软雅黑" ss:Size="14" ss:Bold="1"/></Style>
  <Style ss:ID="Meta"><Font ss:FontName="微软雅黑" ss:Size="9" ss:Color="#546E7A"/></Style>
  <Style ss:ID="Head">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="微软雅黑" ss:Size="9" ss:Bold="1"/>
   <Interior ss:Color="#DCEEFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeadDay">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="微软雅黑" ss:Size="8"/>
   <Interior ss:Color="#ECEFF1" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="GroupRow">
   <Font ss:FontName="微软雅黑" ss:Size="9" ss:Bold="1"/>
   <Interior ss:Color="#B3D4FC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Group"><Interior ss:Color="#5B9BD5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Plan"><Interior ss:Color="#5B9BD5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Grid">
   <Borders><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/></Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="甘特图">
  <Table>
${cols}
${sheetRows.join('\n')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/>
   <SplitHorizontal>5</SplitHorizontal><TopRowBottomPane>5</TopRowBottomPane>
   <SplitVertical>7</SplitVertical><LeftColumnRightPane>7</LeftColumnRightPane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
  }

  function exportExcel() {
    // 导出前把输入框最新值写入
    if (ganttRoot) {
      ganttRoot.querySelectorAll('[data-progress-id]').forEach((input) => {
        setProgress(input.getAttribute('data-progress-id'), input.value);
      });
    }
    const groups = lastGroups || groupByDepartment(subtasks);
    if (!groups.length) {
      alert('暂无子任务可导出');
      return;
    }
    const xml = buildExcelXml(groups);
    const blob = new Blob(['\ufeff' + xml], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    });
    const workNo = ((project && project.work_no) || 'project').replace(/[\\/:*?"<>|]/g, '_');
    const name = ((project && project.name) || '甘特图').replace(/[\\/:*?"<>|]/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${workNo}_${name}_甘特图.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
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
      loadProgress();
      const name = (project && project.name) || `项目 #${projectId}`;
      pageTitle.textContent = name;
      document.title = `甘特图 — ${name}`;
      render(subtasks);
    } catch (err) {
      showError(ganttRoot, err.message || '加载失败');
      summaryBar.textContent = '加载失败';
    }
  }

  if (btnPrint) btnPrint.addEventListener('click', () => window.print());
  if (btnExportExcel) btnExportExcel.addEventListener('click', exportExcel);
  if (btnRefresh) btnRefresh.addEventListener('click', () => load());

  load();
})();
