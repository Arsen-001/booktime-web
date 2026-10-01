# Код-ревью фронта 30.09.2026: предоплата, отмена, срок заявки, журнал, Telegram, i18n

Код не правил: параллельно работают проверяющие. Номера строк — на момент ревью, файлы могут сдвигаться. В отчёт вошло только проверенное по коду (фронт и `booktime-backend`).

## Высокая важность

### 1. Мок: оплата визита не учитывает полученную предоплату, и деньги считаются дважды
- **Где:** `src/api/finance.ts:1229` (`payBookingQuick`), `:1260` и `:1268` (`payBookingSplit`), `:1299` (`addBookingPromoDiscount`), `:1336` (`applyAccountToBookingSync`), `:2512` (`markPaymentLinkPaid`), `:1630` (`listClientDebtVisits`), а также список неоплаченных визитов около `:1681`.
- **Суть:** «к оплате» считается как `bookingAmountDue(payableTotalOf(booking), existing)`, предоплата не вычитается. Сводка `buildBookingPaymentSummary` (`:1042`) её вычитает, поэтому окно показывает одну сумму, а записывается другая.
- **Сценарий:**
  1. Мастер берёт 30%, визит стоит 10 000 ֏. Клиент перевёл 3 000 ֏, мастер нажал «Деньги пришли».
  2. В окне оплаты `BookingWindow`: «К оплате 7 000» и строка «Предоплата 3 000».
  3. Нажимаем «Наличные» → QuickPayModal показывает 7 000 (`amount={due}`, `BookingWindow.tsx:821`), но `payBookingQuick` проводит 10 000.
  4. Итог: в кассе +10 000 при 3 000 уже у мастера. Всего засчитано 13 000 за визит в 10 000.
- **Ещё проявления:**
  - Раздельная оплата пропускает до 10 000 вместо 7 000.
  - Визит с «Оплатить всё сразу» (`prepayment.full`) остаётся в «Неоплаченных» и «Визитах с долгом» на полную сумму.
- **В api так не бывает:** сервер при `prepayment-received` пишет строку и `paidAmount`, а `dueOf` считает от `paidAmount`.
- **Правка:** одна функция `dueOf(booking, existing) = bookingAmountDue(payableTotalOf(b), prepaid > 0 ? [...existing, {amount: prepaid, cancelled: false}] : existing)`, где `prepaid = Math.min(prepaidAmount(b), total)`. Использовать её во всех местах выше.

### 2. Мок: запись, оплаченная предоплатой, тут же снимается как «мастер не ответил»
- **Где:** `src/api/online.ts:1466-1478` (`confirmPrepaymentReceived`) вместе с `src/api/core.ts:508-512` (`txReleaseExpiredPrepayments`) и `src/domain/rules/booking-policy.ts` `confirmDeadlineOf`.
- **Суть:**
  - При `meta.confirmAfterPayment` (у мастера ручное подтверждение, «только мои клиенты» или выезд) «Деньги пришли» переводит запись в `awaiting_confirmation`.
  - Своего `confirmDeadline` запись не получает, поэтому срок считается от `createdAt`: `min(createdAt + 2 ч, start − 1 ч)`.
- **Сценарий:**
  1. Запись создана в 10:00 на завтра, оплата подтверждена в 12:30.
  2. Срок = 12:00, он уже прошёл.
  3. Первое же чтение журнала или заявок (`releaseExpiredPrepayments`) ставит «Отменил мастер» + `confirmation_expired`.
  4. `dropped()` не ставит `refundDue`, хотя предоплата `paid: true`. Клиент заплатил, запись снята, напоминания «Верните деньги» нет.
- **В api:** у сервера нет `confirmAfterPayment`, после оплаты запись сразу `scheduled`. Это отдельное расхождение, см. №10.
- **Правка:**
  - в `confirmPrepaymentReceived` при переходе в `awaiting_confirmation` ставить `confirmDeadline: addMinutes(nowDateTime(), 120)`, ограничив его значением `start − 60`;
  - в `dropped()` добавлять `refundDue` для оплаченной предоплаты — так же, как сервер делает для `cancelled_by_master` (`bookings.service.ts:1191-1193`).

### 3. Отзыв и «уже оценено» по ссылке идут без `?h=` (задача от проверяющего бэкенда)
- **Где:**
  - `src/api/online.server.ts:286-291`: `addReviewServer` → `POST /v1/public/bookings/:id/reviews`, `hasReviewedServer` → `GET …/reviews/:target`, оба без `query: { h }`;
  - `src/api/online.ts:1914` (`addReview`) и `:1928` (`hasReviewed`) не принимают хэш;
  - вызовы: `src/areas/online/booking/BookingConfirmedScreen.tsx:70-71` и `:478`.
