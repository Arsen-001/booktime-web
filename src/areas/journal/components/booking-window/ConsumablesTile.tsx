"use client";

/**
 * Плитка «Списание расходников» окна записи (F-01-147…149, F-01-081).
 *
 * Раньше здесь была демо-отметка (`extras.consumablesDeducted: boolean`) — комментарий у неё
 * прямо говорил «раздел «Склад» ещё не построен, `src/domain/stock.ts` пуст». Это устарело: склад
 * уже построил настоящий движок техкарт и автосписания (`@/api/stock`, F-08-036…045) и сам ждёт,
 * что журнал станет его звать при открытии визита — «просьбы к journal не нужно (план b03)»
 * (комментарий у `ensureAutoWriteoffs`). Эта плитка — та самая связь: реальная складская операция
 * вместо булевого флага.
 *
 * F-01-148: «Клиент пришёл» синхронизирует автосписание (idempotent `ensureAutoWriteoffs`),
 * возврат в другой статус или удаление визита откатывает его — это уже делает сам `ensureAutoWriteoffs`
 * по каждому вызову (сверяет со статусом ядра), поэтому отдельного отката с нашей стороны не нужно.
 * F-01-149: список технокарт услуги (`listTechCardsForService`) — выбор карты ДРУГОГО мастера для
 * этого конкретного визита пересчитывает расходники этой строки (снимаем старые строки, добавляем
 * новые через `addBookingConsumableLine`/`removeBookingConsumableLine`). Выбор запоминается в своих
 * `extras.techCardOverrides` (по индексу строки услуги) — своих полей в ядре и в `stock` для этого нет.
 */
import { useState } from "react";
import { Beaker } from "lucide-react";
import type { Id } from "@/domain/core";
import type { BookingServiceLine } from "@/domain/core";
import {
  addBookingConsumableLine,
  getBookingConsumables,
  getBookingConsumablesByService,
  listTechCardsForService,
  removeBookingConsumableLine,
  type TechCardRow,
} from "@/api/stock";
import { setBookingExtras } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useCan } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Badge } from "@/ui/Badge";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";
import { runBusy } from "@/areas/journal/lib/tasks";

export interface ConsumablesTileProps {
  businessId: Id;
  locationId: Id;
  bookingId: Id;
  status: string;
  services: BookingServiceLine[];
  techCardOverrides?: Record<number, Id>;
}

