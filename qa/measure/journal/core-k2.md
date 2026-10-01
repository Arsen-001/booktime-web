# Замечания хранителя ядра — k2 (25.09.2026)

1. **minor · вклады-заглушки больше не приходят из `useExtensions`** — окно записи показывает только построенные вклады
   (сейчас clients, online). Своих фильтров заглушек не нужно.
2. **minor · ваш вклад в карточку клиента подписан «Записи»** (`common.ext.clientCard.journal`), чтобы не повторять «Историю
   визитов» clients; вкладка появится, когда `src/areas/journal/extensions/ClientCard.tsx` перестанет рисовать `<ExtensionStub>`.
3. **minor · статус «Отменил врач/тренер» по сфере:** подпись — `bookingStatusLabelKey(status, sphere)` из `@/i18n/useSphereTerms`
   (в фильтре статусов тоже).
