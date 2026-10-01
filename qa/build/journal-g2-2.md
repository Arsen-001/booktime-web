# Раздел journal — пачка g2-2 (25.09.2026)

Сборщик, 3-й/N параллельный срез раздела «Журнал записей и окно записи». Работал по списку пропусков ниже.
Перед работой: `tsc --incremental`, `eslint`, дев-сервер (уже был поднят другим срезом — не трогал), `measure.mjs --area journal`.

## Важное ограничение, обнаруженное в начале работы

Пять из тридцати пунктов пропусков относятся **не к journal**, а к своим владельцам путей (CONVENTIONS §1):
вкладки хоста `bookingWindow` живут в `src/areas/<area>/extensions/BookingWindow.tsx` каждого раздела, не в
`src/areas/journal/**`:

- Finance (F-01-116/124/144/146/212/213) → `src/areas/finance/extensions/BookingWindow.tsx`
- Loyalty (F-01-073/210) → `src/areas/loyalty/extensions/BookingWindow.tsx`
- Staff «Изменения данных»/Google Календарь (F-01-097/201) → `src/areas/staff/**`
- Reports лента «Визиты» (F-01-099) → `src/areas/reports/**`
- Integrations карточка звонка/вебхуки (F-01-202/203) → `src/areas/integrations/**`

Правило §1 и §0.1 («чужие файлы не трогать», «параллельно работают помощники других разделов») запрещают их
строить отсюда — это работа сборщиков finance/loyalty/staff/reports/integrations. Не строил их. Если это
назначение ошибочно — переадресовать проверяющему на следующей пачке.

## Что сделано в этой пачке

**0.1 — измерения (обязательный первый шаг):** прочитаны все файлы `qa/measure/journal/{ux-*,speed-*,arch-*,
core-rules*,state-*,decision-*,recheck-*,e2e-*,text-*,a11y-*,build-*,onboarding-*,ux-best-*,core-*}`. Закрыты (до
30% времени пачки):

- **text-q2/q3/q4** — 10 major (свои названия статусов → `common.bookingStatus`; текст про «демо-каталог склада» в
  окне записи; «Subscription» → «Membership»; «Удалить» больше не путается с «отменена»/тостом «Вернуть»; метка
  «new» → «Новая»; «Цифровой журнал»/«Настройки из справки» → «Настройки журнала»/«Настраивается в других разделах»;
  звёздочка «Избранное» → булавка «Закреплённые»/«Открепить»; «Симулировать…(F-01-036)» → «Демо: запись от бота»;
  «Chat lead» → «Написали в чат»; медкарта — «код льготы» удалён, «Документ» → «Паспорт или ID-карта», адрес/местность
  переписаны) + 5 minor (`sidebar.sellProduct/newPayment`, `window.left.expandedTile`, `window.save.createEmpty`).
  Отмечено `✅ исправлено (g2-2)` в файлах. Остаток (≈26 minor из q2–q4) — не тронут, следующей пачке.
- **state-s1 №1** — четыре `x!.y` (`BookingWindow.tsx` клиент/matchedClient/booking, `BookingHoverCard.tsx` client)
  заменены на `const id = x?.id; … (id ?? "")` + `enabled: Boolean(id)` — не упадут под React Compiler. №2
  (оптимистичная смена статуса), №3–5 (лишние refetch, скелетон дня, дублирующийся ключ услуг) — не сделаны.
- **arch-a1 №6 (частично)** — `canCreate` в `JournalScreen.tsx` и `ClientZone.tsx` теперь проверяет `journal.create`
  вместо `journal.edit`. Право `journal.reschedule` для переноса/растягивания и `maskedPhone` без `clients.phones` —
  не сделаны.
- **ux-r5 R5-M4** — своя `BASE_STATUS_META` в `src/areas/journal/lib/status.ts` теперь = `BOOKING_STATUS_META` из
  `@/ui/BookingStatusBadge` (одна карта иконок/тонов на сетку, всплывающую карточку и окно; «Записи» уже использовал
  `common.bookingStatus`). Полный переход блока сетки на компонент `<BookingStatusBadge>` вместо своей вёрстки — не
  сделан (блок в сетке красит фон плотнее, чем позволяет готовый Badge — нужна отдельная проверка дизайна).
- Побочно: удалено неиспользуемое поле `benefitCode` из `MedicalCard` (`domain/journal.ts`, `api/journal.ts`,
  `MedicalRecordsPanel.tsx`) — было только источником текста, который text-q4 просил убрать с экрана.

