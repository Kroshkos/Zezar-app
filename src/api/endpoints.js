// Тонкая обёртка над REST-эндпоинтами мобильного контура Zezar
import { api } from './client';

export const login = (login_, password) =>
  api('/api/auth/token-login', { method: 'POST', body: { login: login_, password }, auth: false });

export const logout = () => api('/api/auth/token-revoke', { method: 'POST' });

export const bootstrap = () => api('/api/mobile/bootstrap');

export const listEntities = (params = {}) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return api(`/api/mobile/entities${qs ? '?' + qs : ''}`);
};

export const createTask = (payload) =>
  api('/api/mobile/tasks', { method: 'POST', body: payload });

export const patchEntity = (uid, payload) =>
  api(`/api/mobile/entities/${encodeURIComponent(uid)}`, { method: 'PATCH', body: payload });
