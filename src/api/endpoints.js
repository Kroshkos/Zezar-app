// Тонкая обёртка над REST-эндпоинтами мобильного контура Zezar
import { api, getServerUrl } from './client';

// baseUrl — опциональный явный адрес сервера (deep link из QR может прийти
// с другого хоста, чем сохранённый; по умолчанию — текущий настроенный)
async function resolveBase(baseUrl) {
  return (baseUrl || await getServerUrl());
}

export const login = async (login_, password, baseUrl) =>
  api('/api/auth/token-login', { method: 'POST', body: { login: login_, password }, auth: false, baseUrl: await resolveBase(baseUrl) });

export const logout = () => api('/api/auth/token-revoke', { method: 'POST' });

// QR-шлюз v1.5: обмен одноразового гостевого токена из deep link
// zezar://entity/{uid}?t=<token> на обычный Bearer access_token
export const guestLogin = async (token, baseUrl) =>
  api('/api/mobile/guest-login', { method: 'POST', body: { token }, auth: false, baseUrl: await resolveBase(baseUrl) });

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

// v1.6: создание карточки в ЛЮБОМ модуле (module_key обязателен)
export const createEntity = (payload) =>
  api('/api/mobile/entities', { method: 'POST', body: payload });

export const patchEntity = (uid, payload) =>
  api(`/api/mobile/entities/${encodeURIComponent(uid)}`, { method: 'PATCH', body: payload });

// Одна карточка по uid (быстрый запрос вместо скачивания всего списка)
export const getEntity = (uid) =>
  api(`/api/mobile/entities/${encodeURIComponent(uid)}`);

// Карточка по uid с явным токеном — используется сразу после обмена
// гостевого QR-токена, когда сохранённый Bearer ещё не обновлён
export const getEntityWithToken = (uid, tokenOverride) =>
  api(`/api/mobile/entities/${encodeURIComponent(uid)}`, { tokenOverride });

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