## Проверка

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/journal.tsbuildinfo` — 0 ошибок по путям раздела.
- `npx eslint src/areas/journal src/domain/journal.ts src/api/journal.ts` — 0 ошибок/предупреждений.
- `node scripts/measure.mjs --area journal --persona owner --lang ru,en --device desktop` — 10 страниц, 0 вылетов,
  0 сырых ключей, 0 «нет ключа»/«нет en». Одна консольная ошибка `/biz/records [owner/en/desktop]`
  («Router action dispatched before initialization») — перепроверена изолированным прогоном той же страницы
  (`--routes /biz/records --persona owner --lang en --device desktop`): 0 ошибок, воспроизвелась один раз только
  при параллельном (`--concurrency 3`) прогоне трёх вкладок сразу — фреймворковый флейк Next.js под нагрузкой
  замера, не связан с правками этой пачки (я не трогал `RecordsScreen.tsx`).
- Снимок `qa/shots/journal/biz-records__owner-nails-en-light-desktop.png` открыт глазами — новый текст
  («Demo: booking from a bot», статусы «Client confirmed» / «Booked») на месте, вёрстка не поехала.

## Что осталось (не в этой пачке)

Все 25 пунктов ниже требуют существенно больше времени, чем осталось в бюджете этой пачки (30% ушло на измерения);
оценка объёма и первого шага — при следующем заходе:

- **arch** (handleSave → `saveJournalBooking`/`coreTx.placeBooking`; черновик в `sessionStorage`/`useState` вместо
  моковой базы; `makeServiceLine/lineTotal` из ядра вместо деления на `(1-pct)`; настройки среза по `businessId`;
  `getJournalDay` вместо `coreList clients` целиком; `journal.reschedule`; разбить 14 файлов > 400 строк/с несколькими
  компонентами; 8 молча проглоченных ошибок; `toISOString()` вместо ереванского дня) — не начато, кроме №6 (частично).
- **core-rules** (свои `computeStaffHours`/`computeOverlap`/`INACTIVE` вместо `@/domain/rules`; вкладкам
  `bookingWindow` не передаются `onDraftChange`/`registerBeforeSave`/`registerAfterSave`) — не начато.
- **e2e-q4 №1** (два источника «оплачено» — `PaymentSheet`/`NewPaymentModal` пишут `extras.payments` мимо
  вкладки finance) — не начато; зависит от finance.
- **ux** (десктоп 544px меню+панель обрезают 4-й столбец мастера; сетка с 08:00 вместо первого рабочего часа;
  должность обрезана; PageHeader/h1 и правильный скелетон при загрузке/ошибке; история клиента в окне записи;
  8 чипов статуса → 3 + «Отменить ▾»; строка «К оплате» выше сгиба; «demo»-кнопки на рабочем экране «Записей»;
  пустая иконка Ban без кнопки) — не начато.
- **speed** (безликий тост + прыжок журнала наверх; цели < 44px; «Сохранить изменения» висит, когда всё сохранено)
  — не начато.
- **onboarding** (тур `journal.intro`/`journal.masterIntro`; у индивидуала лишние «Добавить сотрудников»/«Делить по
  ресурсам»; `HintBanner` про клик по свободному времени) — не начато.
- **decision-c3 №3** (`ConfirmDialog` о возврате предоплаты при «Отменил мастер», вызов `masterCancelRefund`) —
  не начато; зависит от finance.
- **core-k4** («Продать»/«Добавить сотрудника» не скрыты правами `finance.edit`/`staff.manage`; примечание клиента
  через свой оверлей вместо `coreTx.update`) — не начато.
- **R5-m14** (окно записи через `router.push`/`replaceState` вместо навигации) — не начато.
- state-s1 №2–5, arch-a1 №6 (остаток), ux-r5 R5-M4 (остаток) — см. выше, частично.

Всё перечисленное — честные пропуски по нехватке времени в пачке, не забытое: следующая пачка должна начать
именно с этого списка (а не заново читать измерения).

## assumed

- `benefitCode` в медкарте убран из типа и сида целиком (а не просто скрыт с экрана) — использовался только в
  journal-owned файлах, других потребителей не нашлось (`grep -rn benefitCode src/` до правки).
- Финансовые/лояльность/staff/reports/integrations пункты списка пропусков — вне путей journal (см. раздел
  «Важное ограничение» выше); интерпретировал это как «не строить», а не «нашёл через grep расширение».

## requests

Пусто — правок общего в этой пачке не понадобилось.
