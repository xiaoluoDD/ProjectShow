/**
 * 项目甘特图（第一期）
 * - 按子任务成员「第一个部门」分组（一人多部门取 department_name 用「、」拆开后的第一段）
 * - 部门标题行带汇总计划时间条（该组任务最早～最晚）
 * - 导出可编辑 Excel（SpreadsheetML .xls，进度% 列留空手填）
 */
(function () {
  const ganttRoot = document.getElementById('ganttRoot');
  const summaryBar = document.getElementById('summaryBar');
  const pageTitle = document.getElementById('pageTitle');
  const backLink = document.getElementById('backLink');
  const chkShowActual = document.getElementById('chkShowActual');
  const btnPrint = document.getElementById('btnPrintGantt');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnRefresh = document.getElementById('btnRefresh');

  const projectId = queryParam('project_id');
  const from = (queryParam('from') || '').trim();
  const UNASSIGNED_DEPT = '（未分配部门）';

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
  let showActual = true;
  /** @type {ReturnType<typeof groupByDepartment>|null} */
  let lastGroups = null;

  const DAY_MS = 24 * 60 * 60 * 1000;

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
    return (
      list
        .map((m) => (m.name || m.userid || '').trim())
        .filter(Boolean)
        .join('、') || '—'
    );
  }

  // 一人多部门时 department_name 为「A、B、C」；取第一段作为分组部门。
  function firstDepartmentName(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    return s.split(/[、,，]/)[0].trim();
  }

  // 子任务归属部门：取第一个成员的第一个部门；无成员 → 未分配。
  function taskDepartment(st) {
    const list = Array.isArray(st.members) ? st.members : [];
    for (let i = 0; i < list.length; i++) {
      const dept = firstDepartmentName(list[i] && list[i].department_name);
      if (dept) return dept;
    }
    return UNASSIGNED_DEPT;
  }

  function rangeOfTask(st) {
    const ps = parseDate(st.planned_start_date);
    const pe = parseDate(st.planned_end_date);
    const as = parseDate(st.actual_start_date);
    const ae = parseDate(st.actual_end_date);
    return { ps, pe, as, ae };
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
        const r = rangeOfTask(st);
        if (r.ps && (!minPs || r.ps < minPs)) minPs = r.ps;
        if (r.pe && (!maxPe || r.pe > maxPe)) maxPe = r.pe;
        if (!r.ps && r.pe && (!minPs || r.pe < minPs)) minPs = r.pe;
        if (!r.pe && r.ps && (!maxPe || r.ps > maxPe)) maxPe = r.ps;
      });
      return { name, tasks: items, minPs, maxPe };
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
    const start = addDays(min, -2);
    let end = addDays(max, 2);
    if (end < start) end = addDays(start, 7);
    const totalDays = Math.max(1, daysBetween(start, end) + 1);
    return { start, end, totalDays };
  }

  function buildTicks(timeline) {
    const { start, end, totalDays } = timeline;
    const ticks = [];
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

  function renderTaskRow(st, timeline) {
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
  }

  function renderGroupRow(group, timeline) {
    const plan = barStyle(group.minPs, group.maxPe, timeline);
    const rangeText =
      group.minPs || group.maxPe
        ? `${fmtDate(group.minPs) || '—'} ~ ${fmtDate(group.maxPe) || '—'}`
        : '无计划日期';
    return `
      <div class="gantt-row gantt-row-group">
        <div class="gantt-label">
          <div class="gantt-task-name gantt-group-name">${escapeHtml(group.name)}</div>
          <div class="gantt-task-meta">
            <span>${group.tasks.length} 项</span>
            <span class="gantt-status">${escapeHtml(rangeText)}</span>
          </div>
        </div>
        <div class="gantt-track">
          ${
            plan
              ? `<div class="gantt-bar gantt-bar-group" style="left:${plan.left};width:${plan.width}" title="部门汇总 ${escapeHtml(plan.title)}"></div>`
              : `<div class="gantt-bar-missing">无计划日期</div>`
          }
        </div>
      </div>`;
  }

  function render(tasks) {
    const groups = groupByDepartment(tasks);
    lastGroups = groups;
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

    const rowsHtml = groups
      .map((g) => renderGroupRow(g, timeline) + g.tasks.map((st) => renderTaskRow(st, timeline)).join(''))
      .join('');

    ganttRoot.innerHTML = `
      <div class="gantt-sheet">
        <div class="gantt-print-head">
          <h2>${escapeHtml((project && project.name) || '项目甘特图')}</h2>
          <p>${escapeHtml(headMeta)}</p>
          <p>时间范围：${escapeHtml(fmtDate(timeline.start))} ~ ${escapeHtml(fmtDate(timeline.end))} · 共 ${tasks.length} 项任务 · ${groups.length} 个部门</p>
        </div>
        <div class="gantt-head-row">
          <div class="gantt-corner">部门 / 任务 / 成员</div>
          <div class="gantt-timeline-head">
            <div class="gantt-ticks">${tickHtml}</div>
          </div>
        </div>
        <div class="gantt-body">
          ${rowsHtml || '<div class="gantt-empty">暂无子任务</div>'}
        </div>
      </div>`;

    summaryBar.textContent =
      `共 ${tasks.length} 项子任务，${groups.length} 个部门` +
      (missingPlan ? `，其中 ${missingPlan} 项无计划日期` : '') +
      ` · 轴：${fmtDate(timeline.start)} ~ ${fmtDate(timeline.end)}`;
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function plannedDays(st) {
    const r = rangeOfTask(st);
    if (!r.ps && !r.pe) return '';
    const s = r.ps || r.pe;
    const e = r.pe || r.ps;
    return String(Math.max(1, daysBetween(s, e) + 1));
  }

  function inRange(day, start, end) {
    if (!day || (!start && !end)) return false;
    const s = start || end;
    const e = end || start;
    const t0 = s < e ? s : e;
    const t1 = s < e ? e : s;
    return day >= t0 && day <= t1;
  }

  function excelCell(colIndex, value, styleId) {
    const attrs = [`ss:Index="${colIndex}"`];
    if (styleId) attrs.push(`ss:StyleID="${styleId}"`);
    if (value === '' || value == null) {
      return `<Cell ${attrs.join(' ')}/>`;
    }
    return `<Cell ${attrs.join(' ')}><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
  }

  function excelRow(cellsXml, height) {
    const h = height ? ` ss:Height="${height}"` : '';
    return `<Row${h}>${cellsXml}</Row>`;
  }

  // 导出「左侧信息 + 右侧按日色块」的甘特样式 Excel（可编辑，进度% 留空）。
  function buildExcelXml(groups) {
    const title = (project && project.name) || '项目甘特图';
    const workNo = (project && project.work_no) || '';
    const allTasks = (groups || []).reduce((acc, g) => acc.concat(g.tasks), []);
    const timeline = computeTimeline(allTasks);
    // 导出用逐日格子；过长时仍按日（Excel 可横向滚动），上限约一年避免极端文件
    const dayCount = Math.min(Math.max(1, timeline.totalDays), 370);
    const days = [];
    for (let i = 0; i < dayCount; i++) {
      days.push(addDays(timeline.start, i));
    }

    const LEFT = 11; // A..K
    const headers = [
      '部门',
      '行类型',
      '任务内容',
      '责任人',
      '状态',
      '计划开始',
      '计划结束',
      '实际开始',
      '实际结束',
      '天数',
      '进度%',
    ];

    const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
    const sheetRows = [];

    // 标题
    sheetRows.push(
      excelRow(
        excelCell(1, `${workNo ? workNo + ' ' : ''}${title}`.trim(), 'Title') +
          excelCell(2, '', 'Title') +
          excelCell(LEFT + 1, '图例：', 'Meta') +
          excelCell(LEFT + 2, '部门汇总', 'Group') +
          excelCell(LEFT + 3, '计划', 'Plan') +
          excelCell(LEFT + 4, '实际', 'Actual')
      )
    );
    sheetRows.push(
      excelRow(
        excelCell(
          1,
          `负责人：${(project && (project.manager_name || project.manager_userid)) || '—'}  ·  导出：${fmtDate(new Date())}  ·  进度% 请手填  ·  色块为甘特条（可改）`,
          'Meta'
        )
      )
    );

    // 月行
    let monthCells = '';
    for (let i = 0; i < LEFT; i++) {
      monthCells += excelCell(i + 1, i === 0 ? '月份' : '', 'Head');
    }
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
        `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`,
        'Head'
      );
      for (let k = mi + 1; k < mj; k++) {
        monthCells += excelCell(LEFT + 1 + k, '', 'Head');
      }
      mi = mj;
    }
    sheetRows.push(excelRow(monthCells));

    // 日号 + 星期
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
        if (inRange(d, start, end)) {
          xml += excelCell(LEFT + 1 + i, '', styleId);
        } else {
          xml += excelCell(LEFT + 1 + i, '', 'Grid');
        }
      });
      return xml;
    }

    // 计划优先铺蓝，实际覆盖为绿（同一天有实际则显示实际）
    function paintTaskDays(planStart, planEnd, actStart, actEnd) {
      let xml = '';
      days.forEach((d, i) => {
        const onActual = showActual && inRange(d, actStart, actEnd);
        const onPlan = inRange(d, planStart, planEnd);
        if (onActual) xml += excelCell(LEFT + 1 + i, '', 'Actual');
        else if (onPlan) xml += excelCell(LEFT + 1 + i, '', 'Plan');
        else xml += excelCell(LEFT + 1 + i, '', 'Grid');
      });
      return xml;
    }

    (groups || []).forEach((g) => {
      const gDays =
        g.minPs || g.maxPe
          ? String(Math.max(1, daysBetween(g.minPs || g.maxPe, g.maxPe || g.minPs) + 1))
          : '';
      sheetRows.push(
        excelRow(
          leftCells(
            [g.name, '部门汇总', '', '', '', fmtDate(g.minPs), fmtDate(g.maxPe), '', '', gDays, ''],
            'GroupRow'
          ) + paintDays(g.minPs, g.maxPe, 'Group')
        )
      );
      g.tasks.forEach((st) => {
        const r = rangeOfTask(st);
        sheetRows.push(
          excelRow(
            leftCells([
              g.name,
              '任务',
              (st.content || '').trim(),
              membersText(st) === '—' ? '' : membersText(st),
              (st.status || '').trim(),
              fmtDate(r.ps),
              fmtDate(r.pe),
              fmtDate(r.as),
              fmtDate(r.ae),
              plannedDays(st),
              '',
            ]) + paintTaskDays(r.ps, r.pe, r.as, r.ae)
          )
        );
      });
    });

    // 列宽：左侧固定宽，日期列很窄
    let cols = '';
    const leftWidths = [72, 48, 160, 72, 48, 72, 72, 72, 72, 36, 40];
    leftWidths.forEach((w, i) => {
      cols += `<Column ss:Index="${i + 1}" ss:AutoFitWidth="0" ss:Width="${w}"/>`;
    });
    cols += `<Column ss:Index="${LEFT + 1}" ss:AutoFitWidth="0" ss:Width="14" ss:Span="${Math.max(0, dayCount - 1)}"/>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="微软雅黑" ss:Size="9"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="微软雅黑" ss:Size="14" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Meta">
   <Font ss:FontName="微软雅黑" ss:Size="9" ss:Color="#546E7A"/>
  </Style>
  <Style ss:ID="Head">
   <Font ss:FontName="微软雅黑" ss:Size="9" ss:Bold="1"/>
   <Interior ss:Color="#ECEFF1" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CFD8DC"/>
   </Borders>
  </Style>
  <Style ss:ID="HeadDay">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="微软雅黑" ss:Size="8"/>
   <Interior ss:Color="#ECEFF1" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0E0E0"/>
   </Borders>
  </Style>
  <Style ss:ID="GroupRow">
   <Font ss:FontName="微软雅黑" ss:Size="9" ss:Bold="1" ss:Color="#4527A0"/>
   <Interior ss:Color="#F3E5F5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Group">
   <Interior ss:Color="#7E57C2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5E35B1"/>
   </Borders>
  </Style>
  <Style ss:ID="Plan">
   <Interior ss:Color="#42A5F5" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E88E5"/>
   </Borders>
  </Style>
  <Style ss:ID="Actual">
   <Interior ss:Color="#66BB6A" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#43A047"/>
   </Borders>
  </Style>
  <Style ss:ID="Grid">
   <Borders>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="甘特图">
  <Table>
${cols}
${sheetRows.join('\n')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>5</SplitHorizontal>
   <TopRowBottomPane>5</TopRowBottomPane>
   <SplitVertical>11</SplitVertical>
   <LeftColumnRightPane>11</LeftColumnRightPane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
  }

  function exportExcel() {
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
    btnPrint.addEventListener('click', () => window.print());
  }
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', exportExcel);
  }
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => load());
  }

  load();
})();
