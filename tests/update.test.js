// v1.6: unit-тесты семвер-сравнения и выбора обновления (чистые функции)
const test = require('node:test');
const assert = require('node:assert');

// Вырезаем чистые функции из модуля без React Native зависимостей
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/state/UpdateContext.js'), 'utf8');
// вырезаем только чистые функции до строки «const UpdateCtx» — без JSX/импортов
const pure = src.slice(0, src.indexOf('const UpdateCtx'));
const body = pure
  .replace(/^import[\s\S]*?;$/gm, '')
  .replace(/export const APP_VERSION[^\n]*/g, 'const APP_VERSION = "0.0.0";')
  .replace(/^export /gm, '');
const mod = new Function(`${body}\nreturn { parseVersion, cmpVersions, pickUpdate };`)();
const { cmpVersions, pickUpdate } = mod;

test('cmpVersions: базовый семвер', () => {
  assert.strictEqual(cmpVersions('1.0.1', '1.0.0'), 1);
  assert.strictEqual(cmpVersions('1.0.0', '1.0.1'), -1);
  assert.strictEqual(cmpVersions('2.0.0', '1.9.9'), 1);
  assert.strictEqual(cmpVersions('1.2.3', '1.2.3'), 0);
});

test('cmpVersions: пре-релизы', () => {
  assert.strictEqual(cmpVersions('0.1.0-alpha.2', '0.1.0-alpha.1'), 1);
  assert.strictEqual(cmpVersions('0.1.0-alpha.10', '0.1.0-alpha.9'), 1); // числовое сравнение
  assert.strictEqual(cmpVersions('0.1.0', '0.1.0-alpha.3'), 1);          // стабильная > альфы
  assert.strictEqual(cmpVersions('v0.1.0-alpha.3', '0.1.0-alpha.3'), 0); // ведущий v игнорируется
});

const rel = (tag, { pre = false, draft = false, apk = true } = {}) => ({
  tag_name: tag, prerelease: pre, draft,
  assets: apk ? [{ name: 'zezar-android.apk', browser_download_url: `https://dl/${tag}.apk` }] : [],
  html_url: `https://gh/releases/tag/${tag}`, body: '',
});

test('pickUpdate: находит новую альфу и ссылку на APK', () => {
  const u = pickUpdate([rel('v0.1.0-alpha.3', { pre: true }), rel('v0.1.0-alpha.2', { pre: true })], '0.1.0-alpha.2');
  assert.strictEqual(u.version, '0.1.0-alpha.3');
  assert.ok(u.url.endsWith('.apk'));
  assert.strictEqual(u.hasApk, true);
});

test('pickUpdate: нет апдейта, если текущая версия не меньше', () => {
  assert.strictEqual(pickUpdate([rel('v0.1.0-alpha.3', { pre: true })], '0.1.0-alpha.3'), null);
  assert.strictEqual(pickUpdate([rel('v0.1.0-alpha.3', { pre: true })], '0.1.0'), null); // стабильная новее альф
  assert.strictEqual(pickUpdate([], '0.1.0'), null);
});

test('pickUpdate: без APK отдаёт страницу релиза', () => {
  const u = pickUpdate([rel('v0.2.0', { apk: false })], '0.1.0');
  assert.strictEqual(u.url, 'https://gh/releases/tag/v0.2.0');
  assert.strictEqual(u.hasApk, false);
});

test('pickUpdate: предпочитает стабильные, игнорирует draft', () => {
  const u = pickUpdate(
    [rel('v1.0.0-beta', { pre: true }), rel('v0.9.9', { draft: true }), rel('v1.0.0')],
    '0.1.0');
  assert.strictEqual(u.version, '1.0.0');
});
