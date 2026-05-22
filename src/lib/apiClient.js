import { auth } from './firebase.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// InstitutionContext 在 institution 改變時呼叫此函式，讓 apiClient 持有最新值
let _currentInstitution = null;
export function setApiInstitution(code) {
  _currentInstitution = code;
}

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

function buildUrl(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  if (_currentInstitution) {
    url.searchParams.set('institution', _currentInstitution);
  }
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function request(method, path, { params, body } = {}) {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.error;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export const apiGet = (path, params) => request('GET', path, { params });
export const apiPost = (path, body, params) => request('POST', path, { body, params });
export const apiPut = (path, body, params) => request('PUT', path, { body, params });
export const apiDelete = (path, params) => request('DELETE', path, { params });
