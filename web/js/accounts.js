(function () {
  const accountsRoot = document.getElementById('accountsRoot');
  const accountsSummaryBar = document.getElementById('accountsSummaryBar');
  const accountModal = document.getElementById('accountModal');
  const accountEditId = document.getElementById('accountEditId');
  const accountUsername = document.getElementById('accountUsername');
  const accountDisplayName = document.getElementById('accountDisplayName');
  const accountRole = document.getElementById('accountRole');
  const accountPassword = document.getElementById('accountPassword');
  const accountPasswordLabel = document.getElementById('accountPasswordLabel');
  const accountPasswordHint = document.getElementById('accountPasswordHint');
  const accountError = document.getElementById('accountError');
  const accountModalTitle = document.getElementById('accountModalTitle');
  const loginHistoryModal = document.getElementById('loginHistoryModal');
  const loginHistoryTitle = document.getElementById('loginHistoryTitle');
  const loginHistoryHint = document.getElementById('loginHistoryHint');
  const loginHistoryList = document.getElementById('loginHistoryList');
  const btnLoginHistoryClose = document.getElementById('btnLoginHistoryClose');

  let loadedOnce = false;

  document.getElementById('btnAddAccount').addEventListener('click', () => openEditor(null));
  document.getElementById('btnAccountCancel').addEventListener('click', closeEditor);
  document.getElementById('btnAccountSave').addEventListener('click', saveEditor);
  if (btnLoginHistoryClose) {
    btnLoginHistoryClose.addEventListener('click', closeLoginHistory);
  }
  if (loginHistoryModal) {
    loginHistoryModal.addEventListener('click', (e) => {
      if (e.target === loginHistoryModal) closeLoginHistory();
    });
  }

  function roleLabel(role) {
    if (role === 'admin') return '管理员';
    if (role === 'super_admin') return '超级管理员';
    if (role === 'user') return '普通';
    return role || '—';
  }

  function formatLoginTime(raw) {
    const s = String(raw || '').trim();
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function openEditor(account) {
    accountError.hidden = true;
    accountError.textContent = '';
    if (account) {
      accountModalTitle.textContent = '编辑账户';
      accountEditId.value = String(account.id);
      accountUsername.value = account.username || '';
      accountUsername.disabled = true;
      accountDisplayName.value = account.display_name || '';
      accountRole.value = account.role === 'admin' ? 'admin' : 'user';
      accountPassword.value = '';
      accountPasswordLabel.textContent = '新密码';
      accountPasswordHint.hidden = false;
      accountPassword.required = false;
    } else {
      accountModalTitle.textContent = '新增账户';
      accountEditId.value = '';
      accountUsername.value = '';
      accountUsername.disabled = false;
      accountDisplayName.value = '';
      accountRole.value = 'user';
      accountPassword.value = '';
      accountPasswordLabel.textContent = '密码';
      accountPasswordHint.hidden = true;
    }
    accountModal.hidden = false;
  }

  function closeEditor() {
    accountModal.hidden = true;
  }

  function closeLoginHistory() {
    if (loginHistoryModal) loginHistoryModal.hidden = true;
  }

  async function openLoginHistory(account) {
    if (!loginHistoryModal || !account) return;
    const username = (account.username || '').trim();
    const titleName = account.display_name || username || '账户';
    loginHistoryTitle.textContent = `登录记录 — ${titleName}`;
    loginHistoryHint.textContent = `账号 ${username} · 最近 10 次`;
    loginHistoryList.innerHTML = '<p class="muted">加载中…</p>';
    loginHistoryModal.hidden = false;
    try {
      const data = await fetchAccountLoginHistory(username, 10);
      const logs = data.logs || [];
      if (!logs.length) {
        loginHistoryList.innerHTML = '<p class="muted">暂无登录记录</p>';
        return;
      }
      loginHistoryList.innerHTML = `
        <ol class="login-history-ol">
          ${logs
            .map(
              (log, idx) =>
                `<li><span class="login-history-idx">${idx + 1}.</span> ${escapeHtml(
                  formatLoginTime(log.logged_at)
                )}</li>`
            )
            .join('')}
        </ol>`;
    } catch (err) {
      loginHistoryList.innerHTML = `<p class="modal-error">${escapeHtml(
        err.message || '加载失败'
      )}</p>`;
    }
  }

  async function saveEditor() {
    accountError.hidden = true;
    const id = accountEditId.value.trim();
    const username = accountUsername.value.trim();
    const displayName = accountDisplayName.value.trim();
    const role = accountRole.value;
    const password = accountPassword.value;

    try {
      if (id) {
        const payload = { id: Number(id), display_name: displayName, role };
        if (password) payload.password = password;
        await updateAccount(payload);
      } else {
        if (!username || !password) {
          throw new Error('用户名和密码不能为空');
        }
        await createAccount({
          username,
          password,
          display_name: displayName,
          role,
        });
      }
      closeEditor();
      await load(true);
    } catch (err) {
      accountError.textContent = err.message || '保存失败';
      accountError.hidden = false;
    }
  }

  function renderAccounts(accounts) {
    if (!accounts.length) {
      accountsRoot.innerHTML = '<div class="state-box"><p>暂无账户</p></div>';
      return;
    }
    accountsRoot.innerHTML = accounts
      .map((a) => {
        const builtin = !!a.builtin;
        const historyBtn = `<button type="button" class="btn btn-sm" data-login-history="${escapeHtml(
          a.username || ''
        )}">登录记录</button>`;
        const actions = builtin
          ? `<div class="account-actions">${historyBtn}<span class="muted">系统内置，不可改删</span></div>`
          : `<div class="account-actions">
               ${historyBtn}
               <button type="button" class="btn btn-sm" data-edit="${a.id}">编辑</button>
               <button type="button" class="btn btn-sm btn-danger" data-del="${a.id}">删除</button>
             </div>`;
        return `
          <article class="account-card" data-id="${a.id}">
            <div class="card-top">
              <span class="card-meta">${escapeHtml(a.username || '')}</span>
              <span class="status-badge status-default">${escapeHtml(a.role_label || roleLabel(a.role))}</span>
            </div>
            <h2 class="card-title">${escapeHtml(a.display_name || a.username || '—')}</h2>
            ${actions}
          </article>`;
      })
      .join('');

    accountsRoot.querySelectorAll('[data-login-history]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const username = btn.getAttribute('data-login-history') || '';
        const account = (window.__accountsCache || []).find((x) => x.username === username);
        openLoginHistory(account || { username });
      });
    });
    accountsRoot.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-edit'));
        const account = (window.__accountsCache || []).find((x) => x.id === id);
        if (account) openEditor(account);
      });
    });
    accountsRoot.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-del'));
        if (!id) return;
        if (!confirm('确定删除该账户？')) return;
        try {
          await deleteAccount(id);
          await load(true);
        } catch (err) {
          alert(err.message || '删除失败');
        }
      });
    });
  }

  async function load(force) {
    if (!window.Auth || !window.Auth.canManageAccounts()) {
      accountsSummaryBar.textContent = '需要管理员权限';
      accountsRoot.innerHTML =
        '<div class="state-box error"><p>当前未登录管理员账户，无法管理账户。</p></div>';
      return;
    }
    if (loadedOnce && !force && window.__accountsCache) {
      renderAccounts(window.__accountsCache);
      return;
    }
    showLoading(accountsRoot, '正在加载账户…');
    accountsSummaryBar.textContent = '加载中…';
    try {
      const data = await fetchAccounts();
      const accounts = data.accounts || [];
      window.__accountsCache = accounts;
      loadedOnce = true;
      accountsSummaryBar.textContent = `共 ${accounts.length} 个账户（含内置超级管理员）`;
      renderAccounts(accounts);
    } catch (err) {
      showError(accountsRoot, err.message || '加载失败');
      accountsSummaryBar.textContent = '加载失败';
    }
  }

  window.AccountsApp = { load };
})();
