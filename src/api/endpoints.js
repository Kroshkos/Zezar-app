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

// Одна карточка по uid (быстрый запрос вместо скачивания всего списка)
export const getEntity = (uid) =>
  api(`/api/mobile/entities/${encodeURIComponent(uid)}`);

// ---------- Push-подписки (Expo) ----------
export const pushRegister = (expo_token, platform, device_label) =>
  api('/api/mobile/push/register', { method: 'POST', body: { expo_token, platform, device_label } });

export const pushUnregister = (expo_token) =>
  api('/api/mobile/push/unregister', { method: 'POST', body: { expo_token } });

// ---------- Лента событий ----------
// wait — сек. long-poll на сервере (0..25). Ставим увеличенный таймаут клиента.
export const listEvents = ({ since_id = 0, wait = 0, limit = 50 } = {}) =>
  api(`/api/mobile/events?since_id=${since_id}&wait=${wait}&limit=${limit}`,
      { timeoutMs: wait > 0 ? (wait + 15) * 1000 : undefined });

export const markEventsRead = ({ ids = [], all = false } = {}) =>
  api('/api/mobile/events/read', { method: 'POST', body: { ids, all } });
