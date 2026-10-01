# notify — пачка g2-3 (починка пропусков)

Раздел: `notify` (Уведомления). Задание — доделать 30 F-id из отчёта измерителя (проверок пропусков).

## Проверка перед работой (п. 0.1 CONVENTIONS)

Прочитаны все файлы `qa/measure/notify/` вне `b*-m*`/`g*-m*` (`ux-*`, `speed-*`, `arch-*`, `core-rules*`,
`state-*`, `decision-*`, `recheck-*`, `e2e-*`, `text-*`, `a11y-*`, `build-*`, `onboarding-*`, `ux-best-*`,
`core-*`) — новых незакрытых block/major по путям этой пачки не найдено сверх того, что уже отмечено
`✅ исправлено` в прошлых пачках (g2-1, g2-2); экраны, которые эта пачка трогает (ни одного — см. ниже),
дополнительных замечаний не имеют.

## Вывод: все 30 F-id — `notOurs`, строить не в чем

Сама формулировка задания уже называет каждый пункт `notOurs <раздел> F-NN-NNN` — это не описка
измерителя, а точное указание: экран, где по ТЗ живёт функция («Где»), физически принадлежит другому
разделу (`settings`/`billing`, `integrations`, `loyalty`), и его пути (`src/app/biz/settings/**`,
`src/app/biz/billing/**`, `src/app/biz/integrations/**`, `src/app/biz/loyalty/**`, соответствующие
`src/areas/<раздел>/**`) — не в списке путей `notify` из `docs/areas.json` и CONVENTIONS §1. Это
подтверждено по каждому пункту тремя источниками:

1. **`qa/plan/notify.md`**, таблица «notOurs — строят другие разделы»: все 30 id уже перечислены там с
   тем же «Хозяин» (settings — 3, integrations — 17, loyalty — 10) и той же ссылкой на F-блок раздела-хозяина.
2. **Сам блок в ТЗ** (`booking-research/functional-map/05-notifications.md`), поле «Где» — прочитан
   целиком для каждого из 30 id. Примеры: F-05-115 «Где: «Биллинг → Детализация» → «Пополнить баланс»…
   баланс — «Биллинг → Подписка»»; F-05-069 «Где: «Интеграции» → «Уведомления» (фильтр «SMS-агрегаторы»)»;
   F-05-081 «Где: карточка/настройки лояльности» — ни один не указывает на `/biz/notifications/**`.
3. **Код уже фиксирует это сознательно**: `src/domain/notify.ts:175-176` — комментарий у поля `smsBalance`
   прямым текстом: «У нас нет отдельного понятия «баланс уведомлений» (F-05-115 не построен ни в
   settings, ни в finance — …)» — то есть решение «это не наш экран» принято раньше этой пачки и уже
   отражено в типах.

Строить экран пополнения баланса в `src/app/biz/billing/**`, каталог SMS-провайдеров в
`src/app/biz/integrations/**` или уведомления по картам лояльности в `src/app/biz/loyalty/**` значило бы
нарушить CONVENTIONS §1 («Разделу принадлежат только…») и наехать на параллельных сборщиков
`settings`/`integrations`/`loyalty`, которые ведут те же пути по своим ТЗ (05-notifications.md сам
ссылается на их номера блоков: F-15-094, F-15-053, F-15-049/051/064, F-13-155…164 и т.д. — эти номера не
из файла notify, у notify своя нумерация F-05-*).

**Что действительно наше в этих функциях — уже построено:**

- Реестр каналов (`NotifyChannel`) уже включает `whatsapp`/`telegram`/`sms` (домен `src/domain/notify.ts`),
  так что движок notify технически принимает события из будущих интеграций-партнёров (F-05-071…076,
  F-05-124…126), когда те появятся — расширять реестр раньше, чем есть сам канал-приложение, нечего.
- Тип «код входа» (`registry.ts`) уже словами объясняет наш выбор каскада WhatsApp/Telegram → SMS
  (⭐ F-00-032), что закрывает содержательную часть F-05-074/119 в границах notify (сам каталог
  провайдеров — не наш экран).
- `smsBalance` в срезе (`src/mock/slices/notify.ts`) уже посчитан по сетевой локации (F-05-118) — это
  единственная часть «баланса», которая физически участвует в движке notify (тариф по сети); сам экран
  пополнения (F-05-115) остаётся у `settings`/`billing`.

Итог: ни один файл вне путей `notify` не менялся, в код `notify` эти F-id не проставлены —
как и предыдущая пачка (`notify-g2-2.md`) для похожего набора (F-05-055…064), список стабилен и
совпадает с `qa/plan/notify.md`.

