"use client";

/**
 * Окно сохранённой записи → блок «Посетитель» (F-01-129): у сохранённой записи с посетителем —
 * его история визитов. «Удалить» снимает посетителя из ЭТОЙ записи, карточку клиента не трогает
 * (посетитель не отдельная сущность — F-01-127).
 */
import { Trash2, Users } from "lucide-react";
import type { Id } from "@/domain/core";
import { getVisitorHistory } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { useCan } from "@/demo/hooks";
import { IconButton } from "@/ui/IconButton";
import { Skeleton } from "@/ui/Skeleton";

export interface VisitorBlockProps {
  clientId: Id;
  visitorName: string;
  onRemove: () => void;
}

export function VisitorBlock({
  clientId,
  visitorName,
  onRemove,
}: VisitorBlockProps) {
  const t = useT("journal");
  const tc = useT("common");
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const canEdit = useCan("journal.edit");
  const query = useApiQuery(
    ["journal", "visitor-history", clientId, visitorName],
    () => getVisitorHistory(clientId, visitorName),
    {},
  );

  return (
    <div
      data-f="F-01-129"
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users aria-hidden className="size-4 text-muted" />
          <p className="text-sm font-medium text-fg">
            {t("window.right.visitorBlockTitle")} — {visitorName}
          </p>
        </div>
        {canEdit && (
          <IconButton
            icon={<Trash2 aria-hidden />}
            label={tc("actions.delete")}
            size="sm"
            onClick={onRemove}
          />
        )}
      </div>
      {query.isLoading ? (
        <Skeleton lines={2} />
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-xs text-muted">
          {t("window.right.visitorHistoryEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs text-muted">
          {query.data.slice(0, 5).map((v) => (
            <li key={v.bookingId}>
              {format.date(v.start.slice(0, 10), "short")},{" "}
              {format.time(v.start)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