- **Точная правка:**
  1. В `online.server.ts`:
     ```ts
     export function addReviewServer(input: {...; hash: string }) {
       return http('POST', `/v1/public/bookings/${input.bookingId}/reviews`, { target: input.target, targetId: input.targetId, clientId: input.clientId }, { query: { h: input.hash } });
     }
     export function hasReviewedServer(bookingId: Id, target: ReviewTarget, hash: string) {
       return http<{ reviewed: boolean }>('GET', `/v1/public/bookings/${bookingId}/reviews/${target}`, undefined, { query: { h: hash } }).then((r) => r.reviewed);
     }
     ```
  2. В `online.ts`: добавить `hash` в `addReview(input)` и третьим параметром в `hasReviewed(bookingId, target, hash)`. Мок тоже проверяет `readArea('online').bookingMeta[bookingId]?.accessHash === hash`, иначе `ApiError('not_found')` — как `getOnlineBooking`.
  3. В `BookingConfirmedScreen.tsx`:
     - ключ `['online-reviewed', bookingId, hash]` и `() => hasReviewed(bookingId, 'business', hash!)`;
     - `useApiMutation(addReview, { invalidates: [['online-reviewed', bookingId]] })` — см. №4;
     - в `mutate` добавить `hash`.
  4. На бэкенде после этого: `@Query('h') hash` и `findByHash` в `public.controller.ts:163-178`.
- Других вызовов публичных отзывов на фронте нет. `client.server.ts:208-226` — это `/v1/me/reviews/*`, по сессии, хэш там не нужен.

## Средняя важность

### 4. Api: после действий на странице записи по ссылке экран не обновляется
- **Где:** `BookingConfirmedScreen.tsx:68-70`, мутации `cancelMutation`, `payMutation` и `reviewMutation` без `invalidates`.
- **Причина:** в api `useApiMutation` перечитывает только ключи из `invalidates` (`request.ts:691-694`). Публичная страница читает прямым `http`, а не через зеркало.
- **Сценарии:**
  - **Отмена:** тост «Отменено», диалог закрыт, но статус и кнопка «Отменить» остаются до перезагрузки.
  - **«Я оплатил»:** `meta.prepaymentReportedAt` не обновился, таймер продолжает идти, дойдёт до 0 и покажет «время вышло». Опрос включается только при `paymentReported`.
  - **Звёздочки:** кнопка остаётся, повторный клик даёт `already_rated` и тост «не удалось».
- **Правка:** `invalidates: [['online-booking', bookingId], ['online-cancel-window', bookingId], ['online-booking-status-log', bookingId]]` для отмены и оплаты; `[['online-reviewed', bookingId]]` для отзыва.

### 5. Api: в приложении клиента после отмены, «Подтверждаю» и «Я оплатил» карточка записи устаревшая
- **Где:** `src/areas/client/bookings/BookingDetailBody.tsx:43-44` и `src/areas/client/bookings/PrepaymentCard.tsx:42`. Запросы `clientKeys.booking(...)` (`BookingDetailScreen.tsx:21`) и `myBookings`/`upcoming` идут прямым `http` (`client.ts:1335`).
- **Сценарий:** api, клиент отменяет запись. Тост «Отменено (поздно, предоплата у мастера)» показан, но статус и кнопка «Отменить» остаются на 60 с (`staleTime`). Повторный клик → ошибка.
- **Правка:** `invalidates: [clientKeys.booking(id, appUserId), clientKeys.myBookings(appUserId), clientKeys.upcoming(appUserId)]`.

### 6. Мок: отмена по ссылке не добавляет неявку и берёт другие правила, чем ядро и сервер
- **Где:** `src/api/online.ts:1618-1640` (`cancelOnlineBooking`).
- **Суть:** отмена сделана своим `updateBooking` со `cancelledLate`, без `noShowCount + 1`. В `core.ts` сказано, что ссылка зовёт `coreTx.cancelByClient`, но она его не зовёт.
- **Сравнение:**
  - отмена в приложении (`txCancelByClient`, `core.ts:418`) добавляет неявку;
  - сервер тоже добавляет (`bookings.service.ts:1521`).
