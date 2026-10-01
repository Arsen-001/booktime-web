# Починка b02 — «Наши решения: видимость, правила мастера, подтверждение, отмена и перенос, места работы и выезд» (fix2)

Раздел: online. Чиню 4 дефекта, найденных измерителем в `qa/measure/online/b02-m1.md` (2 major + 2 minor),
плюс уже известный major из `qa/measure/online/state-s1.md`, который упал на файле, который я трогаю в этой пачке.

## MAJOR — F-03-077: запись создавалась без подтверждения телефона кодом

**Было:** `onSubmit` в `BookingWizard.tsx` проверял только `name`/`phone`/`consent`; `phoneVerified` не входил
в условие отправки ни на клиенте, ни на сервере (`createOnlineBooking`, `src/api/online.ts`).

**Починил:**
- Клиент (`src/areas/online/booking/BookingWizard.tsx`): в `onSubmit` добавлена проверка `state.phoneVerified` —
  если номер не подтверждён, форма не отправляется, под блоком кода показывается текст ошибки (новый ключ
  `booking.details.codeRequired`), рамка блока красная, и тост с той же фразой.
- Сервер (`src/api/online.ts`, `createOnlineBooking`): добавлена проверка `if (!input.phoneVerified) throw new
  ApiError('phone_not_verified', …)` — запись не создаётся даже при обходе клиентской проверки.
- Клиент обрабатывает код ошибки `phone_not_verified` тостом.
- Обновил тексты (ru/en/hy): `phoneVerified`/`verifyPhoneHint` теперь не привязаны только к пуш-напоминаниям
  (раньше звучали так, будто код нужен только ради пушей — F-03-078), плюс новый `codeRequired`.

**Проверено действием** (переигран `qa/scenarios/online/booking-submit-no-code.json` — теперь блокирует,
скриншот `after-submit.png` в `qa/shots/online-b02-fix2/scn10-recheck/`) и **полным флоу** через разовый
Playwright-скрипт (код → «Подтвердить» → «Записаться» → запись создана; см. ниже про F-03-100 — тот же прогон
проверял и отмену). Тесты подтвердили: без кода — блок; с верным кодом — запись создаётся нормально.

## MAJOR — F-03-100: после отмены клиент не мог записаться снова с этого экрана

**Было:** весь ряд кнопок (`{!cancelled && (...)}`) исчезал целиком после отмены — ни одной кнопки, чтобы
записаться снова.

**Починил:** `BookingConfirmedScreen.tsx` — добавлена ветка `else`: при `cancelled` показывается одна большая
кнопка «Записаться ещё» (`buttonClasses({fullWidth:true})`, ссылка на `/b/<slug>/book`).

**Проверено действием** разовым Playwright-скриптом (создал запись с кодом → отменил → дождался обновления →
скриншот показывает статус «Запись отменена» + кнопку «Записаться ещё», клик уводит обратно на `/book`).
Скрипт временный, не коммитился (только для проверки в этой сессии); финальные скриншоты не сохранены на диск
намеренно (временные, `/tmp`), но флоу воспроизводим по шагам выше в любой момент.

Также обновил `qa/scenarios/online/booking-cancel2.json`: раз SMS-код теперь обязателен и генерируется
случайно, JSON-сценарий (шаги `click`/`fill`/`wait`/`screenshot`, без чтения текста со страницы) больше не
может сам пройти дальше кнопки «Получить код» — оставил его рабочим до этого шага и добавил `_note` с
объяснением и просьбой (см. `qa/requests/online.md`) добавить в `scripts/measure.mjs` шаг, читающий текст.

## MINOR — F-00-065: на телефоне третий сегмент «Только мои клиенты» обрезан

**Было:** `SegmentedControl` с тремя вариантами на 390px — третья подпись обрывалась на краю без переноса и
многоточия.

**Починил:** `PageScreen.tsx` — `SegmentedControl` теперь `fullWidth size="sm"`; третий сегмент показывает
короткую подпись «Мои клиенты» (`page.visibility.mineShort`, новый ключ ru/en/hy) на экранах `< sm`, полную
«Только мои клиенты» — от `sm` и шире. Foundation-компонент `SegmentedControl` не трогал (это не мой файл) —
фикс только через использование (`fullWidth`, `size`, responsive-подписи).

**Проверено измерением:** `node scripts/measure.mjs --routes /biz/online/page … --device phone,desktop` —
0 ошибок, 0 вылетов, 0 зон < 40px; скриншот `qa/shots/online-b02-fix2/biz-online-page__owner-nails-ru-light-phone.png`
показывает все три подписи полностью читаемыми на 390px.

