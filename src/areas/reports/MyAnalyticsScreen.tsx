'use client';

/**
 * F-12-106: «Моя аналитика» администратора (приложение) — по справке живёт в приложении для бизнеса и
 * видна только роли «Администратор»; владелец и мастер видят все данные раздела, а не только свои, поэтому
 * F-12-106 показывает их всем, кто открывает «Отчёты», как «Мою аналитику» — а PermissionGate по persona
 * прячет её от всех, кроме роли, которая соответствует «Администратору» (F-00-041: у нас админ ведёт
 * записи всех мастеров, поэтому его личные цифры полезны владельцу — ⭐ вывод в ТЗ).
 * Мы строим отчёт в вебе (не в отдельном мобильном приложении, F-00-127: кабинет — и веб, и приложение).
 *
 * F-12-089 «Аналитика администраторов» (❓ в ТЗ — какой отчёт открывает право в вебе): по нашему решению
 * (⭐, разрешённая неясность) это ровно этот отчёт — «Моя аналитика» для роли «Администратор». Тонкое право
 * `adminAnalytics` (ReportsStaffPermissions.adminAnalytics, по умолчанию — тем, у кого есть staff.manage)
 * гейтит его поверх persona-проверки, чтобы владелец мог выключить экран конкретному администратору.
 *
 * F-09-095 «Моя аналитика администратора: его начисления» (payroll, не мой раздел — точечная правка по
 * CONVENTIONS §1 «второй проход», qa/requests/payroll.md 2026-09-26): к показателям выше добавлен блок
 * «Заработано / выплачено / осталось» из payroll's getStaffBalance (payroll's api как контракт, тот же
 * вызов, что использует «Взаиморасчёты»).
 */
import { Banknote, CalendarClock, RotateCcw, UserPlus, Users, Wallet } from 'lucide-react';
import { getMyAnalytics } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { ReportPeriodPicker } from '@/areas/reports/components/ReportPeriodPicker';
import { useReportRange } from '@/areas/reports/reportPeriod';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { ErrorState } from '@/ui/ErrorState';
import { PermissionGate } from '@/ui/PermissionGate';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';

export function MyAnalyticsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, staffId, ready } = useCurrent();
  const perms = useReportsPermissions();
  const range = useReportRange();

  const q = useApiQuery(
    ['reports', 'myAnalytics', businessId, staffId, range],
    () => getMyAnalytics({ businessId: businessId!, staffId: staffId!, range }),
    { enabled: ready && !!businessId && !!staffId && perms.adminAnalytics, keepPrevious: true },
  );

  return (
    <PermissionGate personas={['admin', 'owner']} fallback="message">
      {!perms.adminAnalytics ? (
        <div data-f="F-12-089" className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
          {t('myAnalytics.noAccess')}
        </div>
      ) : (
      <div data-f="F-12-106 F-10-135 F-12-089" className="flex flex-col gap-6">
        <ReportHeader slug="myAnalytics" helpBody={t('myAnalytics.help')} />

        <ReportPeriodPicker />

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : q.isLoading || !q.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard icon={<CalendarClock />} label={t('myAnalytics.created')} value={q.data.createdBookings} />
              <StatCard icon={<Users />} label={t('myAnalytics.completed')} value={q.data.completedByHim} />
              <StatCard icon={<Users />} label={t('myAnalytics.revenue')} value={f.money(q.data.revenueOfCreated)} />
              <StatCard icon={<UserPlus />} label={t('myAnalytics.distinctClients')} value={q.data.distinctClientsBooked} />
              <StatCard icon={<CalendarClock />} label={t('myAnalytics.sameDayFuture')} value={q.data.sameDayFutureBookings} />
              <StatCard
                icon={<RotateCcw />}
                label={t('myAnalytics.noShowRebooked')}
                value={`${q.data.noShowRebookedByHim} / ${q.data.noShowTotal}`}
              />
            </div>
            <p className="text-sm text-muted">{t('myAnalytics.arrivedHint', { arrived: q.data.arrivedTotal, byHim: q.data.arrivedBookedByHim })}</p>
            <div data-f="F-09-095" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard icon={<Banknote />} label={t('myAnalytics.payrollEarned')} value={f.money(q.data.payrollEarned)} />
              <StatCard icon={<Wallet />} label={t('myAnalytics.payrollPaid')} value={f.money(q.data.payrollPaid)} />
              <StatCard icon={<Wallet />} label={t('myAnalytics.payrollRemaining')} value={f.money(q.data.payrollRemaining)} />
            </div>
          </>
        )}
      </div>
      )}
    </PermissionGate>
  );
}