- **Правила:** ссылка берёт `online.staffRules`, по умолчанию `DEFAULT_STAFF_ONLINE_RULES`, без слоя `Business.bookingRules`. Ядро и сервер используют `effectiveBookingRules(business, staff)`.
- **Сценарий:** в моке клиент поздно отменяет по ссылке → у клиента «Неявок: 0». В api было бы 1.
- **Правка:** после проверки хэша звать `coreTx.cancelByClient(bookingId)`, дальше — лог, части пакета и причина, как сейчас.

### 7. Часовой пояс: срок отмены и таймер предоплаты считаются по поясу браузера, а не Еревана
- **`src/api/online.ts:1560-1561`** (`hoursUntil`: `new Date(start) - Date.now()`, `start` — местное ереванское время без пояса) → `canCancelFree` в `getCancelWindow` (`:1603`).
  - **Сценарий:** клиент в Берлине (UTC+2), запись в 13:00 по Еревану, сейчас 11:00 по Еревану, срок 3 ч.
  - Окно считает 4 ч, «Отмена бесплатна», в диалоге «Предоплата вернётся».
  - Сама отмена (`clientCancelOutcome` с `nowDateTime()`) видит 2 ч: поздно, неявка, предоплата остаётся мастеру.
  - **Правка:** `minutesUntilStart(booking, nowDateTime()) >= cancelWindowHours * 60` или просто `canCancelFree(booking, policyRulesOf(rules), nowDateTime())`.
- **`BookingConfirmedScreen.tsx:77`** (`new Date(prepaymentInfo.holdUntil)`, строка 'YYYY-MM-DDTHH:mm' по Еревану) и таймер от `Date.now()`.
  - У клиента в Москве таймер на 60 мин длиннее, в Лос-Анджелесе — на 11 ч.
  - **Правка:** `parse(holdUntil)` из `@/lib/date` и `nowYerevan()`, либо секунды от `minutesUntilStart`.
- Так же устроен `src/areas/online/requests/RequestCard.tsx:16` («N мин назад» от `submittedAt`), здесь важность низкая.

### 8. Api: сегмент клиентов «Пора записать» (`pick: 'due'`) не поддержан сервером
- **Где:** `src/api/clients/list.ts:23,47`, `src/areas/clients/components/list/QuickPicksRow.tsx:24`. На бэкенде в `clients.schemas.ts:112` `quickPick` без `'due'`, `clients.service.ts:17`.
- **Сценарий:** api, нажать чип → `POST /clients/search {pick:'due'}` отвечает 400, весь список уходит в ErrorState. Число у чипа не показывается. Сервер не отдаёт `ClientRow.dueAt`, поэтому в карточке клиента (`ClientMoneySummary.tsx:52`) блок «пора снова» пропадает.
- **Правка:** на сервере `due` + `dueAt` по правилу `dueAtOf` (`src/api/clients/shared.ts:84`). До этого прятать чип при `isApiMode()`.

### 9. Api: карточка Telegram по ссылке расходует лимит, общий с отменой и «Я оплатил»
- **Где:** `src/areas/online/booking/TelegramRemindersCard.tsx:20` — чтение через `useApiQuery` вызывает `POST /v1/public/bookings/:id/telegram-link` (`online.server.ts:377`).
- **Лимит:** корзина `public-booking-hash-write`, 20 в час на IP (`telegram.controller.ts:84`). Та же корзина у отмены и «Я оплатил».
- **Сценарий:** 20 открытий страницы за час, или несколько клиентов за одним NAT → «Отменить» и «Я оплатил» отвечают 429. Кроме того, каждое открытие создаёт новый код.
- **Правка:** получать ссылку только по нажатию «Подключить» (мутация). Для «подключено» — лёгкий GET или `staleTime: Infinity`. На сервере — своя корзина.
- **Ещё по этой карточке:**
  - в api «Подключено» не появляется без перезагрузки: после `window.open` нет перечитывания, `refetchOnWindowFocus: false`. Правка: `visibilitychange → q.refetch()`;
  - `TelegramRemindersCard.tsx:28` — `demo.mutate` без try/catch, при ошибке нет тоста (низкая важность).

### 10. Расхождение мока и api: предоплата при выезде и «подтверждение после оплаты»
- **Выезд** (`src/api/online.ts:921-933`): в моке виджета `if (prepaymentRule) status = 'awaiting_prepayment'` перекрывает `awaiting_confirmation`, то есть с клиента берут предоплату.
  - `booking-flow` (`newBookingStatus`) и сервер (`rules.ts:181`, `bookings.service.ts:895-899`) для выезда ставят «Ждёт подтверждения» без предоплаты.
