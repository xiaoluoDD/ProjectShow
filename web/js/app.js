(function () {
  applyAppVersionBadge();

  const viewSwitch = document.getElementById('viewSwitch');
  const optAccounts = document.getElementById('optAccounts');
  const btnFilter = document.getElementById('btnFilter');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const authUserBar = document.getElementById('authUserBar');
  const dashboardView = document.getElementById('dashboardView');
  const projectsView = document.getElementById('projectsView');
  const accountsView = document.getElementById('accountsView');
  const loginModal = document.getElementById('loginModal');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const projectsHint = document.getElementById('projectsHint');

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
        ? '已登录，可在桌面端增改项目 · 网页端当前以查看为主'
        : '未登录仅可查看 · 下拉页面可刷新';
    }

    if (!canManage && viewSwitch.value === 'accounts') {
      setView('dashboard', true);
    }
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
  btnLogout.addEventListener('click', async () => {
    await window.Auth.logout();
    refreshAuthUI();
    if (viewSwitch.value === 'accounts') setView('dashboard', true);
  });
  document.getElementById('btnLoginCancel').addEventListener('click', closeLogin);
  document.getElementById('btnLoginSubmit').addEventListener('click', submitLogin);
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitLogin();
  });
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLogin();
  });

  document.addEventListener('authchange', () => {
    refreshAuthUI();
  });

  refreshAuthUI();
  setView(currentView(), true);

  // 从子任务等页面跳转回来时自动弹出登录
  const loginFlag = new URLSearchParams(window.location.search).get('login');
  if (loginFlag === '1' && !(window.Auth && window.Auth.isLoggedIn())) {
    openLogin();
  }
})();
