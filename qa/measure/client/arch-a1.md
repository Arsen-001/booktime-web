# Архитектура client · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил). Мерка — docs/ARCHITECTURE.md и CONVENTIONS.md §16.
Сторож: `node scripts/arch-check.mjs --area client` → 0 error, 38 warn (A12:15, A14:10, A11:6, A13:2, A16:2, A8:1, A9:1, A10:1).
Номера строк — на момент ревью.

Хорошо: экраны не лезут в стор, api возвращает «собранные» карточки (`getMasterCard`, `getPlaceCard`, `getBooking`),
поиск с задержкой 250 мс.

## Major

1. **Черновики в срезе стали вторым источником правды** — `src/mock/slices/client.ts` (`ClientState`): `businessSocials`,
   `shadeRequirement`, `cancelWindowHours`, `prepaymentPolicy`. В ядре (k1) уже есть `Business.socials`, `Service.shadeChoice`,
   `Staff.prepayment`, `Business.bookingRules.cancelWindowMin` — и ни одно из этих полей не читается ни в одном разделе.
   Салон настроит «отмена за 6 ч» в online — приложение клиента продолжит считать по своим 2–24 ч.
   Как: читать поля ядра; черновики из среза удалить, `version` поднять; типы `BusinessSocials`, `PrepaymentPolicy`,
   `ShadeRequirement` из `src/domain/client.ts` удалить (есть `SocialLinks`, `PrepaymentRule`, `Service['shadeChoice']`).

2. **Правило отмены клиентом расходится с online** — `src/api/client.ts:697` `cancelBookingByClient`: срок по умолчанию 24 ч,
   поздняя отмена → статус `no_show` (до визита!). В `src/api/online.ts:589` та же отмена: срок 3 ч, статус `cancelled_by_client`
   и `noShowCount + 1`. Один и тот же клиент получает разный результат в зависимости от того, откуда нажал.
   Как: одно правило `clientCancelOutcome(booking, rules, now)` в `domain/rules/booking-policy.ts` (просьба `arch-a1` №3) и
   одна команда отмены; до неё — повторить поведение online (статус `cancelled_by_client` + счётчик), не ставить `no_show`.

3. **Запись из приложения — не транзакция и мимо `request()`** — `src/api/client.ts:400` `bookAppointment`:
   `readCore()` в первой строке до `await dbReady()` (на холодном заходе ядро пустое → `staff_not_found`), проверка окна и
   создание — два разных запроса (окно успеют занять между ними), хвост `mutateArea('client', …)` (`:452`) — вне `request()`
   (не падает в `?api=error`, не ждёт базу). Ошибки — `new Error('slot_taken')`, а не `ApiError` — код не доходит до экрана.
   То же в `releaseExpiredPrepayments` (`:565`), `markPrepaymentPaid` (`:676`), `notifyWaitlist` (`:687`), `verifyLoginCode` (`:359`).
   Как: всё тело — в одном `request()`, внутри — синхронные функции ядра (просьба `arch-a1` №1), `throw new ApiError(code)`.

4. **Статус новой записи игнорирует настройку мастера** — `bookAppointment` всегда `awaiting_confirmation`, а online
   (`src/api/online.ts:326`) смотрит `confirmMode` и выезд. Не проверяются пауза, «в отпуске», блокировка клиента,
   `Staff.onlineBookingEnabled`. Как: общий `newBookingStatus(staff, workplace, …)` + общий `canBookOnline(...)` —
   `domain/rules/booking-policy.ts` (просьба №3); лучше — одна команда создания онлайн-записи для приложения и виджета (№4).

5. **Два мастера записи на одно действие** — `book/BookScreen.tsx` (665 строк, 5 компонентов) и
   `src/areas/online/booking/BookingWizard.tsx` (1003 строки): шаги услуга → мастер → время → данные повторены, вход по коду —
   ещё третьей реализацией в `login/LoginScreen.tsx`. Любое правило (оттенок, для кого, предоплата) надо чинить в двух местах.
   Как: решение через хранителя ядра — общий модуль шагов (просьба №4); до решения не добавлять в `BookScreen` шаги,
   которые уже есть у виджета.

6. **Клиенту уходят приватные поля** — `listCatalog`, `getMasterCard`, `getPlaceCard` возвращают `Staff`/`Business` целиком:
   телефон мастера, `homeAddress` (по ТЗ — только после подтверждённой записи, F-00-077), `login`, `callHours`. На сервере это
   утечка. Как: DTO `PublicStaff` / `PublicBusiness` в `src/domain/client.ts` и проекция в api; экраны берут только их.

7. **Каталог не учитывает модерацию** — `isVisibleToClients` (platform) не вызывается: неодобренные фото/услуги видны.
   Правило видимости мастера написано третий раз (`src/api/client.ts:113–125`; ещё `isStaffOnlineVisible` и `isListable` в online).
   Как: общий `isStaffBookableOnline(core, staff)` (просьба №5) + фильтр модерации внутри `listCatalog`.

8. **Дата по UTC** — `bookings/BookingDetailScreen.tsx:69` `new Date().toISOString().slice(0,16)` сравнивается с ереванским
   временем: «можно отменить бесплатно» врёт на 4 часа. Как: `nowDateTime()` из `@/lib/date`; а лучше — флаг `canCancelFree`
   из api (решение сервера, а не часов телефона).

## Minor

9. Ключи запросов без префикса раздела (15): `['booking-days', …]`, `['master-card', …]`, `['my-bookings', …]`, `['search', query]`
   (объект в ключе) … → `['client', 'masterCard', staffId]`, фабрика `clientKeys`. `['home-nearby']` без параметров.
10. `STATUS_TONE` дважды внутри раздела (`bookings/BookingCard.tsx:15`, `bookings/BookingDetailScreen.tsx:24`) и свой список
    «неактивных» статусов (`BookingDetailScreen.tsx:68`, `src/api/client.ts:591`) → общий `BookingStatusBadge` / `isActiveBooking` (№6, №2).
11. `masters/MasterCardScreen.tsx:81` — `await getNearestSlots(...)` в обработчике мимо `useApiQuery`; копирование в буфер
    своё в 3 файлах (`MasterCardScreen:36`, `PlaceCardScreen:62`, `BookingDetailScreen:110`) → `@/lib/clipboard` (№7).
12. 10 файлов с несколькими компонентами (`BookScreen` 5, `HomeScreen` 5, `MasterCardScreen` 4, `BookingsScreen` 4 …) —
    вынести шаги и секции в свои файлы.
13. `home/HomeScreen.tsx:55` `persona === 'guest'` → `!appUserId` из `useCurrent()`.
14. `listCatalog` на каждый запрос считает 14 дней × все мастера × все записи. Для мока терпимо; на сервере — кэш
    доступности (docs/backend/04-free-slots.md). Не добавлять в каталог новые расчёты «на лету».
