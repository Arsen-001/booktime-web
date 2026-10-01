'use client';

/**
 * Рабочий день в «Требует внимания»: карточка «Сводка на сегодня» (владелец и администратор, только сегодня) и «N визитов
 * не закрыты» (всем; мастеру — свои). Кнопки открывают шторки (WorkdaySheets). В свёрнутой полосе панели — те же два
 * значка со счётчиками (WorkdayStrip).
 */
import type { ReactNode } from 'react';
import { ClipboardX, Sun } from 'lucide-react';
import type { ISODate, Id } from '@/domain/core';
import { useTodayYerevan } from '@/areas/journal/lib/lateness';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';
import { openWorkdaySheet } from './events';
import { useMorningSummary } from './MorningSummarySheet';
import { useUnclosedVisits } from './UnclosedVisitsSheet';

export function WorkdayAttentionCards({ businessId, date, onlyStaffId }: { businessId: Id; date: ISODate; onlyStaffId?: Id }) {
  const t = useT('journal');
  const today = useTodayYerevan();
  const canStats = useCan('journal.stats');
  const showMorning = canStats && date === today;
  const morning = useMorningSummary(businessId, today, showMorning);
  const unclosed = useUnclosedVisits(businessId, onlyStaffId);
  const s = morning.data;
  const parts = s
    ? [
        t('workday.morning.lines.bookings', { n: s.bookings.length }),
        s.notConfirmed.length ? t('workday.morning.lines.notConfirmed', { n: s.notConfirmed.length }) : '',
        s.newClients.length ? t('workday.morning.lines.newClients', { n: s.newClients.length }) : '',
        s.birthdays.length ? t('workday.morning.lines.birthdays', { n: s.birthdays.length }) : '',
        s.prepayments.length ? t('workday.morning.lines.prepayments', { n: s.prepayments.length }) : '',
        s.debtTotal.clients ? t('workday.morning.cardDebts', { n: s.debtTotal.clients }) : '',
      ].filter(Boolean)
    : [];
  return (
    <>
      {showMorning && (
        <section data-workday="morning" className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
            <Sun aria-hidden className="size-4 text-warning" />
            {t('workday.morning.title')}
          </h3>
          <p className="mt-2 text-[13px] leading-snug text-muted">{s ? parts.join(' · ') : <SkeletonText width="26ch" />}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => openWorkdaySheet('morning', today)}>
            {t('workday.morning.open')}
          </Button>
        </section>
      )}
      {unclosed.rows.length > 0 && (
        <section data-workday="unclosed" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
            <ClipboardX aria-hidden className="size-4 text-warning" />
            {t('workday.unclosed.cardTitle', { n: unclosed.rows.length })}
          </h3>
          <p className="mt-2 text-[13px] leading-snug text-muted">{t('workday.unclosed.cardText')}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => openWorkdaySheet('unclosed')}>
            {t('workday.unclosed.cardAction')}
          </Button>
        </section>
      )}
    </>
  );
}

/** Значки рабочего дня в свёрнутой полосе «Требует внимания» — тот же вид, что у соседних значков */
export function WorkdayStrip({ businessId, date, onlyStaffId }: { businessId: Id; date: ISODate; onlyStaffId?: Id }) {
  const t = useT('journal');
  const today = useTodayYerevan();
  const canStats = useCan('journal.stats');
  const unclosed = useUnclosedVisits(businessId, onlyStaffId);
  const n = unclosed.rows.length;
  return (
    <>
      {canStats && date === today && (
        <StripIcon label={t('workday.morning.title')} tone="text-warning hover:bg-surface-2" onClick={() => openWorkdaySheet('morning', today)}>
          <Sun aria-hidden />
        </StripIcon>
      )}
      {n > 0 && (
        <StripIcon label={t('workday.unclosed.cardTitle', { n })} tone="bg-warning-soft text-warning" count={n} onClick={() => openWorkdaySheet('unclosed')}>
          <ClipboardX aria-hidden />
        </StripIcon>
      )}
    </>
  );
}

function StripIcon({ label, tone, count, onClick, children }: { label: string; tone: string; count?: number; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn('relative grid size-10 place-items-center rounded-xl transition-colors [&_svg]:size-5', tone)}>
      {children}
      {count ? (
        <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1 text-[11px] leading-5 font-bold text-surface tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}
