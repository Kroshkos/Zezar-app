// Глобальное состояние: сессия (токен) + bootstrap-данные сервера
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { getServerUrl, getToken, setToken, setServerUrl } from '../api/client';
import * as api from '../api/endpoints';
import { clearOfflineState } from '../api/offline';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [serverUrl, setServerUrlState] = useState('');
  const [token, setTokenState] = useState('');
  const [data, setData] = useState(null); // bootstrap: me/departments/modules/statuses/priorities
  const [error, setError] = useState('');

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

  // При старте: восстанавливаем сохранённую сессию
  useEffect(() => {
    (async () => {
      const url = await getServerUrl();
      const tk = await getToken();
      setServerUrlState(url);
      setTokenState(tk);
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
    // v1.4: очищаем оффлайн-кэш и очередь мутаций этого пользователя,
    // чтобы данные не «протекали» в сессию другого на том же устройстве.
    await clearOfflineState();
  }, []);

  const value = useMemo(() => ({
    booting, serverUrl, token, data, error,
    isAuthed: Boolean(token && data),
    login, logout, refresh: loadBootstrap,
  }), [booting, serverUrl, token, data, error, login, logout, loadBootstrap]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
