#!/usr/bin/env node
/**
Синхронизация версий перед сборкой.

Использование:
  node scripts/set-version.js            — версия берётся из package.json
  node scripts/set-version.js v0.1.0     — version в package.json и app.json = 0.1.0

Вызывается из GitHub Actions (workflow build.yml) перед `eas build`, чтобы номер
релиза из git tag попадал в саму сборку приложения.
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

let version = process.argv[2];
if (version) {
  version = version.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error(`Некорректный номер версии: ${version}`);
    process.exit(1);
  }
  const base = version.split('-')[0]; // prerelease -> numeric core for Android versionCode
  const [maj, min, pat] = base.split('.').map(Number);
  const versionCode = maj * 10000 + min * 100 + pat;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
  app.expo.version = version;
  app.expo.android.versionCode = versionCode;
  app.expo.ios.buildNumber = String(versionCode);
  fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');

  console.log(`Установлена версия ${version} (versionCode ${versionCode})`);
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  console.log(pkg.version);
}