- **После «Деньги пришли»:** мок уводит запись к мастеру на подтверждение (`confirmAfterPayment`), сервер (`prepaymentReceived`) — сразу в «Записан».
- **Сценарий:** одна и та же запись в демо и в api ведёт себя по-разному: разный статус, разная сумма, разная кнопка в «Заявках».
- **Правка:** решить одно правило (владелец, О6) и привести к нему либо мок (`newBookingStatus` из `booking-policy`), либо сервер.
- **Мелочь рядом:** мок пишет `holdUntil: addMinutes(now, timeoutMin)` без `Math.max(1, …)`, в отличие от `prepaymentHoldUntil` и сервера. При `timeoutMin: 0` запись снимается сразу.

## Низкая важность

### 11. Api: история статусов на странице по ссылке недоступна
- **Где:** `BookingConfirmedScreen.tsx:61` → `getBookingStatusLog` → `online.server.ts:216` `/v1/biz/${biz()}/…`. Без сессии бизнеса `biz()` бросает `forbidden`, и блок истории (F-00-068) в api не показывается никогда.
- **Правка:** публичный `GET /v1/public/bookings/:id/status-log?h=`, либо не запрашивать в api (`enabled: !isApiMode()`).

### 12. React Compiler запоминает `today()`: журнал, открытый через полночь, остаётся во вчерашнем дне
- **Где:** `src/areas/journal/components/ConfirmTomorrowSheet.tsx:36` (`addDays(today(), 1)` и ключ запроса) и `AttentionPanel.tsx:80` (`isToday = date === today()`). Подтверждено прогоном `babel-plugin-react-compiler`.
- **Сценарий:** после 00:00 «Подтвердить завтра» показывает уже наступивший день.
- **Правка:** хук с таймером, как `useNowMinuteYerevan` в `lib/lateness.ts`, или `'use no memo'`.
- Тот же шаблон есть в JournalPhone, DayTimeline, DayOverview, MonthGrid, WeekLoadSheet, DayList и др.

### 13. Api: подтверждённая заявка около секунды висит в «Требует внимания»
- **Где:** `AttentionPanel.tsx:390` → `respondToRequestServer` (`online.server.ts:220`) — ответ не проходит через `keep()`/`mirrorBookings`. Строка исчезает только после SSE `booking.changed` (700 мс и перечитывание). Повторный клик → второй запрос и тост «Не удалось».
- **Правка:** пропускать ответ через `keep()`, как `changeBookingStatus` в `journal.server.ts`.

### 14. Api: повторное напоминание о заявке без ответа работает только в демо
- **Где:** `src/api/journal-offers.ts:301` — в api возвращает `[]`, на сервере задачи нет. Пункт указан в better-than-altegio.
- **Правка:** задача на сервере или честная пометка в docs.

### 15. Мок и api по-разному ведут себя, когда у записи нет телефона (Telegram)
- **Суть:** мок отдаёт ссылку с `linked:false`, сервер — `phone_required`. Карточка прячется, в консоли предупреждение.
- **Где:** `online.ts` `getBookingTelegramLink`, `client.ts` около `:4415`.
- **Правка:** в моке бросать `phone_required`, а карточка молча скрывается по этому коду.

## i18n (online, client, journal, clients, finance, notify)
- **[Средняя] В `messages/hy/client.json` нет 12 ключей из ru.** На армянском эти строки показываются по-русски. Ключи:
  - `bookings.status.confirmation_expired`
  - `bookingDetail.prepaymentDueRow`
  - `bookingDetail.prepaymentRefundPending`
  - `bookingDetail.prepaymentRefunded`
  - `bookingDetail.prepaymentKeptRow`
  - `notifications.kind.confirmation_expired`
  - `profile.telegram.{title,text,linkedText,connect,linked,demoLinked}`
- В остальных пространствах en и hy совпадают с ru. Подстановки `{…}` не теряются. Ключей из кода, которых нет в ru, не найдено.

## Проверено, ошибок нет
- `prepaymentAmount` и `canPayInFull` фронта совпадают с сервером (`rules.ts:191-199`).
- `clientCancelOutcome` совпадает с `cancelByClient` сервера. В ядре мока (`txCancelByClient`) `refundDue` и неявка считаются верно.
- `confirmDeadline`, `holdUntil` и `createdAt` в api приходят местным временем (`utcToLocal`), сравнение строк корректно.
- `nearestFreeStarts` исключает прошедшее и исходное время, не больше 2 окон в день.
- DayNow, FreeTodaySheet, lateness, visitTiming: хуки до раннего `return`, время через `nowYerevan()`/`today()`. `dueAtOf` в моке верен.
