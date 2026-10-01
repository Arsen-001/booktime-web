# Раздел «Уведомления» — починка дефектов g2-2 (fix2)

Дата: 2026-09-25

## Что чинили

Измеритель проверил доделку g2-2 и нашёл 2 дефекта, оба про видимость пунктов меню:

- **F-05-111** (major) — «Рассылки» в сайдбаре видны и кликабельны персоне без права `notify.mailings`
  (admin); по ТЗ такая персона не должна видеть пункт вовсе, а не получать отказ после клика.
- **F-05-112** (minor) — то же для «Журнал отправок» и права `notify.log`.

## Причина

`src/areas/notify/nav.ts` не передавал `permission` в подпунктах `mailings` и `log`, хотя тип `NavChild`
и функция `visibleNav`/`childVisible` (`src/config/nav.ts`) уже умеют фильтровать по праву — этим же
способом гейтятся подпункты у `loyalty` и `journal`. Страницы `/biz/notifications/mailings` и
`/biz/notifications/log` уже были защищены `NotifyAccessGate extra="notify.mailings"` /
`extra="notify.log"` (F-05-111/F-05-112 «Готово, когда» по содержимому страницы выполнялись), не хватало
только скрытия самого пункта меню.

## Правка

`src/areas/notify/nav.ts`:

```ts
{ id: 'mailings', href: '/biz/notifications/mailings', labelKey: 'notify.nav.mailings', permission: 'notify.mailings' },
{ id: 'log', href: '/biz/notifications/log', labelKey: 'notify.nav.log', permission: 'notify.log' },
```

Верхний пункт меню «Уведомления» (`src/config/nav.ts`) не трогали — он ведёт на «Типы уведомлений»
(`notify.manage`), которые персоне admin доступны; править фундамент сам не могу (правило раздела),
и правка там не требуется для «Готово, когда» F-05-111/F-05-112 — только гейт конкретных подпунктов.

## Проверка

- `tsc --noEmit --incremental` по своим путям — 0 ошибок.
- `eslint` по своим путям (`src/areas/notify`, `src/app/biz/notifications`, `src/domain/notify.ts`,
  `src/mock/slices/notify.ts`, `src/api/notify.ts`) — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер на 3710 уже работал, не трогал.
- `scripts/measure.mjs --routes /biz/notifications,/biz/notifications/mailings,/biz/notifications/log
  --persona admin,owner --device desktop` (concurrency 1, чтобы не ловить флейк параллельного прогона
  «Router action dispatched before initialization», который на concurrency 3 дал 9 ложных ошибок консоли
  и пропал при concurrency 1 — известная ловушка тяжёлого параллельного прогона, не регрессия):
  0 ошибок консоли, 0 4xx, 0 сырых ключей, 0 вылетов. У admin на всех трёх страницах `data-f: 0` (гейт
  сработал, контента раздела нет — ни в меню, ни при прямом заходе), у owner — `data-f` есть, страницы
  работают как раньше.
- Снимок `qa/shots/notify-g2-2-fix2b/biz-notifications-mailings__admin-nails-ru-light-desktop.png`
  глазами: в сайдбаре у admin остались только «Типы уведомлений», «Каналы отправки», «Центр
  уведомлений» — «Рассылки» и «Журнал отправок» пропали; прямой заход на `/biz/notifications/mailings`
  по-прежнему показывает «Нет прав на это действие» (это уже было верно до правки).

## done

- F-05-111
- F-05-112

## partial

(нет)

## marked

88 (`node scripts/fids.mjs --area notify` после правки: notify 139 всего, 88 помечено, 63.3%)
