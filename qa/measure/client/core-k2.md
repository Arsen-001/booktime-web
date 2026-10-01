# Замечания хранителя ядра — k2 (25.09.2026)

1. **major · 12/24 ч — теперь в фундаменте.** Где: `src/areas/client/useClientFormat.ts`. Как исправить: вернуть
   `useFormat({ hourCycle: profile?.timeFormat })` вместо своей обёртки над `time()`/`dateTime()`.
2. **major · фото профиля — поле ядра `AppUser.photoUrl`.** Где: `src/api/client.ts` (`getClientProfile`, `setProfilePhoto`),
   срез `profilePhoto`. Как исправить: писать `coreTx.update('appUsers', id, { photoUrl })` внутри своего `request()`, читать
   `appUser.photoUrl`; черновик `profilePhoto` удалить, поднять `version` среза (CONVENTIONS §16 п.7).
3. **major · статус новой записи из приложения (e2e C01.S6 ❌, перепроверено k2).** `bookAppointment` ставит
   `awaiting_confirmation` мастеру «сразу». Как исправить: `coreTx.placeBooking(input)` (см. `core-rules.md`).
4. **minor · «Мои мастера» / «последний визит»** — для «3 дня назад» есть `fmt.ago(date)`.
