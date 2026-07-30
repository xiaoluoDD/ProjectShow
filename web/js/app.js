(function () {
  applyAppVersionBadge();

  const viewSwitch = document.getElementById('viewSwitch');
  const optAccounts = document.getElementById('optAccounts');
  const btnFilter = document.getElementById('btnFilter');
  const btnAddProject = document.getElementById('btnAddProject');
  const btnKiosk = document.getElementById('btnKiosk');
  const btnKioskExit = document.getElementById('btnKioskExit');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnLogin = document.getElementById('btnLogin');
  const btnChangePassword = document.getElementById('btnChangePassword');
  const btnLogout = document.getElementById('btnLogout');
  const authUserBar = document.getElementById('authUserBar');
  const dashboardView = document.getElementById('dashboardView');
  const projectsView = document.getElementById('projectsView');
  const accountsView = document.getElementById('accountsView');
  const loginModal = document.getElementById('loginModal');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const passwordModal = document.getElementById('passwordModal');
  const newPassword = document.getElementById('newPassword');
  const newPasswordConfirm = document.getElementById('newPasswordConfirm');
  const passwordError = document.getElementById('passwordError');
  const projectsHint = document.getElementById('projectsHint');

  function canChangeOwnPassword(user) {
    if (!user || !user.username) return false;
    // 内置超级管理员 root 密码写死在代码里，不可通过此接口修改
    if (user.is_super_admin || String(user.username).toLowerCase() === 'root') return false;
    return true;
  }

  function currentView() {
    const q = new URLSearchParams(window.location.search).get('view');
    if (q === 'projects' || q === 'dashboard' || q === 'accounts') return q;
    return 'dashboard';
  }

  function roleText(user) {
    if (!user) return '';
    if (user.is_super_admin || user.role === 'super_admin') return '超级管理员';
    if (user.role === 'admin') return '管理员';
    if (user.role === 'user') return '普通';
    return user.role || '';
  }

  function refreshAuthUI() {
    const loggedIn = window.Auth && window.Auth.isLoggedIn();
    const canManage = window.Auth && window.Auth.canManageAccounts();
    const canEdit = window.Auth && window.Auth.canEditProjects();
    const user = window.Auth ? window.Auth.getUser() : null;

    btnLogin.hidden = !!loggedIn;
    btnLogout.hidden = !loggedIn;
    if (btnChangePassword) btnChangePassword.hidden = !(loggedIn && canChangeOwnPassword(user));
    optAccounts.hidden = !canManage;

    if (loggedIn && user) {
      authUserBar.hidden = false;
      authUserBar.textContent = `已登录：${user.display_name || user.username}（${roleText(user)}）`;
    } else {
      authUserBar.hidden = true;
      authUserBar.textContent = '';
    }

    if (projectsHint) {
      projectsHint.textContent = canEdit
        ? '已登录，可点顶栏「新增项目」· 下拉页面可刷新'
        : '未登录仅可查看 · 下拉页面可刷新';
    }

    refreshAddProjectButton();

    if (!canManage && viewSwitch.value === 'accounts') {
      setView('dashboard', true);
    }
  }

  function refreshAddProjectButton() {
    if (!btnAddProject) return;
    const canEdit = window.Auth && window.Auth.canEditProjects();
    const onProjects = viewSwitch.value === 'projects';
    btnAddProject.hidden = !(canEdit && onProjects);
  }

  function setView(view, pushUrl) {
    let next = view;
    if (next !== 'projects' && next !== 'dashboard' && next !== 'accounts') {
      next = 'dashboard';
    }
    if (next === 'accounts' && !(window.Auth && window.Auth.canManageAccounts())) {
      next = 'dashboard';
    }

    viewSwitch.value = next;
    const isDash = next === 'dashboard';
    const isProjects = next === 'projects';
    const isAccounts = next === 'accounts';

    dashboardView.hidden = !isDash;
    projectsView.hidden = !isProjects;
    accountsView.hidden = !isAccounts;
    btnFilter.hidden = !isProjects;
    refreshAddProjectButton();

    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', next);
      history.replaceState(null, '', url);
    }

    if (isDash) {
      if (window.DashboardApp) window.DashboardApp.load();
      else {
        const bar = document.getElementById('dashSummaryBar');
        const root = document.getElementById('dashboardRoot');
        if (bar) bar.textContent = '看板脚本未加载';
        if (root) {
          root.innerHTML =
            '<div class="state-box error"><p>缺少 js/dashboard.js，请确认已同步最新 web 静态文件后强制刷新。</p></div>';
        }
      }
    } else if (isProjects) {
      if (window.ProjectListApp) window.ProjectListApp.load();
    } else if (isAccounts) {
      if (window.AccountsApp) window.AccountsApp.load(true);
    }
  }

  function openLogin() {
    loginError.hidden = true;
    loginError.textContent = '';
    loginUsername.value = '';
    loginPassword.value = '';
    loginModal.hidden = false;
    setTimeout(() => loginUsername.focus(), 50);
  }

  function closeLogin() {
    loginModal.hidden = true;
  }

  function openPasswordModal() {
    if (!passwordModal) return;
    passwordError.hidden = true;
    passwordError.textContent = '';
    newPassword.value = '';
    newPasswordConfirm.value = '';
    passwordModal.hidden = false;
    setTimeout(() => newPassword.focus(), 50);
  }

  function closePasswordModal() {
    if (passwordModal) passwordModal.hidden = true;
  }

  async function submitPasswordChange() {
    passwordError.hidden = true;
    const pwd = (newPassword.value || '').trim();
    const confirm = (newPasswordConfirm.value || '').trim();
    if (!pwd) {
      passwordError.textContent = '请输入新密码';
      passwordError.hidden = false;
      return;
    }
    if (pwd.length < 4) {
      passwordError.textContent = '新密码至少 4 位';
      passwordError.hidden = false;
      return;
    }
    if (pwd !== confirm) {
      passwordError.textContent = '两次输入的密码不一致';
      passwordError.hidden = false;
      return;
    }
    try {
      await changeOwnPassword(pwd);
      closePasswordModal();
      alert('密码已更新，请牢记新密码。');
    } catch (err) {
      passwordError.textContent = err.message || '修改失败';
      passwordError.hidden = false;
    }
  }

  async function submitLogin() {
    loginError.hidden = true;
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    if (!username || !password) {
      loginError.textContent = '请输入账号和密码';
      loginError.hidden = false;
      return;
    }
    try {
      await window.Auth.login(username, password);
      closeLogin();
      refreshAuthUI();
      setView(viewSwitch.value, false);
    } catch (err) {
      loginError.textContent = err.message || '登录失败';
      loginError.hidden = false;
    }
  }

  viewSwitch.addEventListener('change', () => setView(viewSwitch.value, true));

  btnRefresh.addEventListener('click', () => {
    const v = viewSwitch.value;
    if (v === 'dashboard') {
      if (window.DashboardApp) window.DashboardApp.load(true);
      else setView('dashboard', false);
    } else if (v === 'projects') {
      if (window.ProjectListApp) window.ProjectListApp.load(true);
      else setView('projects', false);
    } else if (v === 'accounts') {
      if (window.AccountsApp) window.AccountsApp.load(true);
      else setView('accounts', false);
    }
  });

  btnLogin.addEventListener('click', openLogin);
  if (btnChangePassword) {
    btnChangePassword.addEventListener('click', openPasswordModal);
  }
  btnLogout.addEventListener('click', async () => {
    await window.Auth.logout();
    refreshAuthUI();
    if (viewSwitch.value === 'accounts') setView('dashboard', true);
  });

  if (btnAddProject) {
    btnAddProject.addEventListener('click', () => {
      if (window.ProjectFormApp && typeof window.ProjectFormApp.openCreate === 'function') {
        window.ProjectFormApp.openCreate();
        return;
      }
      alert(
        '新建项目脚本未加载。请确认已同步 js/project-form.js，并强制刷新页面（Ctrl+F5）。'
      );
    });
  }

  document.getElementById('btnLoginCancel').addEventListener('click', closeLogin);
  document.getElementById('btnLoginSubmit').addEventListener('click', submitLogin);
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLogin();
  });

  if (passwordModal) {
    document.getElementById('btnPasswordCancel').addEventListener('click', closePasswordModal);
    document.getElementById('btnPasswordSave').addEventListener('click', submitPasswordChange);
    newPasswordConfirm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPasswordChange();
    });
    passwordModal.addEventListener('click', (e) => {
      if (e.target === passwordModal) closePasswordModal();
    });
  }

  document.addEventListener('authchange', () => {
    refreshAuthUI();
  });

  let kioskMode = false;
  let kioskTimer = null;
  const KIOSK_REFRESH_MS = 60 * 1000;

  function isKioskQuery() {
    const q = new URLSearchParams(window.location.search);
    return q.get('kiosk') === '1' || q.get('fullscreen') === '1';
  }

  function syncKioskUrl(on) {
    const url = new URL(window.location.href);
    if (on) {
      url.searchParams.set('view', 'dashboard');
      url.searchParams.set('kiosk', '1');
    } else {
      url.searchParams.delete('kiosk');
      url.searchParams.delete('fullscreen');
    }
    history.replaceState(null, '', url);
  }

  function stopKioskAutoRefresh() {
    if (kioskTimer) {
      clearInterval(kioskTimer);
      kioskTimer = null;
    }
  }

  function startKioskAutoRefresh() {
    stopKioskAutoRefresh();
    kioskTimer = setInterval(() => {
      if (window.DashboardApp) window.DashboardApp.load(true);
    }, KIOSK_REFRESH_MS);
  }

  async function requestBrowserFullscreen() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) {
      /* 部分浏览器需用户手势；失败时仍用页面内全屏布局 */
    }
  }

  async function exitBrowserFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (e) {
      /* ignore */
    }
  }

  function setKioskMode(on, opts) {
    const options = opts || {};
    kioskMode = !!on;
    document.body.classList.toggle('kiosk-mode', kioskMode);
    if (btnKiosk) btnKiosk.hidden = kioskMode;
    if (btnKioskExit) btnKioskExit.hidden = !kioskMode;

    if (kioskMode) {
      setView('dashboard', false);
      syncKioskUrl(true);
      startKioskAutoRefresh();
      if (options.browserFullscreen !== false) requestBrowserFullscreen();
      if (window.DashboardApp) {
        window.DashboardApp.load(true);
        if (typeof window.DashboardApp.onKioskChange === 'function') {
          window.DashboardApp.onKioskChange(true);
        }
      }
    } else {
      syncKioskUrl(false);
      stopKioskAutoRefresh();
      exitBrowserFullscreen();
      if (window.DashboardApp && typeof window.DashboardApp.onKioskChange === 'function') {
        window.DashboardApp.onKioskChange(false);
      }
    }
  }

  if (btnKiosk) {
    btnKiosk.addEventListener('click', () => setKioskMode(true));
  }
  if (btnKioskExit) {
    btnKioskExit.addEventListener('click', () => setKioskMode(false));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && kioskMode) setKioskMode(false);
  });
  document.addEventListener('fullscreenchange', () => {
    // 用户按系统 Esc 退出浏览器全屏时，同步退出看板展示模式
    if (!document.fullscreenElement && kioskMode) {
      setKioskMode(false, { browserFullscreen: false });
    }
  });

  refreshAuthUI();
  setView(currentView(), true);

  // 电视常用：同一链接加 ?kiosk=1 开机直进展示模式
  if (isKioskQuery()) {
    setKioskMode(true, { browserFullscreen: true });
  }

  // 从子任务等页面跳转回来时自动弹出登录
  const loginFlag = new URLSearchParams(window.location.search).get('login');
  if (loginFlag === '1' && !(window.Auth && window.Auth.isLoggedIn())) {
    openLogin();
  }
})();
