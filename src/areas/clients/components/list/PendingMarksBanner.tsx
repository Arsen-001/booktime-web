'use client';

/**
 * Напоминание о забытой отметке «пришёл / не пришёл» (F-00-127) прямо на «Клиентах» — экран, на который
 * администратор заходит чаще всего. Полноценного уведомления (пуш/колокольчик) пока нет — раздел notify
 * ещё не отдаёт `listInboxPreview`/произвольные типы для сторонних разделов (заявка — qa/requests/clients.md,
 * qa/requests/notify.md); до неё это ближайшее место, откуда отметка ставится в 1 нажатие без перехода
 * на отдельный экран «Сводка».
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { listPendingMarks } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { PendingMarkRow } from '@/areas/clients/components/summary/PendingMarkRow';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';

const COLLAPSED_ROWS = 2;

export function PendingMarksBanner({ businessId }: { businessId: Id }) {
  const t = useT('clients');
  const [expanded, setExpanded] = useState(false);
  const pendingQ = useApiQuery(['clients', 'pendingMarks', businessId], () => listPendingMarks(businessId));
  const rows = pendingQ.data ?? [];
  if (pendingQ.isLoading || pendingQ.isError || rows.length === 0) return null;

  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = rows.length - visible.length;

  return (
    <div data-f="F-00-127" className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck aria-hidden className="size-5 shrink-0 text-fg" />
        <p className="text-sm font-semibold text-fg">{t('list.pendingBanner.title', { count: rows.length })}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {visible.map((m) => (
          <PendingMarkRow key={m.bookingId} mark={m} />
        ))}
      </ul>
      {rows.length > COLLAPSED_ROWS && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          rightIcon={expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('list.pendingBanner.collapse') : t('list.pendingBanner.showMore', { count: hiddenCount })}
        </Button>
      )}
    </div>
  );
}
