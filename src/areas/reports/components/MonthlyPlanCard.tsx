'use client';

/**
 * F-00-195 «План месяца» (наше решение, у Altegio в собранном не нашли): владелец ставит цель
 * выручки на текущий месяц и видит прогресс. Нет плана — карточка сама предлагает его поставить,
 * а не показывает пустой прогресс-бар.
 */
import { useState } from 'react';
import { Target } from 'lucide-react';
import { dayjs, today } from '@/lib/date';
import { getMonthlyPlan, setMonthlyPlan } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useToast } from '@/ui/Toast';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function MonthlyPlanCard() {
  const t = useT('reports');
  const format = useFormat();
  const toast = useToast();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const month = dayjs(today()).format('YYYY-MM');
  // Отч8: было dayjs().format без локали — «September 2026» на русском экране
  const monthLabel = format.date(`${month}-01`, 'monthYear');

  const q = useApiQuery(
    ['reports', 'monthlyPlan', businessId, activeLocationIds, month],
    () => getMonthlyPlan(businessId!, activeLocationIds, month),
    { enabled: ready && Boolean(businessId), keepPrevious: true },
  );
  const save = useApiMutation((goal: number) => setMonthlyPlan(businessId!, month, goal));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | undefined>(undefined);

  const loading = q.isLoading || !q.data;
  const { goal, revenue, percent } = q.data ?? { goal: null, revenue: 0, percent: null };
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent));

  const startEdit = () => {
    setDraft(goal ?? undefined);
    setEditing(true);
  };

  const submit = async () => {
    if (!draft || draft <= 0) return;
    try {
      await save.mutate(draft);
      toast.success(t('plan.saved'));
      setEditing(false);
      q.refetch();
    } catch {
      toast.error(t('plan.saveFailed'));
    }
  };

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2" data-f="F-00-195 F-07-172">
          <Target aria-hidden className="size-4 text-primary-text" />
          {t('plan.title')}
        </span>
      }
      description={monthLabel}
      actions={
        !editing && (
          <Button variant="outline" size="sm" onClick={startEdit} disabled={loading}>
            {goal ? t('plan.edit') : t('plan.set')}
          </Button>
        )
      }
    >
      {loading ? (
        // Скелетон — та же карточка «плана нет» (так в демо чаще всего): строка подсказки, на телефоне в две строки
        <p className="text-sm text-muted">
          <span className="md:hidden">
            <Skeleton lines={2} />
          </span>
          <span className="hidden md:inline">
            <SkeletonText width="70ch" />
          </span>
        </p>
      ) : editing ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FormField label={t('plan.goalLabel')}>
              <MoneyInput value={draft} onValueChange={setDraft} />
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('plan.cancel')}
            </Button>
            <Button loading={save.isPending} disabled={!draft || draft <= 0} onClick={submit}>
              {t('plan.save')}
            </Button>
          </div>
        </div>
      ) : goal ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="num-lg text-fg">{format.money(revenue)}</span>
            <span className="text-sm text-muted">
              {t('plan.ofGoal', { goal: format.money(goal) })}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
            {/* Анимируется только transform (DESIGN.md «Performance»), не width */}
            <div
              className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${clamped / 100})` }}
            />
          </div>
          <span className="text-sm font-medium text-muted">
            {t('plan.percent', { percent: clamped })}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted">{t('plan.empty')}</p>
      )}
    </SectionCard>
  );
}
