'use client';

/**
 * ⭐ «Утренняя сводка» (владелец, 01.10.2026 — пункт 5): один экран в начале дня для владельца и администратора —
 * сколько записей, кто не подтвердил, заявки, новые клиенты, дни рождения, предоплаты без подтверждения, долги клиентов
 * и незакрытые визиты прошлых дней. Каждая строка раскрывается в записи (нажатие — окно записи или карточка клиента).
 * Право journal.stats; мастер без права видеть чужих — только своё. Доставка в Telegram — позже (решение владельца).
 */
import type { ReactNode } from 'react';
import { CalendarCheck, CheckCircle2, ClipboardX, Clock, Gift, HandCoins, MessageCircleQuestion, Sparkles, Wallet } from 'lucide-react';
import type { ISODate, Id, Service, Staff } from '@/domain/core';
import { getMorningSummary, workdayKeys, type MorningSummary, type WorkdayItem } from '@/api/journal-workday';
import { useApiQuery } from '@/api/request';
import { useTodayYerevan } from '@/areas/journal/lib/lateness';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Accordion, type AccordionItem } from '@/ui/Accordion';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { useNavigate } from '@/ui/navigation/useNavigate';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';
import { openWorkdaySheet } from './events';
import { WorkdayRow, WorkdayRowSkeleton } from './WorkdayRow';

type LineKey = 'notConfirmed' | 'requests' | 'prepayments' | 'newClients' | 'birthdays' | 'debts' | 'bookings';

const ICONS: Record<LineKey, ReactNode> = {
  notConfirmed: <MessageCircleQuestion aria-hidden className="size-4 text-warning" />,
  requests: <Clock aria-hidden className="size-4 text-warning" />,
  prepayments: <Wallet aria-hidden className="size-4 text-warning" />,
  newClients: <Sparkles aria-hidden className="size-4 text-primary-text" />,
  birthdays: <Gift aria-hidden className="size-4 text-accent" />,
  debts: <HandCoins aria-hidden className="size-4 text-danger" />,
  bookings: <CalendarCheck aria-hidden className="size-4 text-primary-text" />,
};
const ORDER: LineKey[] = ['notConfirmed', 'requests', 'prepayments', 'newClients', 'birthdays', 'debts', 'bookings'];

/** Сводка дня — общий ключ для шторки и карточки в «Требует внимания» */
export function useMorningSummary(businessId: Id, date: ISODate, enabled = true) {
  return useApiQuery(workdayKeys.morning(businessId, date), () => getMorningSummary(businessId, date), { enabled: enabled && Boolean(businessId) });
}

export function countOf(s: MorningSummary, key: LineKey): number {
  return s[key].length;
}

