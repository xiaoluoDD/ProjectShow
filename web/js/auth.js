(function () {
  const TOKEN_KEY = 'projectshow_auth_token';
  const USER_KEY = 'projectshow_auth_user';

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

  // 先挂载 Auth，再异步校验；避免首请求拿不到 Authorization
  currentUser = readStoredUser();
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
