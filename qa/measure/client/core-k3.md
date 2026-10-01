# Замечания хранителя ядра · k3 (25.09.2026)

1. **block · Деньги у клиента выдуманы** (e2e-q2 №5, C01.S18) — `getBookingPaymentBreakdown` в `src/api/client.ts` рисует «Списано
   с сертификата», «Оплачено», кэшбэк и товар по хэшу id записи. Как исправить: пока finance/stock/loyalty не отдают данные —
   показывать только `booking.total` («К оплате»), без строк оплат, списаний и товаров.
2. **major · Запись, отмена, перенос, снятие неоплаченных — через команды ядра** (e2e-q2 №1, C01.S6, C03.S7, C05.S2):
   `bookAppointment` → `placeBooking`, `cancelBookingByClient` → `cancelBookingAsClient`, `rescheduleBookingByClient` →
   `rescheduleBookingAsClient`, свой `releaseExpiredPrepayments` → ядра. Удалить из среза `cancelWindowHours`, `prepaymentDeadline`,
   `prepaymentPolicy`. Снятая по сроку запись — `booking.cancelReason === 'prepayment_expired'` → текст
   `common.bookingCancelReason.prepayment_expired`, а не «Отменена вами».
3. **major · Уведомления о записях — из ядра** (e2e-q2 №3б, schedule F-00-059): `listClientEvents(appUserId)` из `@/api/core` — салон
   подтвердил/отменил/перенёс/удалил, мастер задерживается (`kind: 'delayed'`, `delayMin`). Свои копии «уведомлений о записи»
   заменить чтением отсюда; слова — в `client.json`.
4. **major · Кто виден в «Мастерах» места** (e2e-q2 №6): фильтровать через `isStaffInCatalog` / `isStaffBookableOnline` из
   `@/domain/rules` — администратор без услуг выпадет сам.
5. **major · «От клиента салону»** (e2e-q2 №4): просьба перезвонить → notify, спрос → `reportSearchDemand` (platform), абонементы и
   сертификаты → loyalty, лист ожидания → resources — звать их api, свои копии в срезе удалить по мере появления.
6. **minor · Вход** (e2e-q2 №9): после входа гостя — `apply({ persona: 'client', appUser: user.id })` (демо d1).
7. **minor · Рассылки notify в ленте** (notify g1-1): читайте `readArea('notify').mailings` (получатели — `recipientClientIds`) в своей
   api-функции — ядро для этого не нужно.
8. **minor · Массивы в словарях снова переводятся** (`src/i18n/load.ts`): обход с нумерованными ключами можно оставить.
