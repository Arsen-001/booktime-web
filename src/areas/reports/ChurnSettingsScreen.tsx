'use client';

/**
 * F-12-024 «Считать потерянными клиентов, не посещавших более N дней» (по умолчанию 60). Настоящий дом —
 * «Настройки → Аналитика» (раздел settings, ещё не построен) — до готовности просьба в qa/requests/reports.md;
 * пока страница живёт в маршрутах отчётов (своя, F-12-014/F-12-024 ссылаются сюда).
 *
 * F-12-025 «настройка периода потери клиента (сеть)»: у нас нет отдельного «сетевого» срока — churnDaysOf()
 * читает по businessId каждой локации отдельно (churnDaysByBusiness), поэтому «у каждого салона свой срок
 * потери» уже верно без второго поля. Сводке сети (F-12-091/F-12-093, раздел network) нужно читать ЭТОТ ЖЕ
 * getChurnDays(locationBusinessId) на каждую локацию, а не одно число на всю сеть — заявка на подключение
 * лежит в qa/requests/reports.md (владеет файлами кабинета сети раздел «network», не «reports»).
 */
import { useState } from 'react';
import { getChurnDays, setChurnDays } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { CHURN_DAYS_DEFAULT } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function ChurnSettingsScreen() {
  const t = useT('reports');
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const q = useApiQuery(['reports', 'churnDays', businessId], () => getChurnDays(businessId!), { enabled: ready && !!businessId, keepPrevious: true });
  const save = useApiMutation((days: number) => setChurnDays(businessId!, days));
  // undefined — поле ещё не тронуто человеком: показываем то, что пришло с сервера (controlled/uncontrolled, CONVENTIONS §Component Patterns)
  const [edited, setEdited] = useState<string | undefined>(undefined);
  const draft = edited !== undefined ? edited : (q.data !== undefined ? String(q.data) : '');

  const parsed = Number(draft);
  const invalid = !Number.isInteger(parsed) || parsed < 1 || parsed > 365;

  const onSave = async () => {
    if (invalid) return;
    try {
      await save.mutate(parsed);
      toast.success(t('churn.saved'));
      setEdited(undefined);
      q.refetch();
    } catch {
      toast.error(t('churn.saveFailed'));
    }
  };

  return (
    <div data-f="F-12-024 F-12-025" className="flex max-w-lg flex-col gap-6">
      <PageHeader
        title={t('churn.title')}
        breadcrumbs={[{ label: t('nav.overview'), href: '/biz/reports' }, { label: t('churn.title') }]}
        description={t('churn.description')}
      />
      <SectionCard title={t('churn.fieldLabel')}>
        {q.isLoading ? (
          <Skeleton className="h-11 w-32" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={draft}
                onChange={(e) => setEdited(e.target.value.replace(/[^\d]/g, ''))}
                invalid={invalid && draft !== ''}
                className="w-24"
                aria-label={t('churn.fieldLabel')}
              />
              <span className="text-sm text-muted">{t('churn.daysUnit')}</span>
            </div>
            <p className="text-xs text-muted">{t('churn.defaultHint', { n: CHURN_DAYS_DEFAULT })}</p>
            <Button onClick={onSave} disabled={invalid || save.isPending} className="w-fit">
              {t('churn.save')}
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
