// v1.4: оффлайн-кэш и очередь мутаций.
// 1) Кэш ответов GET в AsyncStorage: при сетевой ошибке показываем последний
//    успешный снимок + баннер «нет сети».
// 2) Очередь мутаций (POST/PATCH): если сервер недоступен, намерение сохраняется
//    локально; фоновый диспатчер повторяет попытки после восстановления связи.
//    Для PATCH карточка обновляется локально сразу (optimistic), чтобы UI жил.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'zezar.cache.';
const QUEUE_KEY = 'zezar.mutations.v1';

let queue = [];            // сериализованное состояние очереди
let queueLoaded = false;
let saving = Promise.resolve(); // сериализация записи в AsyncStorage

async function persistQueue() {
  const snap = JSON.stringify(queue);
  saving = saving.then(() => AsyncStorage.setItem(QUEUE_KEY, snap)).catch(() => {});
  return saving;
}

export async function loadQueue() {
  if (queueLoaded) return queue;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch (_) { queue = []; }
  queueLoaded = true;
  return queue;
}

// ---------- кэш GET ----------
export async function cacheGet(key) {
  try { return await AsyncStorage.getItem(CACHE_PREFIX + key); } catch (_) { return null; }
}
export async function cacheSet(key, value) {
  try { await AsyncStorage.setItem(CACHE_PREFIX + key, value); } catch (_) {}
}

// Обёртка над endpoints с оффлайн-чтением: при сетевой ошибке (status 0 или
// отсутствие ответа) отдаём последний успешный снимок из кэша.
export async function cachedRead(fn, key) {
  try {
    const data = await fn();
    await cacheSet(key, JSON.stringify({ ts: Date.now(), data }));
    return { data, offline: false };
  } catch (e) {
    if (e.status === 401) throw e; // сессия истекла — оффлайн-кэш не спасает
    const raw = await cacheGet(key);
    if (raw) {
      try {
        const { data } = JSON.parse(raw);
        return { data, offline: true, error: e.message };
      } catch (_) { /* битый кэш — перебиваем исходную ошибку */ }
    }
    throw e;
  }
}

// Очистка кэша и очереди (при выходе из аккаунта), чтобы данные одного
// пользователя не «протекали» в сессию другого на том же устройстве.
export async function clearOfflineState() {
  queue = [];
  queueLoaded = true;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(CACHE_PREFIX) || k === QUEUE_KEY);
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch (_) {}
}

// ---------- очередь мутаций ----------
// kind: 'task' | 'patch'
//   task  — создание задачи (uid генерируется локально как временный id)
//   patch — изменение карточки uid
export async function enqueue(kind, payload, uid) {
  await loadQueue();
  const m = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind, payload, uid: uid || null, ts: Date.now(), attempts: 0, lastError: '',
  };
  queue.push(m);
  await persistQueue();
  return m;
}

export async function pendingCount() {
  return (await loadQueue()).length;
}

// Оптимистичное применение мутации к закэшированному списку карточек
// (ключ кэша TasksScreen: 'entities:<module>:<q>').
async function optimisticPatchToCache(uid, patch) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const listKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX + 'entities:'));
    for (const lk of listKeys) {
      const raw = await AsyncStorage.getItem(lk);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (!Array.isArray(obj.data)) continue;
      let touched = false;
      obj.data = obj.data.map((x) => {
        if (x.uid !== uid) return x;
        touched = true;
        return applyPatchToLocal(x, patch);
      });
      if (touched) await AsyncStorage.setItem(lk, JSON.stringify(obj));
    }
  } catch (_) { /* не критично */ }
}

function applyPatchToLocal(item, patch) {
  const next = { ...item };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.status_key !== undefined) next.status_key = patch.status_key;
  if (patch.priority_key !== undefined) next.priority_key = patch.priority_key;
  if ('due_date' in patch) next.due_date = patch.due_date;
  return next;
}

// Применяем ещё не отправленные создания задач к локальному снимку списка,
// чтобы новые задачи были видны и оффлайн.
export function mergeLocalTasks(items, moduleKey) {
  const localNew = queue
    .filter((m) => m.kind === 'task')
    .filter((m) => !moduleKey || moduleKey === 'tasks' || moduleKey === 'all')
    .map((m) => ({
      uid: m.id, local: true, kind: 'task', module_key: 'tasks',
      title: m.payload.title, description: m.payload.description || '',
      status_key: 'new', priority_key: m.payload.priority_key || 'medium',
      due_date: m.payload.due_date || null,
      responsibles: [], executors: [], tags: [], perm: 'owner', can_edit: true,
      created_at: new Date(m.ts).toISOString(),
    }));
  if (!localNew.length) return items;
  const known = new Set(queue.filter((m) => m.serverUid).map((m) => m.serverUid));
  const deduped = items.filter((x) => !known.has(x.uid));
  return [...localNew.reverse(), ...deduped];
}

// Диспатчер: последовательно повторяем отложенные мутации.
// sendTask / sendPatch — функции из endpoints.js.
export async function flushQueue({ sendTask, sendPatch, onEvent }) {
  await loadQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };
  let flushed = 0, failed = 0;
  const remaining = [];
  for (const m of queue) {
    try {
      if (m.kind === 'task') {
        const res = await sendTask(m.payload);
        if (res && res.uid) { m.serverUid = res.uid; onEvent && onEvent({ type: 'created', localId: m.id, uid: res.uid }); }
      } else if (m.kind === 'patch') {
        const res = await sendPatch(m.uid, m.payload);
        onEvent && onEvent({ type: 'patched', uid: m.uid, item: res });
      }
      flushed++;
    } catch (e) {
      if (e.status === 0) {           // сеть недоступна — пробуем позже
        m.attempts++; m.lastError = e.message;
        remaining.push(m); failed++;
      } else {                         // логическая ошибка (4xx) — не крутим вечно
        m.attempts++; m.lastError = e.message;
        if (m.attempts < 5) remaining.push(m);
        failed++;
      }
    }
  }
  queue = remaining;
  await persistQueue();
  return { flushed, failed };
}

// Слияние локальных патчей в закэшированную карточку (для EntityScreen оффлайн)
export async function localEntityOverlay(uid) {
  await loadQueue();
  const patches = queue.filter((m) => m.kind === 'patch' && m.uid === uid);
  return patches.length ? patches[patches.length - 1].payload : null;
}

export { optimisticPatchToCache };
