'use client';

/**
 * /biz/payroll/statement/new — форма «Новый расчёт зарплаты» (F-09-066): ведомость на одного
 * сотрудника за период вручную. Принадлежит разделу «payroll». Само начисление — общая функция
 * finance/createSettlementSheet (F-07-162 = F-09-063; экран взаиморасчётов там же, src/areas/finance/
 * SettlementsScreen.tsx, CONVENTIONS §6: используем чужой api-модуль как публичный контракт, не правим
 * чужой файл). Страница ведомости, куда переходим после создания, — своя (StatementScreen, F-09-067).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserRound } from 'lucide-react';
import { createSettlementSheet } from '@/api/finance';
import { useCoreList } from '@/api/core';
import { useApiMutation } from '@/api/request';
import type { DateRange } from '@/ui/Calendar';
import { useCurrent } from '@/demo/hooks';
import { dayjs, toISODate, today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/**
 * F-09-057 («История документов» справки — у нас отдельного экрана нет, «Взаиморасчёты» и есть
 * поиск, ⭐ по нашему решению): найти РАНЕЕ созданную ведомость по сотруднику и периоду, не создавая
 * новую — просто открывает /biz/payroll/statement с теми же параметрами (StatementScreen сам покажет
 * либо начисленную ведомость по этому периоду, либо предпросмотр, если такой ещё нет).
 */
function FindStatementCard({
  staffList,
  ready,
}: {
  staffList: { id: string; name: string }[];
  ready: boolean;
}) {
  const t = useT('payroll');
  const router = useRouter();
  const [staffId, setStaffId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<DateRange>(() => ({
    from: toISODate(dayjs().startOf('month')),
    to: today(),
  }));
  const canFind = ready && Boolean(staffId) && Boolean(range.from) && Boolean(range.to);

  return (
    <div data-f="F-09-057">
      <SectionCard title={t('statement.findTitle')} description={t('statement.findDescription')}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('statement.staff')}</span>
            <Select
              value={staffId}
              onValueChange={setStaffId}
              placeholder={t('statement.staffPlaceholder')}
              options={staffList.map((s) => ({ value: s.id, label: s.name }))}
              searchable
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('statement.period')}</span>
            <DateRangePicker value={range} onValueChange={setRange} max={today()} presets />
          </label>
          <Button
            variant="secondary"
            leftIcon={<Search aria-hidden className="size-4" />}
            disabled={!canFind}
            onClick={() =>
              router.push(`/biz/payroll/statement?staffId=${staffId}&from=${range.from}&to=${range.to}`)
            }
          >
            {t('statement.findSubmit')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

export function StatementNewScreen() {
  const t = useT('payroll');
  const toast = useToast();
  const router = useRouter();
  const { ready, businessId } = useCurrent();

  const staffQuery = useCoreList('staff', { businessId }, { enabled: ready && Boolean(businessId) });
  const staffList = (staffQuery.data ?? []).filter((s) => s.status !== 'fired' && s.status !== 'disabled');

  const [staffId, setStaffId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<DateRange>(() => ({ from: toISODate(dayjs().startOf('month')), to: today() }));
  const [comment, setComment] = useState('');

  const createM = useApiMutation((args: { staffId: string; from: string; to: string; comment: string; draft: boolean }) =>
    createSettlementSheet(businessId!, args.staffId, `${args.from}T00:00`, `${args.to}T23:59`, args.comment, args.draft),
  );

  const canSubmit = Boolean(staffId) && Boolean(range.from) && Boolean(range.to);

  /** F-09-069: «Сохранить и начислить» сразу входит в баланс; «Сохранить как черновик» — нет, пока не начислили. */
  const handleSubmit = async (draft: boolean) => {
    if (!staffId || !range.from || !range.to) return;
    try {
      await createM.mutate({ staffId, from: range.from, to: range.to, comment, draft });
      toast.success(draft ? t('statement.draftCreated') : t('statement.created'));
      router.push(`/biz/payroll/statement?staffId=${staffId}&from=${range.from}&to=${range.to}`);
    } catch {
      toast.error(t('statement.createFailed'));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('statement.newTitle')} description={t('statement.newDescription')} />

      {!ready || staffQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton variant="rect" className="h-64" />
          <Skeleton variant="rect" className="h-72" />
        </div>
      ) : staffList.length === 0 ? (
        <EmptyState icon={<UserRound aria-hidden className="size-8" />} title={t('statement.noStaff')} />
      ) : (
        <>
          <FindStatementCard staffList={staffList} ready={ready} />
          <div data-f="F-09-066" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('statement.staff')}</span>
              <Select
                value={staffId}
                onValueChange={setStaffId}
                placeholder={t('statement.staffPlaceholder')}
                options={staffList.map((s) => ({ value: s.id, label: s.name }))}
                searchable
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('statement.period')}</span>
              <DateRangePicker value={range} onValueChange={setRange} max={today()} presets />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('statement.comment')}</span>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t('statement.commentPlaceholder')} />
            </label>
            <div data-f="F-09-069" className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button className="flex-1" loading={createM.isPending} disabled={!canSubmit} onClick={() => handleSubmit(false)}>
                {t('statement.createConfirm')}
              </Button>
              <Button className="flex-1" variant="outline" loading={createM.isPending} disabled={!canSubmit} onClick={() => handleSubmit(true)}>
                {t('statement.saveDraft')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
