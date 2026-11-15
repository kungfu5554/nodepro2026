// public/js/api.js

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export async function fetchAPI(url, options = {}) {
  const token = localStorage.getItem('token') || '';
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch('/api' + url, {
    credentials: 'same-origin',
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && url !== '/auth/login' && typeof unauthorizedHandler === 'function') {
      // Only auto-logout when token is rejected as invalid/expired
      if (res.status === 401 || (data.message && data.message.includes('Invalid or expired token'))) {
        unauthorizedHandler();
      }
    }
    throw new Error(data.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
  }
  return data;
}
