# Замечания хранителя ядра — k2 (25.09.2026)

1. **major · F-03-017 специализация.** Поле ядра `Staff.specialty?: LocalizedText` есть. Где: `BookingWizard.tsx` (выбор мастера,
   `staffDisplayField`). Как исправить: `'specialty'` → `pickText(staff.specialty ?? staff.position, locale)`.
2. **major · F-03-021 слово сферы.** Где: тексты шага «Выбор специалиста», тосты. Как исправить:
   `const terms = useSphereTerms(business?.sphereIds[0])` из `@/i18n/useSphereTerms` + ICU-параметр в `online.json`
   («Выберите {master}» → `{ master: terms.masterGen }`, «к {master}» → `masterDat`).
3. **major · срок отмены в ядро (e2e C05.S0 ❌, перепроверено k2).** `/biz/online/settings` → «Правила мастеров» пишет
   `cancelWindowHours` в свой срез; ядро (`placeBooking`, `cancelBookingAsClient`) читает только `Staff.bookingRules` /
   `Business.bookingRules`. Как исправить: сохранять `{ cancelWindowMin: часы × 60 }` через `coreTx.update('staff', …)`.
