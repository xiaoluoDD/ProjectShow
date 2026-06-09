// 与桌面端 ProjectStatusUtils 对齐的状态配色
const STATUS = {
  NOT_STARTED: '待启动',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完结',
  OVERDUE: '逾期',
};

const STATUS_CLASS = {
  [STATUS.IN_PROGRESS]: 'status-in-progress',
  [STATUS.COMPLETED]: 'status-completed',
  [STATUS.OVERDUE]: 'status-overdue',
  [STATUS.NOT_STARTED]: 'status-not-started',
};

function statusBadgeHtml(text) {
  const t = (text || '').trim() || '—';
  const cls = STATUS_CLASS[t] || 'status-default';
  return `<span class="status-badge ${cls}">${escapeHtml(t)}</span>`;
}
