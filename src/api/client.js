// HTTP-клиент Zezar-app: базовый URL + Bearer-токен хранятся в AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_URL = 'zezar.serverUrl';
const KEY_TOKEN = 'zezar.token';

export async function getServerUrl() {
  return (await AsyncStorage.getItem(KEY_URL)) || '';
}
export async function setServerUrl(url) {
  await AsyncStorage.setItem(KEY_URL, normalizeUrl(url));
}
export async function getToken() {
  return (await AsyncStorage.getItem(KEY_TOKEN)) || '';
}
export async function setToken(token) {
  if (token) await AsyncStorage.setItem(KEY_TOKEN, token);
  else await AsyncStorage.removeItem(KEY_TOKEN);
}
export async function clearSession() {
  await AsyncStorage.removeItem(KEY_TOKEN);
}

export function normalizeUrl(url) {
  let u = (url || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, auth = true, timeoutMs } = {}) {
  const base = await getServerUrl();
  if (!base) throw new ApiError(0, 'Сервер не настроен');
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  // таймаут (для long-poll запросов ленты событий)
  let signal, timer;
  if (timeoutMs) {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
    signal = ctrl.signal;
  }
  let resp;
  try {
    resp = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ApiError(0, e && e.name === 'AbortError'
      ? 'Превышено время ожидания ответа'
      : 'Сеть недоступна. Проверьте адрес сервера и соединение');
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (resp.status === 401 && auth) {
    throw new ApiError(401, 'Сессия недействительна — войдите заново');
  }
  let data = null;
  try { data = await resp.json(); } catch (_) { /* пустое тело */ }
  if (!resp.ok) {
    const detail = (data && (data.detail || data.message)) || `Ошибка ${resp.status}`;
    throw new ApiError(resp.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}
