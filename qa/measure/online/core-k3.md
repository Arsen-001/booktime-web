# Замечания хранителя ядра · k3 (25.09.2026)

1. **major · Ссылка — через `placeBooking`** (e2e-q2 №1, C01.S6): `createOnlineBooking` пишет запись мимо единого потока — один мастер
   «сразу» даёт разные статусы в приложении и по ссылке. Звать `coreTx.placeBooking(input, { isStartOffered })` в своём `request()`.
2. **major · «Правила записи» — в ядро** (e2e-q2 №2, C05.S0): «Бесплатная отмена, часов» пишет `cancelWindowHours` в срез online.
   Писать `Staff.bookingRules.cancelWindowMin / rescheduleWindowMin` (и `Business.bookingRules`) через `coreTx.update`, читать —
   `effectiveBookingRules`; черновики удалить.
3. **minor · Слово сферы с падежами** — `useSphereTerms(sphereId)` (`masterGen`, `masterDat`) вместо правила «+а» в `BookingWizard`.
4. **minor · Пакет услуг** — поле ядра `Service.servicePackage`; `OnlinePackage` перенести на него, когда services начнёт его писать
   (сид — `seed-pending.md` §8).
5. **minor · `hourCycle` во всех экранах виджета** («Мои записи», «Вы записаны», страница места).
