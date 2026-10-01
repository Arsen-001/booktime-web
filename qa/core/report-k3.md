**Итог k3:** в 9 файлах просьб было 57 записей без отметки. Сделано 22, из них 5 частично, а 2 уже закрыли раньше: ядро в k2 и помощник по демо. Отклонено 34, у каждой написана причина. Одна запись (journal b04) смешанная: 3 пункта сделаны, 4 отклонены. Под каждой записью стоит строка «**Ядро k3 (25.09):** ✅ / ❌ …».

**Отчёт `qa/core/report-k3.md` не записан:** инструмент отказал, потому что подагентам запрещено писать файлы отчётов. Обходить запрет через Bash не стал. Главное из отчёта — ниже.

**Сделано** (всё обратно совместимо: новые поля необязательные, ничего не переименовано и не удалено):
- **«Задерживаюсь» стало событием ядра.** Новая команда `reportBookingDelay(bookingId, delayMin)` пишет событие записи `delayed`. Клиент получает его через новую ленту `listClientEvents(appUserId)`. Закрывает просьбу schedule F-00-059 (она повторялась три раза) и e2e-q2 №3б.
- **Снятая по сроку неоплаченная запись:** у неё теперь `Booking.cancelReason: 'prepayment_expired'`. Добавлена подпись в `common.json`: «Снята: предоплата не поступила вовремя» вместо «Отменена вами».
- **Общий журнал «Операции с данными»:** `logDataOperation`, `coreTx.logDataOperation` и `listDataOperations`. Просили clients и journal.
- **Новые необязательные поля в ядре:** пакет услуг `Service.servicePackage`, ресурс на время одной услуги `BookingServiceLine.resourceId`, бренд `Business.brandName`, главная локация сети `Network.mainBusinessId`, часовой пояс `Location.timezone`.
- **Права:** `loyalty.rules` (по умолчанию у владельца) и `journal.stats` (у владельца и администратора).
- **Переводы:** массивы в словарях снова переводятся — раньше en всегда показывал русский массив (`src/i18n/load.ts`).
- **`requestSync(fn)`** — запись при закрытии окна без задержки и без предупреждения в консоли (просьба journal).
- **Ошибка «Hydration failed»** (online, 1 раз из 48): причина была в `useApiQuery`. Теперь до конца первой отрисовки он отвечает «загрузка»; на переходах между страницами скелетона нет.
- **Скорость:** база больше не превращается целиком в строку на каждой записи — только раз в 400 мс и при уходе со вкладки.
- **Загрузка из Excel без npm-пакета:** `parseCsv` и `readTextFile` в `src/lib/csv.ts`.
- **Цвета для метаданных:** константа `THEME_META` в `src/config/theme-meta.ts`. Подставить её в `src/app/layout.tsx` и `src/app/manifest.ts` должен их владелец, помощник «приложение для телефона».

**Отклонено — основные причины:**
- **Не мои файлы.** Кнопки 40 px, Stepper, звёздочка в заголовке, QR-код, стрелка вкладок, колокольчик, отдельная страница анкеты и всплывающее окно о записи — у хранителя дизайна. Переслал ему в `qa/requests/ux-core.md` №9–16. Настройки eslint — тоже не мои.
- **Работа разделов, в ядре нечего добавить:** перевод client и online на команды ядра, лист ожидания (resources), деньги у клиента, серии записей и другие.
- **Есть способ проще.** Скидки лояльности и конец подписки раздел может читать из чужого среза сам (`readArea`, §6 правил). Для графика в журнале уже есть право `schedule.edit`. 26 тонких прав clients оставил в срезе раздела — такой слой записан в правилах как образец.
- **Против наших решений.** Автоматический поиск клиента приложения по номеру из CRM нарушил бы «Снято» №3 (F-00-130).
- **Нужно решение главного.** Длительность услуги по мастеру (`Service.durationByStaff`) нельзя добавить без правки правила длительности в `src/domain/rules` — эта папка не в моих файлах. Одно поле без правила разведёт свободные окна и саму запись.

**Правила для разделов** дописаны в `CONVENTIONS.md`: в §6 — что нового в ядре k3, в §7 — как держать тонкие права раздела. Замечания разделам лежат в `qa/measure/<id>/core-k3.md` для client, online, journal, schedule, notify, clients, resources, services, settings и network. Самое серьёзное (block) — у client: в приложении клиенту показываются выдуманные суммы оплат. Для сида записал новые поля в `qa/requests/seed-pending.md` §8.

**Проверка:**
- `npx tsc --noEmit`: в моих файлах ошибок нет. Сейчас есть 2 ошибки в `src/areas/clients/components/ClientFormFields.tsx` — это незаконченная правка раздела clients, с моими изменениями не связана.
- eslint по изменённым файлам ядра чистый, тесты правил прошли 72 из 72.
- Замер экранов: 56 страниц (приложение клиента, кабинет, наша панель; ru и en; телефон и десктоп) — везде 0 ошибок консоли и 0 ответов 4xx/5xx. Снимки — в `qa/shots/core-k3/`.
- Сквозные сценарии C01, C04, C08: 16 шагов прошли, 7 упали — все падения у разделов, они записаны в замечаниях.
- В браузере не проверял новые функции `reportBookingDelay`, `listClientEvents`, `logDataOperation` и `requestSync`: их ещё никто не вызывает.

**Изменённые файлы ядра:**
- /Users/arsen/WebstormProjects/booking-platform/src/domain/core.ts
- /Users/arsen/WebstormProjects/booking-platform/src/api/core.ts
- /Users/arsen/WebstormProjects/booking-platform/src/api/request.ts
- /Users/arsen/WebstormProjects/booking-platform/src/mock/db.ts
- /Users/arsen/WebstormProjects/booking-platform/src/lib/csv.ts
- /Users/arsen/WebstormProjects/booking-platform/src/i18n/load.ts
- /Users/arsen/WebstormProjects/booking-platform/src/config/permissions.ts
- /Users/arsen/WebstormProjects/booking-platform/src/config/theme-meta.ts
- /Users/arsen/WebstormProjects/booking-platform/messages/ru/common.json
- /Users/arsen/WebstormProjects/booking-platform/messages/en/common.json
- /Users/arsen/WebstormProjects/booking-platform/CONVENTIONS.md