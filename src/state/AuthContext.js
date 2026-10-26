// Глобальное состояние: сессия (токен) + bootstrap-данные сервера
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServerUrl, getToken, setToken, setServerUrl, normalizeUrl } from '../api/client';
import * as api from '../api/endpoints';
import { clearOfflineState } from '../api/offline';

const KEY_MAIN_SESSION = 'zezar.mainSession.v15'; // { serverUrl, token } — основная сессия под гостевым доступом
const KEY_REMEMBERED = 'zezar.remembered.v1'; // { serverUrl, login, pass } — «Запомнить меня» на экране входа

// Хранилище запомненных учётных данных.
// ВНИМАНИЕ: AsyncStorage не шифруется (в Expo Go SecureStore недоступен), поэтому
// пароли лежат в открытом виде на устройстве — это осознанный компромисс для UX
// «автозаполнения»; включается только по явному чекбоксу пользователя и стирается
// при выходе из аккаунта без флага / при снятии флага.
export async function saveRemembered({ serverUrl, login, pass }) {
  try { await AsyncStorage.setItem(KEY_REMEMBERED, JSON.stringify({ serverUrl, login, pass })); } catch (_) {}
}
export async function loadRemembered() {
  try {
    const raw = await AsyncStorage.getItem(KEY_REMEMBERED);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
export async function clearRemembered() {
  try { await AsyncStorage.removeItem(KEY_REMEMBERED); } catch (_) {}
}

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [serverUrl, setServerUrlState] = useState('');
  const [token, setTokenState] = useState('');
  const [data, setData] = useState(null); // bootstrap: me/departments/modules/statuses/priorities
  const [error, setError] = useState('');
  const [guest, setGuest] = useState(false); // v1.5: временная сессия из QR-deep link

  const loadBootstrap = useCallback(async () => {
    try {
      const b = await api.bootstrap();
      setData(b);
      setError('');
      return true;
    } catch (e) {
      if (e.status === 401) { await setToken(''); setTokenState(''); }
      setError(e.message);
      return false;
    }
  }, []);

  // При старте: восстанавливаем сохранённую сессию (в т.ч. гостевую из QR)
  useEffect(() => {
    (async () => {
      const url = await getServerUrl();
      const tk = await getToken();
      setServerUrlState(url);
      setTokenState(tk);
      try {
        const saved = await AsyncStorage.getItem(KEY_MAIN_SESSION);
        if (saved && tk) setGuest(true); // приложение открылось по QR в фоне, рестарт и т.п.
      } catch (_) { /* ignore */ }
      if (url && tk) await loadBootstrap();
      setBooting(false);
    })();
  }, [loadBootstrap]);

  const login = useCallback(async (url, log, pass, remember = false) => {
    await setServerUrl(url.trim());
    setServerUrlState(await getServerUrl());
    const r = await api.login(log, pass);
    await setToken(r.access_token);
    setTokenState(r.access_token);
    // v1.5.2 «Запомнить меня»: сохраняем/стираем учётные данные после успешного входа
    if (remember) await saveRemembered({ serverUrl: url.trim(), login: log, pass });
    else await clearRemembered();
    return await loadBootstrap();
  }, [loadBootstrap]);

  // v1.5 QR-шлюз: обмен одноразового гостевого токена deep link на Bearer.
  // Основная сессия сохраняется и восстанавливается через exitGuest().
  const guestSession = useCallback(async (guestToken, baseUrl) => {
    const prevUrl = await getServerUrl();
    const prevTok = await getToken();
    if (prevUrl && prevTok) {
      await AsyncStorage.setItem(KEY_MAIN_SESSION, JSON.stringify({ serverUrl: prevUrl, token: prevTok }));
    } else {
      await AsyncStorage.removeItem(KEY_MAIN_SESSION); // вход «с нуля» — возвращаться некуда
    }
    // baseUrl из https-ссылки имеет приоритет только если он СОВПАДАЕТ с уже
    // настроенным сервером: QR может вести на тестовый/чужой стенд — уводить
    // туда пользователя с его прод-сессией нельзя. При расхождении остаёмся
    // на текущем сервере (гостевой токен всё равно обменяется, т.к. секреты
    // разные — в этом случае пользователь увидит понятную ошибку).
    if (baseUrl && prevUrl && normalizeUrl(baseUrl) === normalizeUrl(prevUrl)) {
      // тот же сервер — ничего не меняем
    } else if (baseUrl && !prevUrl) {
      await setServerUrl(baseUrl); setServerUrlState(await getServerUrl());
    }
    // Обмен гостевого токена ВСЕГДА идёт на сервер из ссылки QR: токен подписан
    // его SECRET_KEY и живёт только там. При расхождении с настроенным стендом
    // локально переключаемся на baseUrl (основная сессия уже сохранена в
    // KEY_MAIN_SESSION), а после выхода из гостя восстановим прежний адрес.
    const effBase = baseUrl || (await getServerUrl());
    if (baseUrl && prevUrl && normalizeUrl(baseUrl) !== normalizeUrl(prevUrl)) {
      await setServerUrl(baseUrl); setServerUrlState(await getServerUrl());
    }
    const r = await api.guestLogin(guestToken, effBase);
    await setToken(r.access_token);
    setTokenState(r.access_token);
    setGuest(true);
    return await loadBootstrap();
  }, [loadBootstrap]);

  // Выход из гостевого режима: отзывааем QR-токен на сервере и возвращаем основную сессию
  const exitGuest = useCallback(async () => {
    try { await api.logout(); } catch (_) { /* токен мог быть уже отозван */ }
    let main = null;
    try { main = JSON.parse((await AsyncStorage.getItem(KEY_MAIN_SESSION)) || 'null'); } catch (_) {}
    await AsyncStorage.removeItem(KEY_MAIN_SESSION);
    if (main && main.token) {
      // восстанавливаем и адрес сервера (гостевой скан QR мог переключить на другой стенд)
      if (main.serverUrl) await setServerUrl(main.serverUrl);
      await setToken(main.token);
      setServerUrlState(await getServerUrl());
      setTokenState(main.token);
      setGuest(false);
      await loadBootstrap();
      return true; // вернулись в основную сессию
    }
    // основной сессии нет — чистый выход
    await setToken('');
    setTokenState('');
    setData(null);
    setGuest(false);
    return false;
  }, [loadBootstrap]);

  const logout = useCallback(async ({ forgetMe } = {}) => {
    // деактивируем push-подписку этого устройства (лучше effort)
    try {
      const Notifications = require('expo-notifications');
      const Device = require('expo-device');
      if (Device.isDevice) {
        const t = await Notifications.getExpoPushTokenAsync();
        const expo_token = t.data || String(t);
        await api.pushUnregister(expo_token);
      }
    } catch (_) { /* подписки мог не быть */ }
    try { await api.logout(); } catch (_) { /* токен мог быть уже отозван */ }
    await setToken('');
    setTokenState('');
    setData(null);
    setGuest(false);
    await AsyncStorage.removeItem(KEY_MAIN_SESSION); // гостевую сессию тоже выбрасываем
    // v1.5.2: «Забыть меня» при выходе — стираем сохранённые учётные данные;
    // без флага выходим «как есть», чтобы экран входа остался автозаполненным.
    if (forgetMe) await clearRemembered();
    // v1.4: очищаем оффлайн-кэш и очередь мутаций этого пользователя,
    // чтобы данные не «протекали» в сессию другого на том же устройстве.
    await clearOfflineState();
  }, []);

  const value = useMemo(() => ({
    booting, serverUrl, token, data, error, guest,
    isAuthed: Boolean(token && data),
    login, logout, refresh: loadBootstrap, guestSession, exitGuest,
  }), [booting, serverUrl, token, data, error, guest, login, logout, loadBootstrap, guestSession, exitGuest]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
