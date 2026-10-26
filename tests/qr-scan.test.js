// v1.7: парсер отсканированного QR (тот же, что и для deep link)
const test = require('node:test');
const assert = require('node:assert');
const babel = require('@babel/core');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');

const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'react') return { createContext: () => ({}), useContext: () => null, useEffect: () => {}, useRef: () => ({ current: null }), useState: () => [null, () => {}] };
  if (request === 'react-native') return { Linking: { getInitialURL: async () => null, addEventListener() {}, removeEventListener() {} } };
  if (request === 'expo-notifications') return { addNotificationResponseReceivedListener: () => ({}), removeNotificationSubscription: () => {} };
  if (request === '../state/AuthContext' || request.startsWith('./')) return { useAuth: () => ({ isAuthed: true, token: 'x', guestSession: async () => {} }) };
  return origLoad.apply(this, arguments);
};

const src = fs.readFileSync(path.join('/workspace', 'src', 'state', 'LinkingContext.js'), 'utf8');
const out = babel.transformSync(src, { babelrc: false, configFile: false, presets: [], plugins: [['@babel/plugin-transform-modules-commonjs']], filename: 'LinkingContext.js' });
const m = new Module('lc'); m.paths = Module._nodeModulePaths('/workspace/src/state');
m._compile(out.code, '/tmp/lc.compiled.js');
const { extractEntityTarget } = m.exports;

test('QR zezar://entity/{uid}', () => {
  const t = extractEntityTarget('zezar://entity/abc123');
  assert.equal(t.uid, 'abc123');
});
test('QR с гостевым токеном', () => {
  const t = extractEntityTarget('https://open.zezar.app/open/e/uid-9?t=gst.tok.en');
  assert.equal(t.uid, 'uid-9'); assert.equal(t.t, 'gst.tok.en');
  assert.equal(t.baseUrl, 'https://open.zezar.app');
});
test('не-carточка → null', () => {
  assert.equal(extractEntityTarget('https://example.com/other'), null);
  assert.equal(extractEntityTarget('привет'), null);
});
