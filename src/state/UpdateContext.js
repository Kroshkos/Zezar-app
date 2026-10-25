// v1.6: автопроверка обновлений приложения при запуске.
//
// Источник истины — GitHub Releases репозитория Kroshkos/Zezar-app (CI публикует
// туда APK на каждый тег vX). Сравниваем семверы: установленный из
// expo-constants (app.json/version, прошивается CI перед сборкой) с latest release.
// Если есть новый релиз — предлагаем скачать и установить APK (Android).
//
// Особенности:
// - проверка один раз за запуск + не чаще раза в сутки (флаг AsyncStorage),
//   чтобы не долбить GitHub API (лимит 60 req/hour на IP без токена);
// - ошибки сети/лимитов игнорируются молча — обновление никогда не мешает входу;
// - в Expo Go показываем мягкую подсказку (там APK не ставится).
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REPO = 'Kroshkos/Zezar-app';
const KEY_LAST_CHECK = 'zezar.update.lastCheck.v1';
const CHECK_INTERVAL_MS = 24 * 3600 * 1000; // раз в сутки

export const APP_VERSION = Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version || '0.0.0';

// Парсер «1.2.3-alpha.4» -> [1,2,3, pre==null?Infinity:0, 'alpha', 4] для честного сравнения пре-релизов
export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(v || ''));
  if (!m) return [0, 0, 0, 0, '', 0];
  const pre = m[4];
  const [p0 = '', p1 = ''] = String(pre || '').split('.');
  return [
    +m[1], +m[2], +m[3],
    pre ? 0 : 1,                       // стабильная > любой альфы той же версии
    p0, /^\d+$/.test(p1) ? +p1 : p1,
  ];
}

export function cmpVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (typeof x === 'string' || typeof y === 'string') {
      const sx = String(x), sy = String(y);
      if (sx !== sy) return sx < sy ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

// Чистая функция выбора апдейта — покрыта unit-тестом
export function pickUpdate(releases, currentVersion) {
  const stable = releases.filter((r) => !r.draft && !r.prerelease);
  const all = releases.filter((r) => !r.draft);
  const pool = stable.length ? stable : all; // пока нет стабильных — катим альфы
  const latest = pool[0];
  if (!latest) return null;
  if (cmpVersions(latest.tag_name, currentVersion) <= 0) return null;
  const apk = (latest.assets || []).find((a) => /\.apk$/i.test(a.name)) || null;
  return {
    version: String(latest.tag_name).replace(/^v/, ''),
    url: apk ? apk.browser_download_url : latest.html_url,
    notes: latest.body || '',
    hasApk: !!apk,
  };
}

const UpdateCtx = createContext(null);
export const useUpdate = () => useContext(UpdateCtx);

export function UpdateProvider({ children }) {
  const [update, setUpdate] = useState(null);
  const [checked, setChecked] = useState(false);

  const checkNow = useCallback(async ({ force = false } = {}) => {
    try {
      if (!force) {
        const last = +(await AsyncStorage.getItem(KEY_LAST_CHECK)) || 0;
        if (Date.now() - last < CHECK_INTERVAL_MS) { setChecked(true); return null; }
      }
      await AsyncStorage.setItem(KEY_LAST_CHECK, String(Date.now()));
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) { setChecked(true); return null; } // лимит/сеть — тихо пропускаем
      const rel = pickUpdate(await res.json(), APP_VERSION);
      setChecked(true);
      if (rel) setUpdate(rel);
      return rel;
    } catch (_) {
      setChecked(true);
      return null;
    }
  }, []);

  const promptInstall = useCallback(() => {
    if (!update) return;
    const go = () => Linking.openURL(update.url).catch(() => {});
    if (Platform.OS === 'android' && Device.isDevice) {
      Alert.alert(
        'Доступно обновление Цезаря',
        `Версия ${update.version} (у вас ${APP_VERSION}). Скачать и установить APK?`,
        [
          { text: 'Не сейчас', style: 'cancel' },
          { text: 'Скачать', onPress: go },
        ],
      );
    } else {
      // iOS / Expo Go: установку выполняем через страницу релиза
      Alert.alert(
        'Доступно обновление Цезаря',
        `Вышла версия ${update.version} (у вас ${APP_VERSION}). Открыть страницу загрузки?`,
        [
          { text: 'Не сейчас', style: 'cancel' },
          { text: 'Открыть', onPress: go },
        ],
      );
    }
  }, [update]);

  useEffect(() => { checkNow(); }, [checkNow]);

  return <UpdateCtx.Provider value={{ update, checked, currentVersion: APP_VERSION, checkNow, promptInstall, dismiss: () => setUpdate(null) }}>{children}</UpdateCtx.Provider>;
}
