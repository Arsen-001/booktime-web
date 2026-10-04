'use client';

/**
 * Деньги и визиты клиента (F-04-071, F-04-165, F-04-179, F-04-200): три StatCard — «Визиты», «Продано», «Баланс» словом
 * («Долг 10 000 ֏» / «Аванс 4 000 ֏»), числа из одного правила с историей визитов (ux-r5 №1). Долг — строкой с переходом
 * к визитам с долгом. Клиент ещё не был — не сетка нулей, а «Ещё не был у вас» и «Записать» (ux-r2 №8).
 */
import { CalendarPlus, CalendarX2, RotateCcw } from 'lucide-react';
import type { ClientRow } from '@/domain/clients';
import { BalanceText } from '@/areas/clients/components/BalanceText';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { StatCard } from '@/ui/StatCard';

export interface ClientMoneySummaryProps {
  row: ClientRow;
  /** F-04-200: без права «Просмотр счетов» денег не видно, только визиты */
  showMoney: boolean;
  bookHref: string;
  canBook: boolean;
  onShowDebt: () => void;
}

export function ClientMoneySummary({ row, showMoney, bookHref, canBook, onShowDebt }: ClientMoneySummaryProps) {
  const t = useT('clients');
  const fmt = useFormat();

  if (row.visits === 0) {
    return (
      <EmptyState
        variant="section"
        framed
        icon={<CalendarX2 aria-hidden />}
        title={t('cardView.noVisitsTitle')}
        description={t('cardView.noVisitsText')}
        action={
          canBook ? (
            <LinkButton href={bookHref} leftIcon={<CalendarPlus aria-hidden />}>
              {t('cardView.book')}
            </LinkButton>
          ) : undefined
        }
      />
    );
  }

  // ⭐ «Пора снова» (F-00-084): срок повтора по интервалу услуги; наступил — жёлтая полоса с «Записать»
  const due = row.dueAt && row.dueAt <= today();
  // Срок из прошлого года — с годом: «28 октября» без года читалось как будущий месяц
  const dueDate = row.dueAt ? fmt.date(row.dueAt, row.dueAt.slice(0, 4) === today().slice(0, 4) ? 'dayMonth' : 'long') : '';
  return (
    <div data-f="F-04-071 F-04-165 F-04-200" className="flex flex-col gap-3">
      {row.dueAt && (
        <div
          data-f="F-00-084"
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm',
            due ? 'border border-warning/40 bg-warning-soft text-fg' : 'bg-surface-2 text-muted',
          )}
        >
          <span className="flex items-center gap-2">
            <RotateCcw aria-hidden className={cn('size-4 shrink-0', due ? 'text-warning' : 'text-muted')} />
            {due ? t('cardView.dueNow', { date: dueDate }) : t('cardView.dueSoon', { date: dueDate })}
          </span>
          {due && canBook && (
            <LinkButton size="sm" variant="secondary" href={bookHref} leftIcon={<CalendarPlus aria-hidden />}>
              {t('cardView.book')}
            </LinkButton>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label={t('cardView.visits')}
          value={fmt.number(row.visits)}
          hint={row.lastVisit ? t('cardView.lastVisit', { when: fmt.ago(row.lastVisit) }) : undefined}
        />
        {showMoney && (
          <StatCard label={t('table.columns.sold')} value={fmt.money(row.sold)} hint={t('cardView.paidHint', { paid: fmt.money(row.paid) })} />
        )}
        {/* Слово и сумма переносятся по словам: «Կանխավճար 4 000 ֏» крупным числом не влезал в треть ширины (hy, десктоп) */}
        {/* К3 (clients-review 27.09.2026): плитка «Баланс» — пустое место у клиента без аванса и без долга,
            показываем только когда есть что показать (аванс или долг, не «0 ֏»). */}
        {showMoney && row.balance !== 0 && (
          <StatCard className="max-sm:col-span-2" label={t('table.columns.balance')} value={<BalanceText balance={row.balance} className="whitespace-normal" />} />
        )}
      </div>
      {showMoney && row.balance < 0 && (
        // F-04-167 (исправлено): одна кнопка «Долг N ֏ · Принять оплату» вместо строки + отдельной «Посмотреть
        // визиты с долгом» (ux-best-c2 №3). Настоящий приём оплаты — в finance (F-04-071/F-04-059, ещё не готов
        // как вклад сюда, см. qa/requests/clients.md); пока кнопка ведёт на визиты с долгом, откуда оплата уже проводится.
        <div data-f="F-04-167 F-04-179 F-04-085 F-06-146" className="flex items-center">
          <Button size="sm" variant="outline" fullWidth className="border-danger/40 text-danger hover:bg-danger-soft" onClick={onShowDebt}>
            {t('cardView.debtAction', { amount: fmt.money(-row.balance) })}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Деньги и визиты до загрузки — те же плитки «Визиты» и «Продано» (подписи известны, значения — полосами) */
export function ClientMoneySummarySkeleton({ showMoney }: { showMoney: boolean }) {
  const t = useT('clients');
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard loading label={t('cardView.visits')} value={null} hint=" " />
        {showMoney && <StatCard loading label={t('table.columns.sold')} value={null} hint=" " />}
      </div>
    </div>
  );
}
