// 后端 API 根地址。
// 推荐：Nginx :8080 同域反代时留空 ''，页面会请求 /api/projects 等。
// 访问地址示例：http://8.134.255.174:8080/mobile/index.html
// 若 H5 与 API 不同端口且无 Nginx，改为完整地址，例如 'http://8.134.255.174:8081'
// （不同源时浏览器可能因 CORS 拦截，需 Nginx 同域或后端加 CORS。）
window.APP_CONFIG = {
  apiBase: '',
  appVersion: 'v1.2.21',
};

// 登录态存储 key：预览版（URL 含 /mobile-preview/）与正式版分别使用带 _preview
// 后缀的独立 key，两边登录状态完全隔离——测试预览版不会把正式版顶下线，
// 正式版登录也不会被预览版操作影响。auth.js / api.js 及各页面的兜底权限读取
// 都统一从这里取 key，避免各处硬编码导致预览/正式不一致。
(function () {
  var isPreview = !!(window.location && window.location.pathname.indexOf('/mobile-preview/') >= 0);
  var suffix = isPreview ? '_preview' : '';
  window.AUTH_KEYS = {
    isPreviewMode: isPreview,
    token: 'projectshow_auth_token' + suffix,
    user: 'projectshow_auth_user' + suffix,
    session: 'projectshow_session_active' + suffix,
  };
})();
