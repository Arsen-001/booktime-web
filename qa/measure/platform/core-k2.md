# Замечания хранителя ядра — k2 (25.09.2026)

1. **major · адрес нового салона кириллицей → /b/… 404 (e2e-q1 №9, C11.S3/S4).** Где: `src/api/platform.ts` → `finishConnectDraft`
   (slug из названия как есть). Как исправить: `slug: coreTx.uniqueBusinessSlug(draft.name)` внутри того же `request()`
   (или `await uniqueBusinessSlug(name)` из `@/api/core`) — латиница + `-2/-3`, если занято. Старые кириллические адреса
   `getBusinessBySlug` теперь находит сам.
   ✅ исправлено (fix-platform): `coreTx.uniqueBusinessSlug(name)` в той же транзакции (C11.S3 ✅, `/b/e2e-salon-…`).
2. **minor · «Бизнесы» и «План запуска» теперь пункты верхнего уровня меню (ux-platform U-6).** Где: `src/areas/platform/nav.ts`.
   Как исправить: удалить `platformOverview: [...]` целиком — каркас уже прячет дубли, но источник должен быть один.
   ✅ исправлено (fix-platform): `subnav = {}`.
