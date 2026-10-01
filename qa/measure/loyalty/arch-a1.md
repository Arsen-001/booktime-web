# Архитектура loyalty · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил).
Раздел ещё заглушка (код фундамента ~10–80 строк), поэтому замечаний к коду нет — ниже то, что уже построено соседями
на вашей территории и что нужно учесть с первого файла, чтобы не завести второй источник правды. Общие правила —
docs/ARCHITECTURE.md и CONVENTIONS.md §16; проверка — `node scripts/arch-check.mjs --area loyalty`.

Первым делом (для всех новых разделов):
- данные среза — по `businessId` (никаких «общих на всех» настроек), ключи — фабрика `loyaltyKeys` с `['loyalty', …]`;
- одна бизнес-операция = одна функция `src/api/loyalty.ts` = один `request()`, внутри без `await coreCreate/updateBooking`;
- правила (суммы, сроки, остатки, статусы) — чистые функции в `src/domain/loyalty.ts`;
- права — `useCan('loyalty.*')` в экране и проверка в api, не `persona ===`;
- записи — `useApiMutation` + try/catch + тост; списки > 100 — фильтр и пагинация в api.

## Что уже есть у соседей (major — договориться до своих типов)

1. **Сертификаты и абонементы завёл раздел clients** — `src/domain/clients.ts:240` `Certificate`, `:251` `Subscription`, сид в
   `src/mock/slices/clients.ts:35–36`, фильтры по ним в `src/areas/clients/lib/filters.ts`. Хозяин этих сущностей — вы.
   Заведите свои типы в `src/domain/loyalty.ts` и функции чтения `listCertificates(businessId, { clientId? })`,
   `listSubscriptions(...)` — clients перейдёт на них (просьба `qa/requests/arch-a1.md` №11). Не копируйте их форму вслепую:
   у clients это «для фильтра», у вас — баланс, списания, срок.
2. **Товары-абонементы/сертификаты в окне записи завёл journal** — `src/domain/journal.ts:79` `GoodsKind = 'product' | 'subscription' | 'certificate'`,
   каталог `goodsCatalog` в срезе journal. Продажа сертификата/абонемента в окне записи — ваш вклад `extensions/BookingWindow.tsx`;
   journal уберёт свои позиции, когда вклад появится.
3. **Скидка клиента** — `ClientProfile.discountPercent` у clients (`src/domain/clients.ts:24`) и скидка по строке у journal
   (`extras.serviceLineExtras.discountPct`). Правило «какая скидка применяется к визиту» — ваше: чистая функция
   `visitDiscount(client, cards, lines)`; вклад в окно записи отдаёт её через `onDraftChange` (просьба №9).
4. Промокоды — у platform (`PromoCode` — промокоды подписки для салонов). Клиентские промокоды/акции — ваши; имя типа
   не `PromoCode`, чтобы не путать (`LoyaltyPromo`).
