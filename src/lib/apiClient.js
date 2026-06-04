import { auth } from './firebase.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// ── 快取層：GET 去重 + 寫入後全清 ──────────────────────────────────────────
// cache: key → resolved data（命中直接回傳，不再打 API）
// inflight: key → Promise（同一請求進行中時，第二個呼叫共用同一 Promise）
const cache = new Map();
const inflight = new Map();

export function invalidateCache() {
  cache.clear();
  inflight.clear();
}
// ────────────────────────────────────────────────────────────────────────────

// InstitutionContext 在 institution 改變時呼叫此函式，讓 apiClient 持有最新值
let _currentInstitution = null;
export function setApiInstitution(code) {
  _currentInstitution = code;
  invalidateCache(); // 切機構時清快取，避免看到其他機構的資料
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

async function fetchOnce(method, path, params, body) {
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

  if (res.status === 204) return null;
  return res.json();
}

async function request(method, path, { params, body } = {}) {
  if (method !== 'GET') {
    const result = await fetchOnce(method, path, params, body);
    invalidateCache(); // 任何寫入後清快取，保證下次讀到最新
    return result;
  }

  const key = buildUrl(path, params);

  if (cache.has(key)) return cache.get(key);

  if (inflight.has(key)) return inflight.get(key);

  const promise = fetchOnce(method, path, params, body).then((data) => {
    cache.set(key, data);
    inflight.delete(key);
    return data;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

export const apiGet = (path, params) => request('GET', path, { params });
export const apiPost = (path, body, params) => request('POST', path, { body, params });
export const apiPut = (path, body, params) => request('PUT', path, { body, params });
export const apiDelete = (path, params) => request('DELETE', path, { params });
