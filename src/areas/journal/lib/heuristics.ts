/**
 * Допущения, которых нет явно в ядре (см. assumed в отчёте):
 *  - «new» у записи — клиент создан в тот же день, что и первая запись (Client не хранит признак «новый»).
 */
import type { Booking, Client } from "@/domain/core";

export function isNewClientBooking(
  client: Client | undefined,
  booking: Booking,
): boolean {
  if (!client) return false;
  return (
    client.createdAt.slice(0, 10) === booking.createdAt.slice(0, 10) &&
    booking.status !== "no_show"
  );
}
