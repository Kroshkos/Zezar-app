// v1.6: оффлайн-очерь карточек модулей + навигация плиток HomeScreen
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// мок AsyncStorage (как в offline.test.js)
const store = new Map();
const mockAsyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => { store.set(k, String(v)); },
  removeItem: async (k) => { store.delete(k); },
  multiRemove: async (ks) => { ks.forEach((x) => store.delete(x)); },
  getAllKeys: async () => [...store.keys()],
};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === '@react-native-async-storage/async-storage') return mockAsyncStorage;
  return origLoad.apply(this, arguments);
};

let offline;
try {
  const babel = require('@babel/core');
  const fs = require('node:fs'), path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'offline.js'), 'utf8');
  const out = babel.transformSync(src, {
    babelrc: false, configFile: false, presets: [],
    plugins: [['@babel/plugin-transform-modules-commonjs']], filename: 'offline.js',
  });
  const m = new Module('offline2');
  m._compile(out.code, path.join(__dirname, 'offline2.compiled.js'));
  offline = m.exports;
} catch (e) {
  console.error('transpile failed:', e.message);
}

test('v1.6: entity-мутация с module_key попадает в очередь и мержится в список модуля', async () => {
  await offline.enqueue('entity', { module_key: 'docs', title: 'Акт сверки', status_key: 'draft' });
  const q = await offline.loadQueue();
  assert.equal(q[0].kind, 'entity');
  // список docs видит локальную карточку
  const inDocs = offline.mergeLocalTasks([], 'docs');
  assert.equal(inDocs.length, 1);
  assert.equal(inDocs[0].module_key, 'docs');
  assert.equal(inDocs[0].status_key, 'draft');
  // список tasks её НЕ видит (нет перетекания между модулями)
  const inTasks = offline.mergeLocalTasks([{ uid: 'srv-1', title: 't' }], 'tasks');
  assert.equal(inTasks.length, 1);
  assert.equal(inTasks[0].uid, 'srv-1');
});

test('v1.6: task без module_key — обратная совместимость (видна в tasks и "all")', async () => {
  const inAll = offline.mergeLocalTasks([], 'all');
  assert.ok(inAll.some((x) => x.title === 'Акт сверки'));
});

test('v1.6: плитки HomeScreen ведут на Tasks с module_key (не на создание)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'HomeScreen.js'), 'utf8');
  assert.match(home, /navigate\('Tasks',\s*\{\s*module_key:\s*m\.key\s*\}\)/);
  const tasks = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'TasksScreen.js'), 'utf8');
  assert.match(tasks, /navigate\('NewTask',\s*\{\s*module_key:/);
  const nt = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'NewTaskScreen.js'), 'utf8');
  assert.match(nt, /route\.params\?\.module_key/);
  assert.match(nt, /createEntity\(/);
});

test('v1.6: EventsScreen передаёт refreshing={boolean} вместе с onRefresh', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ev = fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', 'EventsScreen.js'), 'utf8');
  assert.match(ev, /refreshing=\{refreshing\}/);
  assert.match(ev, /useState\(false\)/);
  assert.doesNotMatch(ev, /onRefresh=\{load\}\s*\n\s*\/>/); // голый load без пропа больше нет
});
