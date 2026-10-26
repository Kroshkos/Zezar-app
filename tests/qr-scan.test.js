// v1.7: встроенный QR-сканер — отсканированный текст разбирается тем же
// парсером, что и deep link (extractEntityTarget из LinkingContext).
// Парсер вырезается из модуля по маркерам функций и исполняется в vm-песочнице —
// без Babel/browserslist, чтобы тест был независим от рантайм-зависимостей RN.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'state', 'LinkingContext.js'), 'utf8');
function sliceFn(name) {
  const start = src.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, `функция ${name} не найдена в LinkingContext.js`);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1).replace(/^export /, '');
}
const code = `${sliceFn('parseEntityUrl')}\n${sliceFn('extractEntityTarget')}\nglobalThis.__ex = extractEntityTarget;`;
const ctx = vm.createContext({ URL, globalThis: {} });
vm.runInContext(code, ctx);
const extractEntityTarget = ctx.globalThis.__ex;

test('QR zezar://entity/{uid}', () => {
  const t = extractEntityTarget('zezar://entity/abc123');
  assert.equal(t.uid, 'abc123');
});
test('битый двойной слэш zezar:/entity (Android-сканеры)', () => {
  const t = extractEntityTarget('zezar:/entity/uid-7');
  assert.equal(t.uid, 'uid-7');
});
test('QR с гостевым токеном (https open/e на боевом домене)', () => {
  const t = extractEntityTarget('https://zezar-patfiz.waw0.amvera.tech/open/e/uid-9?t=gst.tok.en');
  assert.equal(t.uid, 'uid-9'); assert.equal(t.t, 'gst.tok.en');
  assert.equal(t.baseUrl, 'https://zezar-patfiz.waw0.amvera.tech');
});
test('токен с percent-encoding раскодуется', () => {
  const t = extractEntityTarget('https://s.example/open/e/u1?t=a%2Fb%2Bc');
  assert.equal(t.t, 'a/b+c');
});
test('короткий алиас QR /o/{uid} (компактный код для печати)', () => {
  const t = extractEntityTarget('https://zezar-patfiz.waw0.amvera.tech/o/a1b2c3d4e5f6?t=1.2.3.abc');
  assert.equal(t.uid, 'a1b2c3d4e5f6'); assert.equal(t.t, '1.2.3.abc');
  assert.equal(t.baseUrl, 'https://zezar-patfiz.waw0.amvera.tech');
});
test('не-carточка → null', () => {
  assert.equal(extractEntityTarget('https://example.com/other'), null);
  assert.equal(extractEntityTarget('привет мир'), null);
  assert.equal(extractEntityTarget(null), null);
});
