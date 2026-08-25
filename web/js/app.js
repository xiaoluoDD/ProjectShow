(function () {
  applyAppVersionBadge();

  const viewSwitch = document.getElementById('viewSwitch');
  const optAccounts = document.getElementById('optAccounts');
  const optDepartments = document.getElementById('optDepartments');
  const optMembers = document.getElementById('optMembers');
  const optTools = document.getElementById('optTools');
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
  const departmentsView = document.getElementById('departmentsView');
  const membersView = document.getElementById('membersView');
  const toolsView = document.getElementById('toolsView');
  const loginModal = document.getElementById('loginModal');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const passwordModal = document.getElementById('passwordModal');
  const newPassword = document.getElementById('newPassword');
  const newPasswordConfirm = document.getElementById('newPasswordConfirm');
  const passwordError = document.getElementById('passwordError');
  const projectsHint = document.getElementById('projectsHint');

  const MANAGE_VIEWS = ['accounts', 'departments', 'members', 'tools'];

  function canChangeOwnPassword(user) {
    if (!user || !user.username) return false;
    if (user.is_super_admin || String(user.username).toLowerCase() === 'root') return false;
    return true;
  }

  function currentView() {
    const q = new URLSearchParams(window.location.search).get('view');
    if (
      q === 'projects' ||
      q === 'dashboard' ||
      q === 'accounts' ||
      q === 'departments' ||
      q === 'members' ||
      q === 'tools'
    ) {
      return q;
    }
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
    if (optDepartments) optDepartments.hidden = !canEdit;
    if (optMembers) optMembers.hidden = !canEdit;
    if (optTools) optTools.hidden = !canManage;

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

    const v = viewSwitch.value;
    if (v === 'accounts' && !canManage) setView('dashboard', true);
    else if ((v === 'departments' || v === 'members') && !canEdit) setView('dashboard', true);
    else if (v === 'tools' && !canManage) setView('dashboard', true);
  }

  function refreshAddProjectButton() {
    if (!btnAddProject) return;
    const canEdit = window.Auth && window.Auth.canEditProjects();
    const onProjects = viewSwitch.value === 'projects';
    btnAddProject.hidden = !(canEdit && onProjects);
  }

  function setView(view, pushUrl) {
    let next = view;
    const allowed = ['projects', 'dashboard', 'accounts', 'departments', 'members', 'tools'];
    if (allowed.indexOf(next) < 0) next = 'dashboard';

    const canManage = window.Auth && window.Auth.canManageAccounts();
    const canEdit = window.Auth && window.Auth.canEditProjects();
    if (next === 'accounts' && !canManage) next = 'dashboard';
    if ((next === 'departments' || next === 'members') && !canEdit) next = 'dashboard';
    if (next === 'tools' && !canManage) next = 'dashboard';

    viewSwitch.value = next;
    const isDash = next === 'dashboard';
    const isProjects = next === 'projects';
    const isAccounts = next === 'accounts';
    const isDepartments = next === 'departments';
    const isMembers = next === 'members';
    const isTools = next === 'tools';

    dashboardView.hidden = !isDash;
    projectsView.hidden = !isProjects;
    accountsView.hidden = !isAccounts;
    if (departmentsView) departmentsView.hidden = !isDepartments;
    if (membersView) membersView.hidden = !isMembers;
    if (toolsView) toolsView.hidden = !isTools;
    btnFilter.hidden = !isProjects;
    refreshAddProjectButton();

    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', next);
      history.replaceState(null, '', url);
    }

    if (isDash) {
      if (window.DashboardApp) window.DashboardApp.load(true);
      else {
        const bar = document.getElementById('dashSummaryBar');
        const root = document.getElementById('dashboardRoot');
        if (bar) bar.textContent = '看板脚本未加载';
        if (root) {
          root.innerHTML =
            '<div class="state-box error"><p>缺少 js/dashboard.js，请确认已同步最新 web 静态文件后强制刷新。</p></div>';
        }
      }
      scheduleIdleKiosk();
    } else {
      clearIdleKioskTimer();
      if (isProjects) {
        if (window.ProjectListApp) window.ProjectListApp.load(true);
      } else if (isAccounts) {
        if (window.AccountsApp) window.AccountsApp.load(true);
      } else if (isDepartments) {
        if (window.DepartmentsApp) window.DepartmentsApp.load(true);
      } else if (isMembers) {
        if (window.MembersApp) window.MembersApp.load(true);
      } else if (isTools) {
        if (window.AdminToolsApp) window.AdminToolsApp.load(true);
      }
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
    } else if (v === 'departments') {
      if (window.DepartmentsApp) window.DepartmentsApp.load(true);
      else setView('departments', false);
    } else if (v === 'members') {
      if (window.MembersApp) window.MembersApp.load(true);
      else setView('members', false);
    } else if (v === 'tools') {
      if (window.AdminToolsApp) window.AdminToolsApp.load(true);
      else setView('tools', false);
    }
  });

  btnLogin.addEventListener('click', openLogin);
  if (btnChangePassword) {
    btnChangePassword.addEventListener('click', openPasswordModal);
  }
  btnLogout.addEventListener('click', async () => {
    await window.Auth.logout();
    refreshAuthUI();
    const v = viewSwitch.value;
    if (v === 'accounts' || v === 'departments' || v === 'members' || v === 'tools') {
      setView('dashboard', true);
    }
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
  let autoRefreshTimer = null;
  let idleKioskTimer = null;
  let promoteFsHandler = null;
  const AUTO_REFRESH_MS = 60 * 1000;
  const IDLE_KIOSK_MS = 20 * 1000;

  function isKioskQuery() {
    const q = new URLSearchParams(window.location.search);
    return q.get('kiosk') === '1' || q.get('fullscreen') === '1';
  }

  function isDesktopLayout() {
    return window.matchMedia('(min-width: 960px)').matches;
  }

  function anyModalOpen() {
    return !!document.querySelector('.modal-mask:not([hidden])');
  }

  function clearIdleKioskTimer() {
    if (idleKioskTimer) {
      clearTimeout(idleKioskTimer);
      idleKioskTimer = null;
    }
  }

  function clearPromoteFullscreen() {
    if (!promoteFsHandler) return;
    document.removeEventListener('pointerdown', promoteFsHandler, true);
    document.removeEventListener('keydown', promoteFsHandler, true);
    promoteFsHandler = null;
  }

  function isBrowserFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /** 系统全屏必须在真实用户手势里调用；定时器触发会失败，需等下一次点击/按键补上 */
  function armPromoteBrowserFullscreen() {
    clearPromoteFullscreen();
    if (!kioskMode || isBrowserFullscreen()) return;
    promoteFsHandler = (e) => {
      if (!e || e.isTrusted === false) return;
      if (!kioskMode) {
        clearPromoteFullscreen();
        return;
      }
      if (isBrowserFullscreen()) {
        clearPromoteFullscreen();
        return;
      }
      clearPromoteFullscreen();
      requestBrowserFullscreen();
    };
    document.addEventListener('pointerdown', promoteFsHandler, true);
    document.addEventListener('keydown', promoteFsHandler, true);
  }

  function enterKioskLikeButton() {
    // 与手动点「全屏展示」同一条路径
    if (btnKiosk) {
      btnKiosk.click();
    } else {
      setKioskMode(true);
    }
    // 定时器触发的 click 浏览器不给系统全屏权限，下一轮真实操作时补上
    setTimeout(() => {
      if (kioskMode && !isBrowserFullscreen()) armPromoteBrowserFullscreen();
    }, 0);
  }

  function isOnDashboardView() {
    return !!(viewSwitch && viewSwitch.value === 'dashboard');
  }

  function scheduleIdleKiosk() {
    clearIdleKioskTimer();
    if (!isDesktopLayout()) return;
    // 仅总览看板才自动进全屏；其它界面不计时
    if (!isOnDashboardView()) return;
    idleKioskTimer = setTimeout(() => {
      idleKioskTimer = null;
      if (!isDesktopLayout() || !isOnDashboardView()) return;
      if (kioskMode || anyModalOpen()) {
        scheduleIdleKiosk();
        return;
      }
      enterKioskLikeButton();
    }, IDLE_KIOSK_MS);
  }

  function onUserActivityForIdleKiosk() {
    if (!isOnDashboardView()) {
      clearIdleKioskTimer();
      return;
    }
    scheduleIdleKiosk();
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

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function refreshDashboardSoft() {
    if (anyModalOpen()) return;
    if (!isOnDashboardView()) return;
    if (window.DashboardApp) window.DashboardApp.load(true);
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
      if (document.hidden) return;
      // 定时刷新只刷总览看板
      refreshDashboardSoft();
    }, AUTO_REFRESH_MS);
  }

  function requestBrowserFullscreen() {
    const el = document.documentElement;
    try {
      // 尽量同步发起，保留用户手势激活态
      if (el.requestFullscreen) {
        const p = el.requestFullscreen();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch (e) {
      /* 无用户手势时会失败；页面内 kiosk 布局仍可用 */
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
      if (options.browserFullscreen !== false) requestBrowserFullscreen();
      if (window.DashboardApp && typeof window.DashboardApp.onKioskChange === 'function') {
        window.DashboardApp.onKioskChange(true);
      }
    } else {
      clearPromoteFullscreen();
      syncKioskUrl(false);
      if (options.browserFullscreen !== false) exitBrowserFullscreen();
      if (window.DashboardApp && typeof window.DashboardApp.onKioskChange === 'function') {
        window.DashboardApp.onKioskChange(false);
      }
    }
    // 进入或退出全屏后都重新计时：退出后满 20 秒无操作会再进全屏
    scheduleIdleKiosk();
  }

  if (btnKiosk) {
    // 在点击回调最前面同步申请系统全屏（与用户手势同一调用栈）
    btnKiosk.addEventListener('click', () => {
      requestBrowserFullscreen();
      setKioskMode(true, { browserFullscreen: false });
    });
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

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'pointerdown', 'scroll'].forEach((evt) => {
    document.addEventListener(evt, onUserActivityForIdleKiosk, { passive: true });
  });
  window.addEventListener('resize', () => {
    if (isDesktopLayout() && isOnDashboardView()) scheduleIdleKiosk();
    else clearIdleKioskTimer();
  });

  refreshAuthUI();
  setView(currentView(), true);
  startAutoRefresh();

  // 电视常用：同一链接加 ?kiosk=1 开机直进展示模式
  if (isKioskQuery()) {
    setKioskMode(true, { browserFullscreen: true });
    setTimeout(() => {
      if (kioskMode && !isBrowserFullscreen()) armPromoteBrowserFullscreen();
    }, 0);
  } else {
    scheduleIdleKiosk();
  }

  // 每次打开网页只清空登录状态，不主动弹出登录框；需要时由用户点击「登录」。
  const loginFlag = new URLSearchParams(window.location.search).get('login');
  if (loginFlag === '1' && !(window.Auth && window.Auth.isLoggedIn())) {
    openLogin();
  }
})();