export function MorningSummarySheet({
  open,
  onOpenChange,
  businessId,
  date,
  staff,
  services,
  onOpenBooking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  date: ISODate;
  staff: Staff[];
  services: Service[];
  onOpenBooking: (id: Id, date: ISODate) => void;
}) {
  const t = useT('journal');
  const format = useFormat();
  const nav = useNavigate();
  const today = useTodayYerevan();
  const q = useMorningSummary(businessId, date, open);
  const s = q.data;
  const openClient = (id: Id) => {
    onOpenChange(false);
    nav.go(`/biz/clients/${id}`);
  };
  const items = (list: WorkdayItem[], note?: (i: WorkdayItem) => ReactNode) => (
    <ul className="flex flex-col divide-y divide-border">
      {list.map((i) => (
        <WorkdayRow
          key={i.bookingId}
          start={i.start}
          staffId={i.staffId}
          serviceIds={i.serviceIds}
          clientName={i.clientName}
          staff={staff}
          services={services}
          note={note?.(i)}
          onOpen={() => onOpenBooking(i.bookingId, i.start.slice(0, 10))}
        />
      ))}
    </ul>
  );
  const lineTitle = (key: LineKey, n: number) =>
    ({
      notConfirmed: () => t('workday.morning.lines.notConfirmed', { n }),
      requests: () => t('workday.morning.lines.requests', { n }),
      prepayments: () => t('workday.morning.lines.prepayments', { n }),
      newClients: () => t('workday.morning.lines.newClients', { n }),
      birthdays: () => t('workday.morning.lines.birthdays', { n }),
      debts: () => t('workday.morning.lines.debts', { n: s?.debtTotal.clients ?? n, sum: format.money(s?.debtTotal.amount ?? 0) }),
      bookings: () => t('workday.morning.lines.bookings', { n }),
    })[key]();
  const content = (key: LineKey): ReactNode => {
    if (!s) return null;
    if (key === 'birthdays')
      return (
        <ul className="flex flex-col divide-y divide-border">
          {s.birthdays.map((b) => (
            <PersonRow
              key={b.clientId}
              name={b.name}
              sub={[b.age ? t('workday.morning.birthdayAge', { n: b.age }) : '', b.start ? t('workday.morning.birthdayBooked', { time: format.time(b.start) }) : ''].filter(Boolean).join(' · ')}
              onClick={() => (b.bookingId && b.start ? onOpenBooking(b.bookingId, b.start.slice(0, 10)) : openClient(b.clientId))}
            />
          ))}
        </ul>
      );
    if (key === 'debts')
      return (
        <ul className="flex flex-col divide-y divide-border">
          {s.debts.map((d) => (
            <PersonRow
              key={d.clientId}
              name={d.name}
              sub={t('workday.morning.debtVisits', { n: d.visits, date: format.date(d.lastVisit, 'dayMonthShort') })}
              amount={format.money(d.amount)}
              onClick={() => openClient(d.clientId)}
            />
          ))}
        </ul>
      );
    if (key === 'prepayments') return items(s.prepayments, (i) => (i.reported ? t('workday.morning.reported') : undefined));
    return items(s[key]);
  };
  const nonZero = s ? ORDER.filter((k) => countOf(s, k) > 0) : [];
  const zero = s ? ORDER.filter((k) => countOf(s, k) === 0) : [];
  const accordion: AccordionItem[] = nonZero.map((key) => ({
    id: key,
    title: (
      <span className="flex items-center gap-2.5 text-[15px] font-semibold text-fg">
        {ICONS[key]}
        {lineTitle(key, s ? countOf(s, key) : 0)}
      </span>
    ),
    content: content(key),
  }));
  const planned = (s?.bookings ?? []).reduce((sum, b) => sum + b.total, 0);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={date === today ? t('workday.morning.title') : t('workday.morning.titleDate', { date: format.date(date, 'long') })}
      description={t('workday.morning.subtitle')}
      size="md"
    >
      <div className="flex flex-col gap-5 pb-2">
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label={t('workday.morning.tiles.bookings')} value={s ? String(s.bookings.length) : undefined} />
              <Tile label={t('workday.morning.tiles.planned')} value={s ? format.money(planned) : undefined} />
              <Tile label={t('workday.morning.tiles.newClients')} value={s ? String(s.newClients.length) : undefined} />
            </div>
            {s && s.unclosedCount > 0 && (
              <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4">
                <ClipboardX aria-hidden className="size-5 shrink-0 text-danger" />
                <p className="min-w-0 flex-1 text-sm font-semibold text-fg">{t('workday.morning.lines.unclosed', { n: s.unclosedCount })}</p>
                <Button size="sm" variant="secondary" onClick={() => openWorkdaySheet('unclosed')}>
                  {t('workday.unclosed.cardAction')}
                </Button>
              </section>
            )}
            {!s ? (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border px-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <WorkdayRowSkeleton key={i} />
                ))}
              </ul>
            ) : (
              accordion.length > 0 && <Accordion multiple items={accordion} />
            )}
            {s && zero.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {zero.map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 aria-hidden className="size-4 text-success" />
                    {t(`workday.morning.zero.${key}` as never)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Tile({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 px-3 py-2.5">
      <span className="text-xs leading-tight text-muted">{label}</span>
      <b className="mt-auto truncate text-lg font-bold text-fg tabular-nums">{value ?? <SkeletonText width="4ch" />}</b>
    </div>
  );
}

function PersonRow({ name, sub, amount, onClick }: { name: string; sub?: string; amount?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-fg">{name}</span>
          {sub && <span className="truncate text-xs text-muted">{sub}</span>}
        </span>
        {amount && <b className="shrink-0 text-sm font-semibold text-danger tabular-nums">{amount}</b>}
      </button>
    </li>
  );
}
