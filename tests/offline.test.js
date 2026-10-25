// Unit-тесты оффлайн-модуля v1.4 (node --test, без внешних зависимостей).
// AsyncStorage мокается in-memory через require.cache.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// --- мок @react-native-async-storage/async-storage ---
const store = new Map();
const mockAsyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => { store.set(k, String(v)); },
  removeItem: async (k) => { store.delete(k); },
  multiRemove: async (ks) => { ks.forEach((k) => store.delete(k)); },
  getAllKeys: async () => [...store.keys()],
};
const origResolve = Module._resolveFilename;
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return mockAsyncStorage;
  return origLoad.apply(this, arguments);
};

// offline.js использует ESM-синтаксис? Нет — он CommonJS-совместимый? Проверим: там export/ import.
// Поэтому компилируем его вручную в CJS простой подменой (файл небольшой и предсказуемый).
const fs = require('node:fs');
const path = require('node:path');
const babel = (() => { try { return require('@babel/core'); } catch (_) { return null; } })();

let offline;
if (babel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'offline.js'), 'utf8');
  const out = babel.transformSync(src, {
    // babelOptions: false — не подхватывать babel.config.js проекта (в нём expo-презет)
    babelrc: false, configFile: false,
    presets: [], plugins: [['@babel/plugin-transform-modules-commonjs']], filename: 'offline.js',
  });
  const m = new Module('offline');
  m._compile(out.code, path.join(__dirname, 'offline.compiled.js'));
  offline = m.exports;
} else {
  // fallback: примитивная транспиляция ESM->CJS для этого конкретного файла
  let src = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'offline.js'), 'utf8');
  src = src.replace(/import\s+AsyncStorage\s+from\s+'[^']+';/, "const AsyncStorage = require('@react-native-async-storage/async-storage');");
  src = src.replace(/export\s+async\s+function/g, 'async function');
  src = src.replace(/export\s+function/g, 'function');
  src = src.replace(/export\s+\{[^}]*\};?/g, '');
  const names = [...src.matchAll(/^(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
  src += '\nmodule.exports = {' + names.map((n) => `${n}`).join(',') + '};';
  const m = new Module('offline');
  m._compile(src, path.join(__dirname, 'offline.transpiled.js'));
  offline = m.exports;
}

test('enqueue/loadQueue/persist — очередь сериализуется в хранилище', async () => {
  const q0 = await offline.loadQueue();
  assert.deepEqual(q0, []);
  await offline.enqueue('task', { title: 'T1' });
  await offline.enqueue('patch', { status_key: 'done' }, 'uid-1');
  const raw = JSON.parse(store.get('zezar.mutations.v1'));
  assert.equal(raw.length, 2);
  assert.equal(raw[0].kind, 'task');
  assert.equal(raw[1].uid, 'uid-1');
});

test('mergeLocalTasks — локальные задачи видны в списке, дубли serverUid отсекаются', async () => {
  const merged = offline.mergeLocalTasks([{ uid: 'srv-9', title: 'server' }], 'tasks');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].local, true);
  assert.equal(merged[0].title, 'T1');
});

test('flushQueue — успешные уходят, сетевые (status 0) остаются, 4xx ретраится до 5 раз', async () => {
  const events = [];
  const sendTask = async () => ({ uid: 'srv-9' });
  const sendPatch = async () => { const e = new Error('net down'); e.status = 0; throw e; };
  const r = await offline.flushQueue({ sendTask, sendPatch, onEvent: (ev) => events.push(ev) });
  assert.equal(r.flushed, 1);
  assert.equal(r.failed, 1);
  const q = await offline.loadQueue();
  assert.equal(q.length, 1);            // patch остался
  assert.equal(q[0].attempts, 1);
  assert.equal(events[0].type, 'created');
  assert.equal(events[0].uid, 'srv-9');
  assert.ok(events[0].localId, 'localId временной задачи присутствует');
});

test('flushQueue — 4xx после 5 попыток выбрасывается из очереди', async () => {
  await offline.clearOfflineState();
  const m = await offline.enqueue('patch', { title: 'x' }, 'uid-404');
  const bad = async () => { const e = new Error('not found'); e.status = 404; throw e; };
  for (let i = 1; i <= 5; i++) {
    const r = await offline.flushQueue({ sendTask: bad, sendPatch: bad });
    const q = await offline.loadQueue();
    if (i < 5) { assert.equal(q.length, 1, `attempt ${i}: остаётся`); assert.equal(q[0].attempts, i); }
    else assert.equal(q.length, 0, 'после 5 попыток выброшен');
  }
});

test('cachedRead — при сетевой ошибке отдаёт снимок из кэша с offline=true', async () => {
  const key = 'entities:tasks:';
  const ok = async () => [{ uid: 'a', title: 'A' }];
  const first = await offline.cachedRead(ok, key);
  assert.equal(first.offline, false);
  const fail = async () => { const e = new Error('no network'); e.status = 0; throw e; };
  const second = await offline.cachedRead(fail, key);
  assert.equal(second.offline, true);
  assert.deepEqual(second.data, [{ uid: 'a', title: 'A' }]);
});

test('cachedRead — 401 пробрасывается (кэш не спасает истёкшую сессию)', async () => {
  const unauthorized = async () => { const e = new Error('expired'); e.status = 401; throw e; };
  await assert.rejects(() => offline.cachedRead(unauthorized, 'entities:tasks:'), (e) => e.status === 401);
});

test('clearOfflineState — чистит и кэш, и очередь', async () => {
  await offline.clearOfflineState();
  const keys = await mockAsyncStorage.getAllKeys();
  assert.deepEqual(keys.filter((k) => k.startsWith('zezar.')), []);
  assert.deepEqual(await offline.loadQueue(), []);
});
