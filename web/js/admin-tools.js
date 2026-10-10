/**
 * 运维工具（设置 / 本地数据 / 日志）
 *
 * 依赖 api.js 函数：
 *   fetchSettings, updateSettings, runReminder
 *   fetchChangelog, fetchLogs, deleteLog
 *   （以及全局 apiBase / authHeaders，用于 blob 下载）
 *
 * 所需 DOM id：
 *   #toolsTabSettings  #toolsTabData  #toolsTabLogs
 *   #toolsPanelSettings  #toolsPanelData  #toolsPanelLogs
 *   #settingServerBaseUrl
 *   #settingReminderTime
 *   #settingProjectStartReminderDays
 *   #settingProjectEndReminderDays
 *   #btnSaveSettings
 *   #btnRunReminder
 *   #settingsMessage
 *   #settingsError
 *   #btnExportJson
 *   #btnDownloadDb
 *   #btnOpenChangelog
 *   #exportSummary
 *   #changelogModal
 *   #changelogRoot
 *   #changelogSummaryBar
 *   #btnRefreshChangelog
 *   #btnChangelogClose
 *   #logsRoot
 *   #logsSummaryBar
 *   #btnRefreshLogs
 */
(function () {
  const tabSettings = document.getElementById('toolsTabSettings');
  const tabData = document.getElementById('toolsTabData');
  const tabLogs = document.getElementById('toolsTabLogs');
  const panelSettings = document.getElementById('toolsPanelSettings');
  const panelData = document.getElementById('toolsPanelData');
  const panelLogs = document.getElementById('toolsPanelLogs');

  const settingServerBaseUrl = document.getElementById('settingServerBaseUrl');
  const settingReminderTime = document.getElementById('settingReminderTime');
  const settingProjectStartReminderDays = document.getElementById(
    'settingProjectStartReminderDays'
  );
  const settingProjectEndReminderDays = document.getElementById(
    'settingProjectEndReminderDays'
  );
  const settingsMessage = document.getElementById('settingsMessage');
  const settingsError = document.getElementById('settingsError');

  const exportSummary = document.getElementById('exportSummary');
  const changelogModal = document.getElementById('changelogModal');
  const changelogRoot = document.getElementById('changelogRoot');
  const changelogSummaryBar = document.getElementById('changelogSummaryBar');
  const logsRoot = document.getElementById('logsRoot');
  const logsSummaryBar = document.getElementById('logsSummaryBar');

  let loadedOnce = false;
  let lastExportMeta = null;
  let activeTab = 'settings';

  function canManage() {
    return !!(window.Auth && window.Auth.isLoggedIn() && window.Auth.canManageAccounts());
  }

  function setMessage(ok, text) {
    if (settingsMessage) {
      settingsMessage.hidden = !ok || !text;
      settingsMessage.textContent = ok ? text || '' : '';
    }
    if (settingsError) {
      settingsError.hidden = ok || !text;
      settingsError.textContent = ok ? '' : text || '';
    }
  }

  function switchTab(name) {
    activeTab = name;
    const map = {
      settings: [tabSettings, panelSettings],
      data: [tabData, panelData],
      logs: [tabLogs, panelLogs],
    };
    Object.keys(map).forEach((key) => {
      const [tab, panel] = map[key];
      const on = key === name;
      if (tab) {
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      if (panel) panel.hidden = !on;
    });
    if (name === 'logs') loadLogs(false);
  }

  if (tabSettings) tabSettings.addEventListener('click', () => switchTab('settings'));
  if (tabData) tabData.addEventListener('click', () => switchTab('data'));
  if (tabLogs) tabLogs.addEventListener('click', () => switchTab('logs'));

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);
  const btnRunReminder = document.getElementById('btnRunReminder');
  if (btnRunReminder) btnRunReminder.addEventListener('click', runReminderNow);
  const btnExportJson = document.getElementById('btnExportJson');
  if (btnExportJson) btnExportJson.addEventListener('click', exportJsonSnapshot);
  const btnDownloadDb = document.getElementById('btnDownloadDb');
  if (btnDownloadDb) btnDownloadDb.addEventListener('click', downloadDatabase);
  const btnOpenChangelog = document.getElementById('btnOpenChangelog');
  if (btnOpenChangelog) btnOpenChangelog.addEventListener('click', openChangelog);
  const btnRefreshChangelog = document.getElementById('btnRefreshChangelog');
  if (btnRefreshChangelog) {
    btnRefreshChangelog.addEventListener('click', () => loadChangelog(true));
  }
  const btnChangelogClose = document.getElementById('btnChangelogClose');
  if (btnChangelogClose) btnChangelogClose.addEventListener('click', closeChangelog);
  if (changelogModal) {
    changelogModal.addEventListener('click', (e) => {
      if (e.target === changelogModal) closeChangelog();
    });
  }
  const btnRefreshLogs = document.getElementById('btnRefreshLogs');
  if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', () => loadLogs(true));

  function fillSettings(s) {
    if (!s) return;
    if (settingServerBaseUrl) settingServerBaseUrl.value = s.server_base_url || '';
    if (settingReminderTime) settingReminderTime.value = s.reminder_time || '';
    if (settingProjectStartReminderDays) {
      settingProjectStartReminderDays.value =
        s.project_start_reminder_days != null ? String(s.project_start_reminder_days) : '1';
    }
    if (settingProjectEndReminderDays) {
      settingProjectEndReminderDays.value =
        s.project_end_reminder_days != null ? String(s.project_end_reminder_days) : '3';
    }
  }

  async function loadSettings() {
    setMessage(true, '');
    const data = await fetchSettings();
    fillSettings(data.settings || {});
  }

  async function saveSettings() {
    setMessage(true, '');
    const payload = {
      server_base_url: (settingServerBaseUrl && settingServerBaseUrl.value.trim()) || '',
      reminder_time: (settingReminderTime && settingReminderTime.value.trim()) || '',
      project_start_reminder_days: Number(
        settingProjectStartReminderDays && settingProjectStartReminderDays.value
      ),
      project_end_reminder_days: Number(
        settingProjectEndReminderDays && settingProjectEndReminderDays.value
      ),
    };
    try {
      const data = await updateSettings(payload);
      fillSettings(data.settings || payload);
      setMessage(true, data.msg || '设置已保存');
    } catch (err) {
      setMessage(false, err.message || '保存失败');
    }
  }

  async function runReminderNow() {
    setMessage(true, '');
    if (btnRunReminder) btnRunReminder.disabled = true;
    try {
      const data = await runReminder();
      const r = data.result || {};
      const detail = [
        r.scanned != null ? `扫描 ${r.scanned}` : '',
        r.notified != null ? `通知 ${r.notified}` : '',
        r.skipped != null ? `跳过 ${r.skipped}` : '',
      ]
        .filter(Boolean)
        .join('，');
      setMessage(true, data.msg || (detail ? `提醒已执行（${detail}）` : '提醒已执行'));
    } catch (err) {
      setMessage(false, err.message || '执行失败');
    } finally {
      if (btnRunReminder) btnRunReminder.disabled = false;
    }
  }

  function triggerBrowserDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderExportSummary() {
    if (!exportSummary) return;
    if (!lastExportMeta) {
      exportSummary.textContent = '尚未导出';
      return;
    }
    const c = lastExportMeta.count || {};
    const parts = [];
    if (c.users != null) parts.push(`成员 ${c.users}`);
    if (c.projects != null) parts.push(`项目 ${c.projects}`);
    exportSummary.textContent = `最近导出：${lastExportMeta.exported_at || '—'}（${
      parts.join('、') || '无计数'
    }）`;
  }

  async function exportJsonSnapshot() {
    if (btnExportJson) btnExportJson.disabled = true;
    try {
      const data = await apiGet('/api/db/export');
      lastExportMeta = {
        exported_at: data.exported_at || '',
        count: data.count || {},
      };
      renderExportSummary();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const stamp = String(data.exported_at || '')
        .replace(/[:\s]/g, '-')
        .replace(/-+/g, '-');
      triggerBrowserDownload(blob, `db-export-${stamp || Date.now()}.json`);
    } catch (err) {
      alert(err.message || '导出失败');
    } finally {
      if (btnExportJson) btnExportJson.disabled = false;
    }
  }

  async function downloadDatabase() {
    if (btnDownloadDb) btnDownloadDb.disabled = true;
    try {
      const url = `${apiBase()}/api/db/download`;
      const res = await fetch(url, { method: 'GET', headers: authHeaders() });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data && data.error) msg = data.error;
        } catch (e) {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      let filename = 'wecom.db';
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd);
      if (m && m[1]) {
        try {
          filename = decodeURIComponent(m[1].replace(/"/g, '').trim());
        } catch (e) {
          filename = m[1].replace(/"/g, '').trim() || filename;
        }
      }
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      alert(err.message || '下载失败');
    } finally {
      if (btnDownloadDb) btnDownloadDb.disabled = false;
    }
  }

  function formatSize(n) {
    const num = Number(n) || 0;
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatVersionLabel(version) {
    const v = String(version || '').trim();
    if (!v) return '—';
    return v.startsWith('v') || v.startsWith('V') ? v : `v${v}`;
  }

  function openChangelog() {
    if (!changelogModal) return;
    changelogModal.hidden = false;
    loadChangelog(false);
  }

  function closeChangelog() {
    if (changelogModal) changelogModal.hidden = true;
  }

  function renderChangelog(entries) {
    if (!changelogRoot) return;
    if (!entries.length) {
      changelogRoot.innerHTML = '<div class="state-box"><p>暂无变更记录</p></div>';
      return;
    }
    changelogRoot.innerHTML = entries
      .map((entry) => {
        const date = escapeHtml(entry.date || '—');
        const ver = escapeHtml(formatVersionLabel(entry.version));
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        const items = changes.length
          ? `<ul class="changelog-changes">${changes
              .map((c) => `<li>${escapeHtml(c)}</li>`)
              .join('')}</ul>`
          : '<p class="muted">（无条目）</p>';
        return `<article class="changelog-entry">
          <div class="changelog-head">${date}<span class="changelog-version">${ver}</span></div>
          ${items}
        </article>`;
      })
      .join('');
  }

  async function loadChangelog(force) {
    if (!changelogRoot) return;
    if (!force && changelogRoot.dataset.loaded === '1') return;
    showLoading(changelogRoot, '正在加载变更记录…');
    if (changelogSummaryBar) changelogSummaryBar.textContent = '加载中…';
    try {
      const data = await fetchChangelog();
      const entries = data.entries || [];
      changelogRoot.dataset.loaded = '1';
      const appVer =
        (window.APP_CONFIG && window.APP_CONFIG.appVersion) ||
        (typeof getAppVersion === 'function' ? getAppVersion() : '') ||
        '';
      if (changelogSummaryBar) {
        changelogSummaryBar.textContent = appVer
          ? `当前网页 ${appVer} · 共 ${entries.length} 条`
          : `共 ${entries.length} 条`;
      }
      renderChangelog(entries);
    } catch (err) {
      showError(changelogRoot, err.message || '加载失败');
      if (changelogSummaryBar) changelogSummaryBar.textContent = '变更记录加载失败';
    }
  }

  async function downloadLogFile(name) {
    const url = `${apiBase()}/api/logs/download?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { method: 'GET', headers: authHeaders() });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch (e) {
        /* ignore */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    triggerBrowserDownload(blob, name);
  }

  function renderLogs(files) {
    if (!logsRoot) return;
    if (!files.length) {
      logsRoot.innerHTML = '<div class="state-box"><p>暂无日志文件</p></div>';
      return;
    }
    logsRoot.innerHTML = `
      <ul class="tools-log-list">
        ${files
          .map((f) => {
            const name = escapeHtml(f.name || '');
            return `<li class="tools-log-item" data-name="${name}">
              <div class="tools-log-meta">
                <strong>${name}</strong>
                <span class="muted">${escapeHtml(formatSize(f.size))} · ${escapeHtml(
              displayOrDash(f.modified_at)
            )}</span>
              </div>
              <div class="account-actions">
                <button type="button" class="btn btn-sm" data-dl="${name}">下载</button>
                <button type="button" class="btn btn-sm btn-danger" data-del="${name}">删除</button>
              </div>
            </li>`;
          })
          .join('')}
      </ul>`;

    logsRoot.querySelectorAll('[data-dl]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-dl') || '';
        if (!name) return;
        btn.disabled = true;
        try {
          await downloadLogFile(name);
        } catch (err) {
          alert(err.message || '下载失败');
        } finally {
          btn.disabled = false;
        }
      });
    });
    logsRoot.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-del') || '';
        if (!name) return;
        if (!confirm(`确定删除日志「${name}」？`)) return;
        try {
          await deleteLog(name);
          await loadLogs(true);
        } catch (err) {
          alert(err.message || '删除失败');
        }
      });
    });
  }

  async function loadLogs(force) {
    if (!logsRoot) return;
    if (!force && logsRoot.dataset.loaded === '1') return;
    showLoading(logsRoot, '正在加载日志列表…');
    if (logsSummaryBar) logsSummaryBar.textContent = '加载中…';
    try {
      const data = await fetchLogs();
      const files = data.files || [];
      logsRoot.dataset.loaded = '1';
      if (logsSummaryBar) {
        logsSummaryBar.textContent = `共 ${files.length} 个日志文件${
          data.dir ? ` · 目录 ${data.dir}` : ''
        }`;
      }
      renderLogs(files);
    } catch (err) {
      showError(logsRoot, err.message || '加载失败');
      if (logsSummaryBar) logsSummaryBar.textContent = '加载失败';
    }
  }

  async function load(force) {
    if (!canManage()) {
      setMessage(false, '需要管理员权限才能使用运维工具');
      if (exportSummary) exportSummary.textContent = '无权限';
      if (logsSummaryBar) logsSummaryBar.textContent = '无权限';
      if (logsRoot) {
        logsRoot.innerHTML =
          '<div class="state-box error"><p>当前未登录管理员账户，无法使用运维工具。</p></div>';
      }
      closeChangelog();
      switchTab('settings');
      return;
    }
    if (loadedOnce && !force) {
      switchTab(activeTab);
      return;
    }
    try {
      if (force && logsRoot) delete logsRoot.dataset.loaded;
      if (force && changelogRoot) delete changelogRoot.dataset.loaded;
      await loadSettings();
      renderExportSummary();
      loadedOnce = true;
      switchTab(activeTab || 'settings');
    } catch (err) {
      setMessage(false, err.message || '加载设置失败');
    }
  }

  window.AdminToolsApp = { load };
})();
