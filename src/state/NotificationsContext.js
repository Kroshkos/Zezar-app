// Push-уведомления (Expo) + лента событий сервера.
// - при входе запрашиваем разрешение и регистрируем Expo Push Token на сервере;
// - фоново крутим long-poll GET /api/mobile/events — это и «живой» счётчик
//   непрочитанных на вкладке, и обновление списков, and in-app баннер;
// - expo-notifications работает и в Expo Go (там push идёт через тестовый
//   проект Expo), и в dev/production сборках.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import * as api from '../api/endpoints';

const KEY_LAST_ID = 'zezar.lastEventId';

// in-app показ: даже когда приложение открыто
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const NotifCtx = createContext(null);
export const useNotifications = () => useContext(NotifCtx);

export function NotificationsProvider({ children }) {
  const { isAuthed, token } = useAuth();
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState([]); // последние события для экрана «События»
  const [pushState, setPushState] = useState({ status: 'idle', expoToken: null }); // idle|granted|denied|unsupported
  const pollAbort = useRef(false);
  const sinceIdRef = useRef(0);

  // ---------- регистрация Expo Push Token ----------
  const registerPush = useCallback(async () => {
    if (!Device.isDevice) { setPushState({ status: 'unsupported' }); return; }
    try {
      const cur = await Notifications.getPermissionsAsync();
      let status = cur.status;
      if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted') { setPushState({ status: 'denied' }); return; }

      // projectId берём из app.json (extra.eas.projectId); в Expo Go без него
      // токен всё равно выдаётся через оверлей Expo
      let projectId;
      try { projectId = globalThis?.ExpoManifest?.extra?.eas?.projectId; } catch (_) {}
      if (!projectId) { try { projectId = require('../../app.json').expo.extra?.eas?.projectId; } catch (_) {} }

      const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      const expo_token = t.data || String(t);
      await api.pushRegister(expo_token, Platform.OS === 'ios' ? 'ios' : 'android',
                             Device.modelName || undefined);
      setPushState({ status: 'granted', expo_token });
    } catch (e) {
      console.warn('push register failed:', e?.message || e);
      setPushState({ status: 'error' });
    }
  }, []);

  // ---------- старт/остановка потока событий ----------
  const stopPolling = useCallback(() => { pollAbort.current = true; }, []);

  const startPolling = useCallback(async () => {
    pollAbort.current = false;
    sinceIdRef.current = Number((await AsyncStorage.getItem(KEY_LAST_ID)) || 0);
    while (!pollAbort.current) {
      try {
        const r = await api.listEvents({ since_id: sinceIdRef.current, wait: 20, limit: 50 });
        if (pollAbort.current) break;
        setUnread(r.unread ?? 0);
        if (r.events && r.events.length) {
          // сервер отдаёт новые сверху; храним в хронологическом порядке
          setLatest((prev) => [...r.events.slice().reverse(), ...prev].slice(0, 100));
          sinceIdRef.current = Math.max(sinceIdRef.current, r.last_id || 0);
          await AsyncStorage.setItem(KEY_LAST_ID, String(sinceIdRef.current));
        }
      } catch (e) {
        if (e.status === 401) break; // сессия истекла — AuthContext сам разлогинит
        await new Promise((res) => setTimeout(res, 15000)); // сеть/ошибка — пауза
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthed) {
      registerPush();
      startPolling();
    } else {
      stopPolling();
      setUnread(0);
      setLatest([]);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, token]);

  // тап по push-уведомлению → открываем карточку (навигация подписана в App.js)
  const lastResponseSub = useRef(null);
  useEffect(() => {
    lastResponseSub.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const uid = resp?.notification?.request?.content?.data?.entity_uid;
      if (uid) {
        globalThis.__zezarDeepLink && globalThis.__zezarDeepLink(uid);
      }
    });
    return () => lastResponseSub.current &&
      Notifications.removeNotificationSubscription(lastResponseSub.current);
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.markEventsRead({ all: true });
      setUnread(0);
      setLatest((prev) => prev.map((e) => ({ ...e, read_at: new Date().toISOString() })));
    } catch (_) { /* ignore */ }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const r = await api.listEvents({ since_id: 0, wait: 0, limit: 50 });
      setUnread(r.unread ?? 0);
      setLatest((r.events || []).slice().reverse());
      sinceIdRef.current = Math.max(sinceIdRef.current, r.last_id || 0);
      await AsyncStorage.setItem(KEY_LAST_ID, String(sinceIdRef.current));
    } catch (_) { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    unread, latest, pushState, markAllRead, refreshList, registerPush,
  }), [unread, latest, pushState, markAllRead, refreshList, registerPush]);

  return <NotifCtx.Provider value={value}>{children}</NotifCtx.Provider>;
}
