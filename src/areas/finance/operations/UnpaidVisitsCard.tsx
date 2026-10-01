'use client';

/**
 * «Пришли, но не оплатили» (fin-review Ф20) — визиты «Клиент пришёл» за 2 недели, по которым касса получила меньше
 * суммы визита. Свёрнута в одну строку «N визитов · сумма»; раскрывается списком со ссылкой на запись в журнале.
 * Нет таких визитов — блока нет (не пустая карточка на рабочем экране).
 */
import { useId, useState } from 'react';
import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { listUnpaidVisits } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Collapse } from '@/ui/Collapse';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

const SHOWN = 10;

export function UnpaidVisitsCard({ businessId, activeLocationIds, ready }: { businessId?: string; activeLocationIds: string[]; ready: boolean }) {
  const t = useT('finance');
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const q = useApiQuery(['finance', 'unpaidVisits', businessId, activeLocationIds.join(',')], () => listUnpaidVisits(businessId!, activeLocationIds), {
    enabled: ready && Boolean(businessId),
  });
  const rows = q.data ?? [];
  // Место держим, пока не знаем ответа: блок не выпрыгивает над списком операций (fin-review М1)
  if (!q.data && !q.isError)
    return (
      // Та же свёрнутая строка «N визитов · сумма» (так почти всегда в демо), вместо чисел — серые места
      <div aria-busy className="rounded-2xl border border-warning/40 bg-warning-soft/40">
        <div className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5">
          <span className="flex min-w-0 items-center gap-3">
            <CircleAlert aria-hidden className="size-5 shrink-0 text-warning" />
            {/* На телефоне «N визитов пришли, но не оплатили · сумма» — в две строки, шире — в одну */}
            <span className="min-w-0 flex-1 text-sm">
              <span className="block sm:hidden">
                <Skeleton lines={2} />
              </span>
              <span className="hidden sm:inline">
                <SkeletonText width="40ch" />
              </span>
            </span>
          </span>
          <DropdownChevron open={false} />
        </div>
      </div>
    );
  if (rows.length === 0) return null;
  const totalDue = rows.reduce((sum, r) => sum + r.due, 0);

  return (
    <div data-f="F-07-045 F-07-057" className="rounded-2xl border border-warning/40 bg-warning-soft/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 hover:bg-warning-soft/60 sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <CircleAlert aria-hidden className="size-5 shrink-0 text-warning" />
          <span className="min-w-0 text-sm">
            <span className="font-semibold text-fg">{t('unpaid.title', { count: rows.length })}</span>
            <span className="text-muted"> · {t('unpaid.sum', { amount: format.money(totalDue) })}</span>
          </span>
        </span>
        <DropdownChevron open={open} />
      </button>
      <Collapse open={open} id={bodyId}>
        <ul className="flex flex-col border-t border-warning/30 px-2 py-2">
          {rows.slice(0, SHOWN).map((r) => (
            <li key={r.bookingId}>
              <Link
                href={`/biz/journal?booking=${r.bookingId}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-surface/70"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-fg">{r.clientName ?? t('unpaid.noClient')}</span>
                  <span className="truncate text-xs text-muted">
                    {format.dateTime(r.start)} · {r.serviceLabel}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold tabular-nums text-fg">{format.money(r.due)}</span>
                  {r.paid > 0 && <span className="text-xs text-muted">{t('unpaid.paidOf', { paid: format.money(r.paid), total: format.money(r.total) })}</span>}
                </span>
              </Link>
            </li>
          ))}
          {rows.length > SHOWN && <li className="px-2 py-2 text-xs text-muted">{t('unpaid.more', { count: rows.length - SHOWN })}</li>}
        </ul>
      </Collapse>
    </div>
  );
}
