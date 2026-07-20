// 后端 API 根地址�?
// 推荐：Nginx :8080 同域反代时留�?''，页面会请求 /api/projects 等�?
// 访问地址示例：http://8.134.255.174:8080/mobile/index.html
// �?H5 �?API 不同端口且无 Nginx，改为完整地址，例�?'http://8.134.255.174:8081'
// （不同源时浏览器可能�?CORS 拦截，需 Nginx 同域或后端加 CORS。）
window.APP_CONFIG = {
  apiBase: '',
  appVersion: 'v1.1.6',
};