export function ConsumablesTile({
  businessId,
  locationId,
  bookingId,
  status,
  services,
  techCardOverrides,
}: ConsumablesTileProps) {
  const t = useT("journal");
  const format = useFormat();
  const toast = useToast();
  const canView = useCan("stock.view");
  const canEdit = useCan("stock.edit");

  // F-01-148: документ автосписания синхронизирует со статусом визита само чтение getBookingConsumables
  // (склад, Ск1: единая синхронизация внутри каждого чтения остатков) — отдельный вызов не нужен.

  const consumablesQuery = useApiQuery(
    ["stock", "booking-consumables", bookingId, status],
    () => getBookingConsumables(businessId, bookingId),
    { enabled: canView },
  );
  const byServiceQuery = useApiQuery(
    ["stock", "booking-consumables-by-service", bookingId, status],
    () => getBookingConsumablesByService(businessId, bookingId),
    { enabled: canView },
  );

  if (!canView) return null;

  const lines = consumablesQuery.data?.lines ?? [];
  const totalCost = lines.reduce((sum, l) => sum + Math.abs(l.costTotal), 0);

  return (
    <div
      data-f="F-01-147 F-01-148 F-01-149"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-3"
    >
      <div className="flex items-center gap-2">
        <Beaker aria-hidden className="size-4 text-muted" />
        <span className="text-sm font-medium text-fg">
          {t("window.consumables.title")}
        </span>
        {lines.length > 0 && (
          <Badge tone="info" size="sm" className="ml-auto">
            {format.money(totalCost)}
          </Badge>
        )}
      </div>

      {consumablesQuery.isLoading || byServiceQuery.isLoading ? (
        <Skeleton lines={2} />
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted">{t("window.consumables.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lines.map((line) => (
            <li
              key={line.goodId}
              className="flex items-center justify-between gap-2 text-xs text-muted"
            >
              <span className="min-w-0 truncate">{line.goodName}</span>
              {/* Ск13: в единицах списания («10 мл»), а не доля единицы продажи с подписью «мл» */}
              <span className="shrink-0 tabular-nums">
                {String(Math.round(line.qtyWriteoff * 100) / 100).replace(".", ",")} {line.unitShort}
              </span>
            </li>
          ))}
        </ul>
      )}

      {status === "arrived" && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {services.map((line, index) => (
            <TechCardRowPicker
              key={`${line.serviceId}-${index}`}
              businessId={businessId}
              locationId={locationId}
              bookingId={bookingId}
              serviceLine={line}
              lineIndex={index}
              selectedId={techCardOverrides?.[index]}
              allOverrides={techCardOverrides}
              canEdit={canEdit}
              byServiceLine={byServiceQuery.data?.[index]}
              onChanged={() => {
                consumablesQuery.refetch();
                byServiceQuery.refetch();
              }}
              onError={() => toast.error(t("window.consumables.applyFailed"))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TechCardRowPicker({
  businessId,
  locationId,
  bookingId,
  serviceLine,
  lineIndex,
  selectedId,
  allOverrides,
  canEdit,
  byServiceLine,
  onChanged,
  onError,
}: {
  businessId: Id;
  locationId: Id;
  bookingId: Id;
  serviceLine: BookingServiceLine;
  lineIndex: number;
  selectedId?: Id;
  allOverrides?: Record<number, Id>;
  canEdit: boolean;
  byServiceLine?: { serviceName: string; goods: { goodId: Id; goodName: string; qtyWriteoff: number }[] };
  onChanged: () => void;
  onError: () => void;
}) {
  const t = useT("journal");
  const [applying, setApplying] = useState(false);
  const cardsQuery = useApiQuery(
    ["stock", "tech-cards-for-service", serviceLine.serviceId],
    () => listTechCardsForService(businessId, serviceLine.serviceId),
    { enabled: canEdit },
  );
  if (!canEdit) return null;

  const cards = cardsQuery.data ?? [];
  const current =
    cards.find((c) => c.id === selectedId) ??
    cards.find((c) => c.staffId === serviceLine.staffId);

  async function applyCard(card: TechCardRow | undefined) {
    // try…finally — в runBusy: в теле компонента React Compiler его не компилирует
    await runBusy(setApplying, async () => {
      // Снять текущие ручные строки этой услуги перед применением другой техкарты (F-01-149:
      // «смена техкарты в визите пересчитывает расходники этой услуги»).
      const prevGoods = byServiceLine?.goods ?? [];
      for (const g of prevGoods) {
        await removeBookingConsumableLine(businessId, bookingId, g.goodId);
      }
      if (card) {
        for (const l of card.lines) {
          await addBookingConsumableLine(
            businessId,
            locationId,
            bookingId,
            l.goodId,
            l.qtyWriteoff * serviceLine.qty,
          );
        }
      }
      const nextOverrides = { ...allOverrides };
      if (card) nextOverrides[lineIndex] = card.id;
      else delete nextOverrides[lineIndex];
      await setBookingExtras(bookingId, { techCardOverrides: nextOverrides });
      onChanged();
    }, () => onError());
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-muted">
        {byServiceLine?.serviceName ?? t("window.consumables.techCard")}
      </span>
      <Select
        size="sm"
        disabled={applying || cardsQuery.isLoading}
        value={current?.id ?? ""}
        onValueChange={(v) => applyCard(cards.find((c) => c.id === v))}
        placeholder={t("window.consumables.techCardNone")}
        options={cards.map((c) => ({
          value: c.id,
          label: `${c.staffName} · ${c.lineDetails.length ? c.lineDetails[0].goodName : ""}`,
        }))}
      />
    </div>
  );
}
