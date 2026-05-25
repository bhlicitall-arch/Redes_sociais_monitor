/**
 * API client — Midia Monitor
 */

const BASE = import.meta.env.DEV ? '/api' : '/api';

function getToken(): string | null {
  return localStorage.getItem('mm_token');
}

function setToken(token: string) {
  localStorage.setItem('mm_token', token);
}

function clearToken() {
  localStorage.removeItem('mm_token');
}

function headers(authed = false): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authed) {
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
  }
  return h;
}

export const api = {
  isLoggedIn: () => !!getToken(),

  getToken,
  setToken,
  clearToken,

  async get(path: string) {
    const res = await fetch(BASE + path, { headers: headers(true) });
    if (res.status === 401) { clearToken(); window.location.href = '/login'; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisicao');
    return data;
  },

  async post(path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: headers(true),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { clearToken(); window.location.href = '/login'; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisicao');
    return data;
  },
};
