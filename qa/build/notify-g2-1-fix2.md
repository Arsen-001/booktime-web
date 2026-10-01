# Сборка notify — g2-1-fix2 (починка дефектов измерителя)

Пачка: на починку прислан 1 дефект из проверки g2-1-fix1 (список — в задании). Раздел не строил новые
F-id, код `src/areas/notify/**` / `src/app/biz/notifications/**` в этой пачке не менялся.

## Дефект и что сделано

### F-05-001 (major) — вход из «Онлайн-запись → Основные настройки» не построен

Заново проверено физически: `grep -rn "notifications" src/areas/online/` — пусто, третий вход в
раздел уведомлений из хаба online по-прежнему не построен. Это блокер целиком в чужом разделе
(`src/areas/online/**`) — CONVENTIONS §1 запрещает notify писать в чужие пути, и это создало бы
конфликт с параллельным сборщиком online, который в это же время правит эти же файлы.

Со стороны notify всё, что нужно этому входу, готово с первой пачки:
- страница `/biz/notifications` (и её подстраницы) полностью построена и работает;
- вклад `settingsHub` (`src/areas/notify/extensions/SettingsHub.tsx`) отдаёт плитку «Уведомления» с
  иконкой, заголовком и подзаголовком «Типы, каналы, рассылки и журнал отправок» — проверено живьём на
  `/dev/ext/settingsHub/notify` (снимок ниже), рендерится корректно.

Это **седьмая просьба подряд** к разделу `online` (после g1-1, g1-1-fix1, g1-1-fix2, g1-2, g1-2-fix1,
g2-1-fix1 — см. `qa/requests/notify.md`). Записано туда ещё раз с уточнением: notify ничего
дополнительно построить не может, ждём только вход со стороны `online`.

## Проверка перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/notify.tsbuildinfo`, отфильтровано по
  путям раздела (`src/areas/notify`, `src/app/biz/notifications`, `src/domain/notify.ts`,
  `src/mock/slices/notify.ts`, `src/api/notify.ts`) — 0 ошибок.
- `npx eslint src/areas/notify src/app/biz/notifications src/domain/notify.ts src/mock/slices/notify.ts
  src/api/notify.ts` — 0 ошибок/предупреждений.
- `scripts/ensure-dev.sh` — сервер уже работал на 3710, не трогал.
- `node scripts/measure.mjs --area notify --persona owner --device phone,desktop` (16 стр.) — 0 ошибок
  консоли, 0 4xx/5xx, 0 сырых ключей i18n, 0 вылетов, data-f 37.
- Снимки посмотрены глазами: `qa/shots/notify/dev-ext-settingsHub-notify__owner-nails-ru-light-desktop.png`
  (вклад в settingsHub — плитка «Уведомления» с иконкой/подзаголовком, аккуратно вписана в мок-хост),
  `qa/shots/notify/biz-notifications-log__owner-nails-ru-light-desktop.png` (журнал отправок — фильтры,
  статусы бейджами, кнопка экспорта, ничего не сломано).

## done

Ничего нового не построено — пачка была чисто проверочной (дефект вне юрисдикции notify).

## partial

- F-05-001 — блокер целиком в чужом разделе (`online`), notify не может его починить без нарушения
  CONVENTIONS §1 (чужие пути). Просьба зафиксирована в `qa/requests/notify.md` в седьмой раз.

## assumed

—

## marked

`node scripts/fids.mjs --area notify` после проверки: **88** из 139 (63.3%) — не изменилось, код
раздела в этой пачке не трогался (единственный дефект вне юрисдикции notify).
