"use client";

/** Всплывающая карточка записи по статусу (F-01-029, F-01-078, F-01-214). */
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { Copy } from "lucide-react";
import type { Booking, BookingStatus, Client, Service } from "@/domain/core";
import { changeBookingStatus, listBookings } from "@/api/core";
import {
  ensureAutoWriteoff,
  getBookingExtras,
  instantPayBooking,
  syncArrivedConsequences,
} from "@/api/journal";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { addMinutes } from "@/lib/date";
import { pickText } from "@/lib/text";
import { clientCategories } from "@/areas/journal/lib/categories";
import { isNotFullyPaid } from "@/areas/journal/lib/status";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

export interface BookingHoverCardProps {
  booking: Booking;
  client?: Client;
  services: Service[];
  onChanged?: () => void;
}

const QUICK_STATUSES: { status: BookingStatus; key: string }[] = [
  { status: "scheduled", key: "scheduled" },
  { status: "arrived", key: "arrived" },
  { status: "no_show", key: "no_show" },
  { status: "client_confirmed", key: "client_confirmed" },
];

export function BookingHoverCard({
  booking,
  client,
  services,
  onChanged,
}: BookingHoverCardProps) {
  const t = useT("journal");
  const tc = useT("common");
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const locale = useLocale();
  const toast = useToast();
  const setStatus = useApiMutation(
    ({ id, status }: { id: string; status: BookingStatus }) =>
      changeBookingStatus(id, status, "business"),
  );
  const payMutation = useApiMutation(
    ({ id, total, method }: { id: string; total: number; method: "cash" | "card" }) =>
      instantPayBooking(id, total, method),
  );
  const clientId = client?.id;
  const history = useApiQuery(
    ["journal", "client-history", clientId],
    () => listBookings({ clientId: clientId ?? "", statuses: ["arrived"] }),
    { enabled: Boolean(clientId) },
  );
  const extrasQuery = useApiQuery(
    ["journal", "extras", booking.id],
    () => getBookingExtras(booking.id),
    {},
  );
  // F-01-080: списывается «в момент начала записи» — считаем один раз при показе карточки (идемпотентно).
  useEffect(() => {
    ensureAutoWriteoff(booking.id).catch(() => {});
  }, [booking.id]);
  const categories = clientCategories(client?.tags);
  const visitsCount = history.data?.length ?? 0;
  const spent = history.data?.reduce((sum, b) => sum + b.total, 0) ?? 0;
  const notFullyPaid = isNotFullyPaid(
    booking.status,
    booking.total,
    extrasQuery.data?.paidAmount ?? 0,
  );

  // F-01-077: меняется сразу, без «Сохранить» — тост подтверждает
  const changeStatus = async (status: BookingStatus) => {
    try {
      await setStatus.mutate({ id: booking.id, status });
      // F-01-081: последствия «Клиент пришёл» (демо-списание расходников) — тоже входя/выходя через
      // быструю смену статуса из карточки, не только из окна записи.
      if (status === "arrived" || booking.status === "arrived") {
        await syncArrivedConsequences(booking.id, status);
      }
      toast.success(t("hoverCard.statusChanged"));
      onChanged?.();
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  // F-01-141: закрывает оплату всей суммы в один клик, не открывая окно; у «Не пришёл» — недоступно
  // «Банковские карты» — способ «карта» и касса карты (раньше обе кнопки проводили наличными)
  const payInstant = async (method: "cash" | "card") => {
    try {
      await payMutation.mutate({ id: booking.id, total: booking.total, method });
      if (
        booking.status === "scheduled" ||
        booking.status === "awaiting_confirmation"
      ) {
        await setStatus.mutate({ id: booking.id, status: "arrived" });
        await syncArrivedConsequences(booking.id, "arrived");
      }
      toast.success(t("hoverCard.paid"));
      onChanged?.();
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  const copyPhone = async () => {
    if (!client?.phone) return;
    try {
      await navigator.clipboard.writeText(client.phone);
      toast.success(tc("states.copied"));
    } catch {
      // буфер обмена недоступен — тихо игнорируем
    }
  };

  return (
    <div
      data-f="F-01-029 F-01-077 F-01-078 F-01-214 F-04-101"
      // Карточка рендерится в портал Popover: React пробрасывает клик по её дереву компонентов
      // (BookingHoverCard → BookingBlock → колонка сетки), а не по фактическому DOM-родителю —
      // без остановки здесь клик по кнопке статуса «протекал» в клик по ячейке сетки под записью
      // и открывал лишнее окно «Новая запись» поверх только что закрытого popover (F-01-029, major).
      onClick={(e) => e.stopPropagation()}
      className="flex w-72 max-w-full flex-col gap-3 p-1"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">
            {client?.name || booking.visitorName || t("block.noClient")}
          </p>
          {client?.phone && (
            <button
              type="button"
              onClick={copyPhone}
              className="flex items-center gap-1 text-sm text-muted hover:text-fg"
            >
              {format.phone(client.phone)}
              <Copy aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {categories.map((c) => (
              <Badge key={c.match} tone={c.tone} size="sm">
                {t(`categories.${c.labelKey}`)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {client && (
        <p className="text-sm text-muted">
          {t("hoverCard.stats", {
            visits: visitsCount,
            noShow: client.noShowCount,
            spent: format.money(spent),
          })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_STATUSES.map((q) => (
          <Button
            key={q.status}
            type="button"
            size="sm"
            variant={booking.status === q.status ? "primary" : "outline"}
            loading={setStatus.isPending}
            onClick={() => changeStatus(q.status)}
          >
            {tc(`bookingStatus.${q.status}`)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {t("hoverCard.services")}
        </p>
        {booking.services.length === 0 && (
          <p className="text-sm text-muted">{t("block.noService")}</p>
        )}
        {booking.services.map((line, i) => {
          const service = services.find((s) => s.id === line.serviceId);
          return (
            <div
              key={`${line.serviceId}-${i}`}
              className="flex justify-between text-sm"
            >
              <span className="truncate">
                {service ? pickText(service.name, locale) : t("block.service")}
              </span>
              <span className="shrink-0 text-muted">
                {format.money(line.price * line.qty)}
              </span>
            </div>
          );
        })}
        <div className="flex justify-between border-t border-border pt-1 text-sm font-semibold">
          <span>{t("hoverCard.total")}</span>
          <span>{format.money(booking.total)}</span>
        </div>
        {notFullyPaid && (
          <Badge
            data-f="F-01-079"
            tone="warning"
            size="sm"
            className="self-start"
          >
            {t("hoverCard.notFullyPaid")}
          </Badge>
        )}
        {extrasQuery.data?.autoWriteoff && (
          <Badge
            data-f="F-01-080"
            tone={
              extrasQuery.data.autoWriteoff.status === "written_off"
                ? "success"
                : "warning"
            }
            size="sm"
            className="self-start"
          >
            {t(
              extrasQuery.data.autoWriteoff.status === "written_off"
                ? "window.autoWriteoff.written"
                : "window.autoWriteoff.notWritten",
            )}
          </Badge>
        )}
        {extrasQuery.data?.consumablesDeducted && (
          <Badge data-f="F-01-081" tone="info" size="sm" className="self-start">
            {t("window.consumablesDeducted")}
          </Badge>
        )}
      </div>

      <div data-f="F-01-141 F-07-044" className="flex flex-col gap-1">
        <p className="text-xs text-muted">{t("hoverCard.instantPayHint")}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={payMutation.isPending}
            disabled={booking.status === "no_show"}
            onClick={() => void payInstant("cash")}
          >
            {t("hoverCard.cash")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={payMutation.isPending}
            disabled={booking.status === "no_show"}
            onClick={() => void payInstant("card")}
          >
            {t("hoverCard.card")}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted">
        {t("hoverCard.details", {
          time: `${format.time(booking.start)}–${format.time(addMinutes(booking.start, booking.durationMin))}`,
          duration: format.duration(booking.durationMin),
        })}
      </p>
    </div>
  );
}
