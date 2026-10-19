# durio-for-web — интерфейс dur.io для Windows

**English summary.** The user interface of the **dur.io** Windows client (Solid.js). It is not a browser client:
it is built in desktop mode and packaged inside [durio-for-desktop](https://github.com/DakarXYZ/durio-for-desktop),
which serves it locally. The fork adds end-to-end encryption (beta) of DMs and groups, accounts on several servers,
an administration page with a 2FA admin mode and invite links, 100 MB uploads, 1080p60 screen sharing, packaged
emoji, and removes the original project's trackers and remote services. Licensed under AGPL-3.0.

Интерфейс мессенджера **dur.io** (Solid.js, Vite, TypeScript). Браузерного веб-клиента для пользователей **нет**:
эта сборка работает только внутри Windows-клиента [durio-for-desktop](https://github.com/DakarXYZ/durio-for-desktop),
который отдаёт её локально с `app://durio/`. Автор и владелец форка — DakarX
([GitHub DakarXYZ](https://github.com/DakarXYZ)).

Основано на [stoatchat/for-web](https://github.com/stoatchat/for-web). dur.io — независимый форк и не связан с
проектом Stoat; название и логотип Stoat — товарные знаки их владельцев. Внутренние имена (`stoat.js`,
`@revolt/*`, `/.well-known/stoat`) оставлены как в оригинале: это совместимость, а не бренд.

## Что добавляет форк

- **Сквозное шифрование (бета)** личных сообщений и групп: отправка, правка, вложения с миниатюрами; «Устройства
  и шифрование (бета)» — свои устройства, сверка по эмодзи, блокировка устройства, бэкап ключей с ключом
  восстановления (и его выключение), файлы ключей, отчёт диагностики; мастер «ключи потеряны»; настройка «скрывать
  текст зашифрованных сообщений в уведомлениях». Крипто-ядро — [durio-crypt](https://github.com/DakarXYZ/durio-crypt)
  (wasm в Web Worker, одно на аккаунт).
- **Несколько серверов и аккаунтов**: сервера по умолчанию нет — первый экран спрашивает адрес и находит API через
  `https://<адрес>/.well-known/stoat`; аккаунты на разных серверах (маршруты `/i/<host>/…`), токены, хранилища и
  ключи шифрования — отдельно для каждой пары «сервер + пользователь».
- **Администрирование** (Настройки → «Администрирование», только для админов сервера): режим администратора
  включается кодом приложения-аутентификатора (нужна 2FA в аккаунте) и действует около часа; найти пользователя
  (id или `имя#1234`) и завершить один или все его сеансы; ссылки-приглашения на 1, 4, 12 или 24 часа,
  одноразовые или многоразовые, список и отзыв.
- **Регистрация по приглашению**: поле принимает код или ссылку `https://<сервер>/join/<код>` и предупреждает,
  если ссылка для другого сервера или это приглашение в сообщество, а не на регистрацию.
- **Лимиты**: вложения — по лимиту сервера (на наших — 100 МБ), зашифрованные — не больше 100 МБ; демонстрация
  экрана в 1080p 60 fps (Настройки → «Голос» → «Качество демонстрации»).
- **Без внешних сервисов оригинала**: эмодзи упакованы в сборку (не грузятся со статики оригинала), нет Sentry,
  загрузки чейнджлога, определения региона и GIF-пикера (пока сервер не назовёт свой gifbox), ссылок на поддержку
  оригинала; бренд — заглушки dur.io.
- **Режим сборки для десктопа** (`vite build --mode desktop`): без PWA и service worker, CSP, без удалённого кода,
  мост `window.native` (ниже); счётчик непрочитанного на кнопке панели задач, окно поднимается кликом по
  уведомлению.

## Подготовка

Нужны Git, Node 22+ и pnpm (`corepack enable`, версия — из `packageManager`). [mise](https://mise.jdx.dev) удобен
(`.mise/config.toml` ставит тулчейн, задачи — в `.mise/tasks/`), но не обязателен: ниже рядом с задачей mise — то
же через pnpm.

Рядом с этим репозиторием нужен клон [durio-crypt](https://github.com/DakarXYZ/durio-crypt) в папке
`../stoat-crypto`: крипто-ядро `@durio/stoat-crypto` не публикуется в npm, клиент при разработке берёт собранный
там архив (`packages/client/package.json` →
`file:../../../stoat-crypto/bindings/web/build/durio-stoat-crypto-<версия>.tgz`):

```bash
# в ../stoat-crypto
scripts/build-wasm.sh build   # → bindings/web/build/durio-stoat-crypto-<версия>.tgz (+ .sha256)
```

В CI и релизах вместо него — архив из GitHub Release durio-crypt, целостность в lockfile сверяется с его `.sha256`.

```bash
git clone --recursive https://github.com/DakarXYZ/durio-for-web for-web
cd for-web
git submodule update --init packages/stoat.js packages/solid-livekit-components

mise assets:fallback      # = git submodule deinit -f packages/client/assets
mise install:frozen       # = pnpm install --frozen-lockfile
mise build:deps           # = pnpm --filter @durio/stoat-api build
                          #   pnpm --filter stoat.js build
                          #   pnpm --filter solid-livekit-components build
                          #   pnpm --filter client exec lingui compile --typescript
```

Приватные ассеты бренда оригинала (`packages/client/assets`) не используются: после `assets:fallback` клиент берёт
заглушки dur.io из `packages/client/scripts/assets_fallback` (`pnpm --filter client exec node
scripts/copyAssets.mjs`, это делают задачи `dev` и `build:*`).

## Разработка

```bash
cp packages/client/.env.example packages/client/.env
mise dev                  # = pnpm --filter client exec node scripts/copyAssets.mjs
                          #   pnpm --filter client exec vite --host
```

Dev-сервер — http://localhost:5173. В `.env` по умолчанию — локальный бэкенд (`VITE_API_URL=http://localhost:14702`,
см. durio-chat); без `VITE_API_URL`/`VITE_HOST` сервера по умолчанию нет и клиент начинает с экрана адреса.
`vite dev` без моста десктопа использует для хранилища ключей небезопасный ключ разработки в `localStorage`;
остальные сборки без моста показывают шифрование недоступным.

Проверки:

```bash
mise build:check          # = pnpm --filter client exec tsc --noEmit
mise lint                 # = pnpm exec eslint --ext .ts,.tsx packages/client
mise format               # = pnpm exec prettier --check 'packages/client/**/*.{ts,tsx,json}'
mise test:unit            # = pnpm --filter stoat.js test && pnpm --filter client run test:unit
mise lingui               # извлечь и скомпилировать строки (lingui extract / lingui compile)
```

`test:unit` включает настоящее wasm-ядро через SDK между двумя аккаунтами. Строки интерфейса — Lingui,
английский и русский каталоги поддерживаются нами (`packages/client/components/i18n/catalogs`).

### SDK и сабмодули

Сабмодули — наши форки (`.gitmodules`): `packages/stoat.js` →
[durio-javascript-client-sdk](https://github.com/DakarXYZ/durio-javascript-client-sdk),
`packages/solid-livekit-components` →
[durio-javascript-solid-livekit-components](https://github.com/DakarXYZ/durio-javascript-solid-livekit-components).

Копия SDK одна — сабмодуль `packages/stoat.js`. Правка SDK — всегда два коммита:

```bash
# 1. в сабмодуле, на ветке с тем же именем, что у for-web (durio/<этап>)
cd packages/stoat.js
git switch durio/stage-6            # или создать: git switch -c durio/stage-6
pnpm --filter stoat.js typecheck && pnpm --filter stoat.js build
git commit -am "..."

# 2. передвинуть сабмодуль в for-web
cd ../..
git add packages/stoat.js
git commit -m "..."
```

Коммит SDK должен попасть в форк (`origin` сабмодуля) не позже коммита for-web, который на него указывает, иначе
свежий `git submodule update --init` его не найдёт.

Типы API — пакет `packages/stoat-api` (`@durio/stoat-api`), сгенерированный из OpenAPI нашего бэкенда; SDK
импортирует его под старым именем `stoat-api` через алиас pnpm. Перегенерация:
`pnpm --filter @durio/stoat-api generate && pnpm --filter @durio/stoat-api build`, обновление спецификации — в
`packages/stoat-api/README.md`.

E2EE в SDK — `packages/stoat.js/src/e2ee/` (интерфейс `E2eeProvider`, исполнитель запросов, очередь расшифровки,
outbox); в клиенте — `packages/client/components/client/e2ee/`.

## Сборка для десктопа

Единственная сборка, которую мы выпускаем. Перед ней нужны `build:deps` (в том числе `lingui compile` — без
скомпилированных каталогов сборка не проходит):

```bash
mise build:desktop
# без mise, из корня for-web:
pnpm --filter client exec node scripts/copyAssets.mjs
pnpm --filter client exec lingui compile --typescript
node packages/client/desktop/fetch-rnnoise.mjs
NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter client exec vite build --mode desktop
node packages/client/desktop/check-build.mjs packages/client/dist-desktop
```

Результат — `packages/client/dist-desktop/`; durio-for-desktop копирует его к себе (`scripts/sync-web.mjs`) и
закрепляет коммит for-web в `for-web.lock.json`. Сборки `mise build` / `build:prod` и `Dockerfile` остались от
оригинала (веб-сервер), мы их не используем.

Режим десктопа (`packages/client/desktop/plugin.ts`):

- нет PWA, service worker и push worker (Web Push в Electron нет); нет Sentry — сборка с заданным
  `VITE_SENTRY_DSN` падает, CI проверяет, что переменная пуста; нет source maps;
- base `/`, а не `./`: обработчик протокола отвечает на глубокие маршруты (`/i/<host>/channel/…`) `index.html`,
  и относительные адреса ассетов там сломались бы;
- сервера по умолчанию нет: первым идёт экран адреса; мост может подсказать адрес;
- worklet RNNoise скачивается при сборке с закреплённым SHA-256 (`desktop/rnnoise.mjs`, не коммитится) и отдаётся
  из `/rnnoise/` — приложение не загружает удалённый код;
- `check-build.mjs` проверяет, что в сборке есть набор эмодзи и нет обращений к хостам оригинала;
- Content Security Policy из `desktop/csp.mjs` — как `<meta>` в `index.html` и (на стороне Electron) как заголовок
  `Content-Security-Policy` в `protocol.handle` (туда же `frame-ancestors 'none'`, в meta его нельзя):
  `script-src 'self' 'wasm-unsafe-eval'` (крипто-ядро, RNNoise), `worker-src 'self'`, `connect-src 'self' https:
  wss: blob: data:` (серверы добавляются во время работы и находятся по введённому адресу, списка хостов быть не
  может; `http:`/`ws:` — только с `desktopCsp({ dev: true })` для локального бэкенда), `img-src`/`media-src` с
  `https:` и `blob:` (расшифрованные вложения), `style-src 'unsafe-inline'` (Solid, KaTeX, Shiki), без inline-скриптов
  (сборка на них падает).

**Bridge contract for the Electron side** (`window.native`, preload with `contextBridge`; every IPC handler checks
`event.senderFrame.url` starts with `app://durio/`). Existing upstream members stay as they are: `versions.{node,
chrome,electron,desktop}()`, `minimise()`, `maximise()`, `close()`, `onceScreenPicker(cb)`,
`screenPickerCallback(idx, audio)`, `isWayland?()`, and `window.desktopConfig.{get,set,getAutostart,setAutostart}`
(`settings/user/Native.tsx`). dur.io adds (typed in `components/common/lib/desktop.ts`, all optional for the
page):

| Member | Contract |
| --- | --- |
| `e2eeStoreKey(accountKey): Promise<{key, created} \| Uint8Array>` | IPC `secrets:get`: 32 random bytes per accountKey (`[A-Za-z0-9_-]{1,128}`), created on first use, kept as `safeStorage.encryptString(base64)` in `userData/keys/<accountKey>.bin`. `created: true` when this call made it — with an existing crypto store that means the old key is lost (the page shows the "keys lost" wizard). The page passes the bytes straight to the crypto worker and keeps no copy |
| `e2eeDeleteStoreKey(accountKey): Promise<void>` | IPC `secrets:delete`: on sign-out (WEB-12); no error when missing |
| `focus(): void` | IPC `focus`: show, restore and focus the window (a click on a notification while the app sits in the tray) |
| `setBadgeCount(count): void` | IPC `setBadgeCount`: overlay of the taskbar button — unread mentions plus one per DM or group with unread messages, `-1` a dot for other unread messages, `0` none; muted channels do not count |
| `servers.default(): string \| undefined` | Optional prefill of the server address screen from the build of the desktop app (`electron-store`), empty by default (O13) |

Without the bridge (a plain browser) encryption is unavailable, except `vite dev`, which uses an insecure
development key in `localStorage`.

Ошибки и предложения — [issues](https://github.com/DakarXYZ/durio-for-web/issues).

## Лицензия

[GNU Affero General Public License v3.0](LICENSE), как у оригинала. Copyright © DakarX для изменений dur.io;
исходный код оригинала — его авторов.
