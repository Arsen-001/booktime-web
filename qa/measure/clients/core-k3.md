# Замечания хранителя ядра · k3 (25.09.2026)

1. **minor · Право «Настройка программ лояльности»** — `useCan('loyalty.rules')` вместо `settings.manage` (F-04-114).
   ⏳ позже — экран программы лояльности в этом проходе не трогал
2. **minor · Операции с данными** — импорт/выгрузку писать в общий журнал: `coreTx.logDataOperation({ businessId, kind, area: 'clients',
   entity: 'clients', count, failed?, fileName? })` в том же `request()`; свои `importRuns` / `exportLog` — на чтение `listDataOperations`.
   ✅ исправлено (fix-clients): выгрузка пишет `coreTx.logDataOperation` в том же `request()`. ✅ исправлено (g2-2): импорт тоже пишет `coreTx.logDataOperation` в конце `runImport()`, в том же `request()`; свои `importRuns` остаются на чтение своей истории (это по замечанию нормально).
3. **minor · Тонкие права** — ваш слой — принятый образец (CONVENTIONS §7), оставить.
4. **minor · Текст согласия** в `clients.json:consent` — дословная фраза Altegio (notify g1-1), переписать своими словами.
   ✅ исправлено (fix-clients): «Хочу получать напоминания о записи, новости и предложения салона»