## MINOR — зона нажатия ссылки в StaffCard < 40px

**Было:** ссылка «Настроить в «Онлайн-записи»» — `h: 20px`.

**Починил:** `src/areas/online/extensions/StaffCard.tsx` — ссылка обёрнута в `inline-flex min-h-11 items-center`
(с компенсирующим `-mx-1 px-1`, чтобы не сдвигать текст).

**Проверено измерением:** тот же прогон, `/dev/ext/staffCard/online` во всех 4 комбинациях ru/en×phone/desktop —
«мелких целей 0» (было ≥1).

## Дополнительно (за пределами присланного списка, но major и на файле, который трогаю в этой пачке)

`qa/measure/online/state-s1.md` п.1–2: React Compiler считает функцию, переданную в `useApiQuery`, «может
выполниться в рендере» — `metaQ.data!.linkId` / `q.data!.staff!.id` / `linkQ.data!.businessId` внутри такой
функции падают TypeError, даже когда запрос выключен (`enabled: false`). Нашёл живым прогоном по всей области
(`/dev/ext/bookingWindow/online` — 8 ошибок консоли в общем сипе), исправил все три места, указанные в
state-s1.md (включая `BookingConfirmedScreen.tsx`, который и так правлю по F-03-100):
`src/areas/online/extensions/BookingWindow.tsx`, `src/areas/online/booking/BookingConfirmedScreen.tsx`,
`src/areas/online/links/LinkSettingsScreen.tsx` — везде значение читается в переменную ДО хука, хук вызывает
функцию уже с готовым значением/фолбэком. Перепроверено: `node scripts/renders.mjs --check-compiler` больше не
находит `online`; `/dev/ext/bookingWindow/online` — 0 ошибок консоли на всех 4 комбинациях (было 2 на каждой).
Отметил ✅ в `qa/measure/online/state-s1.md`.

Остальной открытый список крупных дизайн-замечаний (`ux-r1.md`, `ux-r2.md`, `ux-best-c1.md`, `text-q1.md`,
`decision-c1.md`, `e2e-q1.md`, `onboarding-k1.md`, `recheck-c1.md`, `speed-k1.md`, `a11y-q1.md`, `demo-q1.md` —
десятки major, не связанных с файлами этой пачки) в эту починку не поместился по бюджету сессии; не трогал,
чтобы не размывать фокус пачки и не рисковать регрессией на чужом коде без времени на полную проверку. Это
отдельный долг раздела, не новый.

## Проверки перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/online.tsbuildinfo`, отфильтровано по
  `areas/online|api/online|domain/online|mock/slices/online` — 0 ошибок.
- `npx eslint src/areas/online src/app/biz/online src/app/b src/domain/online.ts src/mock/slices/online.ts
  src/api/online.ts` — 0 ошибок/предупреждений.
- `scripts/ensure-dev.sh` — сервер уже был поднят другой сессией, не трогал.
- `scripts/measure.mjs` по своим маршрутам (b02-fix2, recheck-bw, sweep по всей области `--area online`) —
  0 ошибок консоли, 0 сырых ключей, 0 вылетов, 0 зон < 40px после фикса.
- Снимки посмотрены глазами (Read png): `biz-online-page__owner-nails-ru-light-phone.png` (сегменты),
  `dev-ext-staffCard-online__owner-nails-ru-light-phone.png` (карточка), плюс скриншоты полного флоу записи
  (код → запись → отмена → «Записаться ещё») из разового скрипта проверки.

## Итог

- **done** (все пункты «Готово, когда» по присланным находкам исправлены и подтверждены): F-03-077, F-03-100,
  F-00-065, F-00-066 — это единственные F-id, по которым в этой пачке менялось поведение/вёрстка; полный
  список "Готово когда" по остальным 26 F-id пачки b02 не переисследовался заново (они уже прошли предыдущий
  замер `b02-m1.md` без дефектов — см. таблицу там).
- **marked** — см. ниже, `node scripts/fids.mjs --area online` после работы.

## requests

См. `qa/requests/online.md` — просьба добавить в `scripts/measure.mjs` (фундамент) шаг, который читает текст
элемента на странице и подставляет в поле (нужен, чтобы автоматически проходить сценарии с одноразовым SMS-кодом
после того, как F-03-077 сделал его обязательным).

`node scripts/fids.mjs --area online` после работы: **всего 160, помечено 61 (38.1%)**.
