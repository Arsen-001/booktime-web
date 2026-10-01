# journal · fix1 после проверки g3-2 (25.09.2026)

## Дефект из проверки g3-2 — исправлен

### F-01-193 · major · групповые услуги в окне индивидуальной записи
- Причина: `BookingWindow.tsx` строил `staffServices` из `allServicesQuery.data` (свой собственный запрос
  `coreList('services', {businessId})`) фильтром только `staffIds.includes(staffId) && active` — без `kind`.
  Групповые услуги (`kind: 'group'`) свободно попадали в `CenterZone` → `ServicePicker` окна одиночной записи.
  Второй путь той же дыры — `getFrequentServices()` (`src/api/journal.ts`) для блока «Частые услуги мастера»:
  тот же фильтр без `kind`, отдельный от `staffServices`.
- Правка:
  - `src/areas/journal/components/BookingWindow.tsx:721-726` — добавлено `&& s.kind === 'individual'`
    в фильтр `staffServices` (источник для `ServicePicker`/`CenterZone`).
  - `src/api/journal.ts` (`getFrequentServices`) — тот же фильтр `kind === 'individual'` для «частых услуг
    мастера», чтобы групповая услуга не проскочила туда, даже если раньше встречалась в его индивидуальных
    визитах.
  - `ServicePicker` сам ищет `lastClientServiceId` внутри переданного `services` — раз список уже без
    групповых, «последняя услуга клиента» тоже не покажет групповую (доп. правки не нужно).
- Проверено живьём (Playwright, не только по коду): `demo=individual&sphere=fitness` (Арман Геворгян,
  бизнес `kind: 'individual'`, у него 2 групповые услуги в сиде — «Функциональная тренировка в группе»,
  «Растяжка в группе»). Открыл «Новая запись» → «Индивидуальная запись клиента»: в «Частые услуги мастера»
  только персональные/онлайн/составление программы — групповых нет; поиск «групп» в «Все услуги» даёт
  пустое состояние «У этого мастера нет доступных услуг» (было бы 2 совпадения без фикса). Снимки:
  `/tmp/d-arman3.png`, `/tmp/d-arman4.png` (не в репозитории — временные, для этого прохода).
- `PackageCreateModal` (пакет из нескольких услуг) намеренно НЕ тронут — вне области F-01-193, у ТЗ этой
  функции формулировка именно «в окне индивидуальной записи» (обычная запись), пакет — отдельная функция.

## Пункт 0.1 — открытые block/major в `qa/measure/journal/`
Прочитаны все файлы кроме `b*-m*`/`g*-m*` и исключённых категорий (`ux-*`, `speed-*`, `arch-*`,
`core-rules*`, `state-*`, `decision-*`, `recheck-*`, `e2e-*`, `text-*`, `a11y-*`, `build-*`,
`onboarding-*`, `ux-best-*`, `core-*`). Оставшиеся файлы с текстовыми замечаниями (`demo-q1…q4.md`,
`empty-d1.md`) — все major-пункты в них уже отмечены `✅ исправлено` предыдущими пачками (g2-2 fix1,
g2-3-fix1). Новых непомеченных block/major не найдено — править нечего.

## Проверка
- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/journal.tsbuildinfo` — 0 ошибок в путях journal.
- `npx eslint src/areas/journal/components/BookingWindow.tsx src/api/journal.ts` — чисто.
- `scripts/ensure-dev.sh` — сервер уже работал на 3710, не трогал.
- `node scripts/measure.mjs --routes /biz/journal --persona owner --device phone,desktop` — 0 ошибок
  консоли, 0 4xx/5xx, 0 сырых ключей i18n, data-f найдено (37 телефон / 48 десктоп).
- Снимки просмотрены глазами (Read png): `/tmp/d-arman1.png` (журнал фитнес-тренера), `/tmp/d-arman3.png`
  (окно записи — частые услуги без групповых), `/tmp/d-arman4.png` (поиск «групп» → пусто).

## done
- F-01-193

## partial
(нет — единственный дефект из проверки полностью закрыт)

## marked
166
