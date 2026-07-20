(function () {
  applyAppVersionBadge();

  const viewSwitch = document.getElementById('viewSwitch');
  const btnFilter = document.getElementById('btnFilter');
  const btnRefresh = document.getElementById('btnRefresh');
  const dashboardView = document.getElementById('dashboardView');
  const projectsView = document.getElementById('projectsView');

  function currentView() {
    const q = new URLSearchParams(window.location.search).get('view');
    if (q === 'projects' || q === 'dashboard') return q;
    return 'dashboard';
  }

  function setView(view, pushUrl) {
    const next = view === 'projects' ? 'projects' : 'dashboard';
    viewSwitch.value = next;
    const isDash = next === 'dashboard';
    dashboardView.hidden = !isDash;
    projectsView.hidden = isDash;
    btnFilter.hidden = isDash;

    if (pushUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', next);
      history.replaceState(null, '', url);
    }

    if (isDash) {
      if (window.DashboardApp) {
        window.DashboardApp.load();
      } else {
        const bar = document.getElementById('dashSummaryBar');
        const root = document.getElementById('dashboardRoot');
        if (bar) bar.textContent = '看板脚本未加载';
        if (root) {
          root.innerHTML =
            '<div class="state-box error"><p>缺少 js/dashboard.js，请确认已同步最新 web 静态文件后强制刷新。</p></div>';
        }
      }
    } else if (window.ProjectListApp) {
      window.ProjectListApp.load();
    } else {
      const bar = document.getElementById('summaryBar');
      const root = document.getElementById('listRoot');
      if (bar) bar.textContent = '列表脚本未加载';
      if (root) {
        root.innerHTML =
          '<div class="state-box error"><p>缺少 js/list.js，请确认已同步最新 web 静态文件后强制刷新。</p></div>';
      }
    }
  }

  viewSwitch.addEventListener('change', () => setView(viewSwitch.value, true));

  btnRefresh.addEventListener('click', () => {
    if (viewSwitch.value === 'dashboard') {
      if (window.DashboardApp) window.DashboardApp.load(true);
      else setView('dashboard', false);
    } else if (window.ProjectListApp) {
      window.ProjectListApp.load(true);
    } else {
      setView('projects', false);
    }
  });

  setView(currentView(), true);
})();
