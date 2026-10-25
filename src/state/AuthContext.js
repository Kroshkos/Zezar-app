// Глобальное состояние: сессия (токен) + bootstrap-данные сервера
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServerUrl, getToken, setToken, setServerUrl } from '../api/client';
import * as api from '../api/endpoints';
import { clearOfflineState } from '../api/offline';

const KEY_MAIN_SESSION = 'zezar.mainSession.v15'; // { serverUrl, token } — основная сессия под гостевым доступом

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

  const login = useCallback(async (url, log, pass) => {
    await setServerUrl(url.trim());
    setServerUrlState(await getServerUrl());
    const r = await api.login(log, pass);
    await setToken(r.access_token);
    setTokenState(r.access_token);
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
    if (baseUrl) { await setServerUrl(baseUrl); setServerUrlState(await getServerUrl()); }
    const r = await api.guestLogin(guestToken);
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
      await setServerUrl(main.serverUrl);
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

  const logout = useCallback(async () => {
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
