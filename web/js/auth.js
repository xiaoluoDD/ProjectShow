(function () {
  const KEYS = window.AUTH_KEYS || {
    token: 'projectshow_auth_token',
    user: 'projectshow_auth_user',
    session: 'projectshow_session_active',
  };
  const TOKEN_KEY = KEYS.token;
  const USER_KEY = KEYS.user;
  const SESSION_FLAG_KEY = KEYS.session;
  const AUTH_STORAGE_KEYS = [TOKEN_KEY, USER_KEY];

  let currentUser = null;

  function readStoredToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function readStoredUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function persist(token, user) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  // 预览版 / 正式版分别使用独立 key（见 config.js 的 AUTH_KEYS），这里只清
  // 当前环境自己的登录态，不会影响另一个环境。
  function clearStoredAuth() {
    try {
      AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      /* ignore */
    }
  }

  // 是否本次浏览器标签页第一次打开本站：新开标签页 / 关闭重开都算“重新打开网
  // 页”，要求重新登录；但同一次打开内从首页跳到项目详情、子任务页（本站是多
  // 页面应用，每次跳转都会整页刷新）属于同一次使用，不应把刚登录的状态清掉，
  // 否则会出现“标记完结时莫名被要求重新登录，登录后一点子任务又被登出”的问题。
  function isFreshBrowserSession() {
    try {
      if (sessionStorage.getItem(SESSION_FLAG_KEY)) return false;
      sessionStorage.setItem(SESSION_FLAG_KEY, '1');
      return true;
    } catch (e) {
      // sessionStorage 不可用时，保守起见不清登录态，避免影响正常使用
      return false;
    }
  }

  function setAuthHeaders(headers) {
    const token = readStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!(currentUser && currentUser.username);
  }

  function canEditProjects() {
    return !!(currentUser && currentUser.can_edit_projects);
  }

  function canManageAccounts() {
    return !!(currentUser && currentUser.can_manage_accounts);
  }

  function notifyChanged() {
    document.dispatchEvent(new CustomEvent('authchange', { detail: { user: currentUser } }));
  }

  async function refreshMe() {
    const token = readStoredToken();
    if (!token) {
      currentUser = null;
      persist('', null);
      notifyChanged();
      return null;
    }
    try {
      const data = await apiGet('/api/auth/me');
      currentUser = data.user || null;
      persist(token, currentUser);
      notifyChanged();
      return currentUser;
    } catch (e) {
      const msg = String((e && e.message) || '');
      // 仅在明确未授权时清登录态；网络抖动/临时错误保留 token，避免误退登
      const unauthorized =
        msg.indexOf('401') >= 0 ||
        msg.indexOf('未登录') >= 0 ||
        msg.indexOf('失效') >= 0 ||
        msg.indexOf('登录已失效') >= 0;
      if (unauthorized) {
        currentUser = null;
        persist('', null);
        notifyChanged();
        return null;
      }
      // 保留本地缓存用户，便于页面继续显示已登录
      if (!currentUser) currentUser = readStoredUser();
      notifyChanged();
      return currentUser;
    }
  }

  async function login(username, password) {
    const data = await apiPost('/api/auth/login', { username, password });
    currentUser = data.user || null;
    persist(data.token || '', currentUser);
    notifyChanged();
    return currentUser;
  }

  async function logout() {
    try {
      await apiPost('/api/auth/logout', {});
    } catch (e) {
      /* ignore */
    }
    currentUser = null;
    persist('', null);
    notifyChanged();
  }

  // 每次真正“打开网页”（新开标签页 / 重新访问）才清空登录凭据，避免复用陈旧
  // 登录状态；同一次打开内的页面跳转保留登录态。
  if (isFreshBrowserSession()) {
    clearStoredAuth();
    currentUser = null;
  } else {
    currentUser = readStoredUser();
  }

  window.Auth = {
    getUser,
    isLoggedIn,
    canEditProjects,
    canManageAccounts,
    login,
    logout,
    refreshMe,
    setAuthHeaders,
    getToken: readStoredToken,
  };

  if (readStoredToken()) {
    refreshMe();
  } else {
    notifyChanged();
  }
})();