## done

Пусто — все 30 id в этой пачке относятся к другим разделам, «Готово, когда» для них проверяется в
`settings`/`integrations`/`loyalty` по их собственным путям и отчётам.

## notOurs — подробно по всем 30

| F-id | Хозяин | Куда обращаться |
|---|---|---|
| F-05-115 | settings/billing | `src/app/biz/billing/**`, F-15-094 |
| F-05-117 | settings/billing | `src/app/biz/billing/**` или `src/app/biz/settings/**`, F-15-053 |
| F-05-135 | settings | `src/app/biz/settings/**`, F-15-049/051/064 |
| F-05-069 | integrations | `src/app/biz/integrations/**`, F-13-155/157…164 |
| F-05-070 | integrations | `src/app/biz/integrations/**`, F-13-139/140 |
| F-05-071 | integrations | `src/app/biz/integrations/**`, F-13-141 |
| F-05-072 | integrations | `src/app/biz/integrations/**`, F-13-143 |
| F-05-073 | integrations | `src/app/biz/integrations/**`, F-13-142 |
| F-05-074 | integrations | `src/app/biz/integrations/**`, F-13-142 |
| F-05-075 | integrations | `src/app/biz/integrations/**`, F-13-144…154 |
| F-05-076 | integrations | `src/app/biz/integrations/**`, F-13-143…154 |
| F-05-119 | integrations | `src/app/biz/integrations/**`, F-13-049 |
| F-05-120 | integrations | `src/app/biz/integrations/api`, F-13-062 |
| F-05-121 | integrations | `src/app/biz/integrations/api`, F-13-061 |
| F-05-122 | integrations | `src/app/biz/integrations/**`, F-13-042/019/036 |
| F-05-123 | integrations | `src/app/biz/integrations/**`, F-13-020/021/043/044 |
| F-05-124 | integrations | `src/app/biz/integrations/**`, F-13-121/127 |
| F-05-125 | integrations | `src/app/biz/integrations/**`, F-13-110 |
| F-05-126 | integrations | `src/app/biz/integrations/**`, F-13-106 |
| F-05-136 | integrations | `src/app/biz/integrations/**`, F-13-181 |
| F-05-081 | loyalty | `src/app/biz/loyalty/**`, F-06-167/169 |
| F-05-100 | loyalty | `src/app/biz/loyalty/**`, F-06-029 |
| F-05-101 | loyalty | `src/app/biz/loyalty/promotions`, F-06-036/049 |
| F-05-102 | loyalty | `src/app/biz/loyalty/memberships`, F-06-118/119 |
| F-05-103 | loyalty | `src/app/biz/loyalty/memberships`, F-06-120 |
| F-05-104 | loyalty | `src/app/biz/loyalty/memberships`, F-06-160 |
| F-05-105 | loyalty | `src/app/biz/loyalty/**`, F-06-012 |
| F-05-106 | loyalty | `src/app/biz/loyalty/**`, F-06-149 |
| F-05-127 | loyalty | `src/app/biz/loyalty/**`, F-06-170 |
| F-05-128 | loyalty | `src/app/biz/loyalty/memberships`, F-06-134 |

Список идентичен таблице `notOurs` в `qa/plan/notify.md` (те же 30 строк среди 51) — повторно
подтверждён, ничего не строилось.

## partial

Пусто.

## Запросы к фундаменту

Не потребовались — правка чужого ядра для этой пачки не нужна; `qa/requests/notify.md` не менялся.

## Проверка перед сдачей

- Код `notify` не менялся в этой пачке (все 30 id — вне путей раздела), поэтому `tsc`/`eslint` по путям
  `notify` не могли сломаться этой работой; предыдущий зелёный прогон (`notify-g2-2`) остаётся в силе.
- `scripts/ensure-dev.sh` — сервер уже поднят параллельными сборщиками, не перезапускался (было бы
  нарушением «работающий сервер не убивать»); новых экранов для замера нет.
- `scripts/measure.mjs` по своим маршрутам не запускался — пачка не тронула ни один файл, замерять нечего
  нового; прошлые снимки (`qa/shots/notify*`) остаются актуальными.

## marked

`node scripts/fids.mjs --area notify` после этой пачки:

```
раздел          всего  помечено      %
notify            139        88   63.3
```

**88** — не изменилось относительно пачки g2-2, потому что ни один из 30 id этой пачки не относится к
путям `notify` и, соответственно, не может и не должен быть помечен `data-f` в коде раздела.
