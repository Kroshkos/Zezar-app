// v1.5 QR-шлюз: обработка deep link zezar://entity/{uid}[?t=<гостевой токен>]
// и https://…/open/e/{uid} (если ссылку открыли через «Поделиться» в приложении).
//
// - с гостевым токеном: меняем сессию на временную guest (основная сохраняется
//   внутри AuthContext.guestSession) и открываем карточку;
// - без токена (тап по push-уведомлению, обычная ссылка): просто навигируем
//   на карточку в текущей сессии.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';

const LinkCtx = createContext(null);
export const useDeepLink = () => useContext(LinkCtx);

// Универсальный разбор без зависимости от поведения new URL() на кастомных
// схемах: сначала вырезаем query/fragment регуляркой, потом ищем путь.
export function parseEntityUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const hashless = url.split('#')[0];
  const qIdx = hashless.indexOf('?');
  const path = qIdx >= 0 ? hashless.slice(0, qIdx) : hashless;
  const query = qIdx >= 0 ? hashless.slice(qIdx + 1) : '';
  const m = path.match(/(?:^|:\/\/|\/)(?:open\/)?(?:entity|e)\/([A-Za-z0-9_-]{1,64})(?:\/$|$)/);
  if (!m) return null;
  let t;
  const tm = /(?:^|&)t=([^&]+)/.exec(query);
  if (tm) { try { t = decodeURIComponent(tm[1]); } catch (_) { t = tm[1]; } }
  return { uid: m[1], t };
}

// Разбор любых форматов ссылок шлюза: zezar://entity/…, …/open/e/…, …/e/…
export function extractEntityTarget(url) {
  if (!url || typeof url !== 'string') return null;
  // zezar:// может прийти и как zezar:/entity/… (нормализуем двойной слэш)
  const normalized = url.replace(/^(\w+):\/+/, '$1://');
  let target = parseEntityUrl(normalized);
  if (!target) return null;
  // baseUrl для обмена гостевого токена — хост из https-варианта ссылки
  let baseUrl;
  try {
    const u = new URL(normalized);
    if (/^https?:$/.test(u.protocol)) baseUrl = `${u.protocol}//${u.host}`;
  } catch (_) {}
  return { ...target, baseUrl };
}

export function LinkingProvider({ children }) {
  const { isAuthed, token, guestSession } = useAuth();
  const [linkError, setLinkError] = useState('');
  const queueRef = useRef([]); // ссылки, пришедшие до готовности сессии
  const handledRef = useRef(new Set()); // защита от двойной обработки same-link

  const openTarget = async ({ uid, t, baseUrl }) => {
    const key = `${uid}|${t || ''}`;
    if (handledRef.current.has(key)) return;
    handledRef.current.add(key);
    setTimeout(() => handledRef.current.delete(key), 3000);
    if (t) {
      // гостевой QR-токен: меняем сессию и открываем карточку
      try {
        await guestSession(t, baseUrl);
      } catch (e) {
        setLinkError(e.message || 'Ссылка устарела — отсканируйте QR заново');
        return;
      }
    }
    queueRef.current.push(uid);
    dispatchQueue();
  };

  const dispatchQueue = () => {
    while (queueRef.current.length && globalThis.__zezarDeepLink) {
      const uid = queueRef.current.shift();
      globalThis.__zezarDeepLink(uid);
    }
  };

  // стартовая ссылка (холодный запуск приложения из сканера)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const target = extractEntityTarget(url);
      if (target) openTarget(target);
    }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      const target = extractEntityTarget(url);
      if (target) openTarget(target);
    });
    return () => Linking.removeEventListener('url', sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // тап по push-уведомлению → карточка в текущей сессии
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const uid = resp?.notification?.request?.content?.data?.entity_uid;
      if (uid) openTarget({ uid });
    });
    return () => Notifications.removeNotificationSubscription(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // когда есть активная сессия — выгружаем накопленные переходы
  useEffect(() => {
    if (isAuthed || token) dispatchQueue();
  }, [isAuthed, token]);

  // v1.7: встроенный QR-сканер передаёт сюда отсканированный текст.
  // Разбираем его тем же парсером, что и deep link, и открываем сущность
  // (гостевой токен ?t=… поддерживается автоматически).
  const handleScannedCode = (text) => {
    const target = extractEntityTarget(text);
    if (!target) {
      setLinkError('Это не QR-код карточки Цезаря');
      return false;
    }
    openTarget(target);
    return true;
  };

  return <LinkCtx.Provider value={{ linkError, clearLinkError: () => setLinkError(''), handleScannedCode }}>{children}</LinkCtx.Provider>;
}
