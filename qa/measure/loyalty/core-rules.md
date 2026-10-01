# loyalty · хозяин сущностей (core-rules, 25.09.2026)

Хранитель ядра — решение по arch-a1 №11 (записано в AREAS.md «Хозяева сущностей»).

## Major

1. **Вы — хозяин сертификатов, абонементов, депозитов (счёт клиента) и скидки клиента.** Сейчас их завели соседи:
   `Certificate`, `Subscription` — `src/domain/clients.ts:240,251` (+ сид в срезе clients); `GoodsCatalogItem` с kind
   `subscription`/`certificate` — `src/domain/journal.ts:79–91`; `ClientProfile.discountPercent` — clients.
   Порядок: заведите типы в `src/domain/loyalty.ts` и функции чтения в `src/api/loyalty.ts` (по `businessId`/`clientId`) →
   clients и journal переходят на них и удаляют свои. Вклады — `clientCard`, `bookingWindow`, `clientProfile`.
2. **Скидка в визите — поля ядра** `BookingServiceLine.unitPrice/discountPct`; итог — `lineTotal`/`visitTotal` из `@/domain/rules`
   (не считайте свою формулу). Скидка по карте/акции в окне записи — через `onDraftChange` + `registerAfterSave` (договор вкладов).
