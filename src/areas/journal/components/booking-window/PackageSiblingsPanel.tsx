"use client";

/**
 * Окно записи → блок «Связанные записи» пакета (F-01-113, F-01-134…136): список остальных
 * мастеров того же пакетного визита. Открыть соседнюю запись = сохранить и переоткрыть окно на её id.
 */
import { Link2 } from "lucide-react";
import type { Id } from "@/domain/core";
import { getPackageSiblings } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { Badge } from "@/ui/Badge";

export interface PackageSiblingsPanelProps {
  bookingId: Id;
  onOpenSibling: (bookingId: Id) => void;
}

export function PackageSiblingsPanel({
  bookingId,
  onOpenSibling,
}: PackageSiblingsPanelProps) {
  const t = useT("journal");
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const query = useApiQuery(
    ["journal", "package-siblings", bookingId],
    () => getPackageSiblings(bookingId),
    {},
  );

  if (!query.data || query.data.length === 0) return null;

  return (
    <div
      data-f="F-01-113 F-01-134 F-01-136 F-16-127"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-3"
    >
      <div className="flex items-center gap-2">
        <Link2 aria-hidden className="size-4 text-muted" />
        <p className="text-sm font-medium text-fg">
          {t("window.package.siblingsTitle")}
        </p>
        <Badge tone="accent" size="sm">
          {t("window.package.badge")}
        </Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {query.data.map(({ booking, staffName }) => (
          <li key={booking.id}>
            <button
              type="button"
              onClick={() => onOpenSibling(booking.id)}
              className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface-3"
            >
              <span className="truncate font-medium text-fg">{staffName}</span>
              <span className="shrink-0 text-muted">
                {format.time(booking.start)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
