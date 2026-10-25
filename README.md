# Zezar-app — мобильный клиент системы «ЦЕЗАРЬ»

React Native (Expo) приложение к сервису [Zezar](https://github.com/Kroshkos/Zezar):
задачи и карточки модулей подразделения с телефона.

## Возможности
- **Вход** по логину/паролю учётной записи Цезаря + адрес сервера (`POST /api/auth/token-login`),
  токен хранится в AsyncStorage, сессия восстанавливается автоматически.
- **Главная**: профиль, сводка по задачам (в работе / мои / просрочено), пространства и модули
  (`GET /api/mobile/bootstrap`).
- **Задачи**: список карточек всех модулей, поиск, фильтр по модулям, pull-to-refresh
  (`GET /api/mobile/entities`).
- **Создание задачи** (`POST /api/mobile/tasks`) и **редактирование** статуса/приоритета/срока/
  описания прямо из карточки (`PATCH /api/mobile/entities/{uid}`), включая быстрый экшен
  «Отметить выполненной». Права на редактирование приходят с сервера (`can_edit`).
- **Профиль**: сведения о сервере, выходе из аккаунта с отзывом токена (`POST /api/auth/token-revoke`).

## Запуск
```bash
npm install
npx expo start        # отсканируйте QR-код через Expo Go
```
В поле «Адрес сервера» укажите публичный URL вашего Zezar (например `https://zezar.example.com`).

## Структура
```
src/
  api/        client.js (fetch + Bearer), endpoints.js (REST мобильного контура)
  state/      AuthContext.js (сессия + bootstrap)
  screens/    Login, Home, Tasks, NewTask, Entity, Profile
  components/ ui.js, EntityCard.js
  theme/ utils/
```

## Соответствие API
Мобильные эндпоинты реализованы в бэкенде: `app/mobile.py` (роутер `/api/mobile/*`) и
`app/routers/token_auth.py` (`/api/auth/token-*`). Авторизация — `Authorization: Bearer <токен>`;
поддерживается и штатными веб-API (`/api/tasks/api-list`, `/api/core/*`) благодаря гибридной
авторизации в `app/core/security.py`. Смоук-тест: `scripts/smoke_mobile_api.py`.
