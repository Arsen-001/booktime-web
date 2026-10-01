'use client';

/**
 * /biz/loyalty/auto-apply — автоприменение акций (F-06-078, F-06-079, F-06-080): скидка сама
 * применяется при оплате онлайн-записи или записи через журнал; общий выключатель гасит оба блока.
 */
import { useEffect, useRef, useState } from 'react';
import { getAutoApply, listCardTypes, listPromotions, setAutoApply } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { AutoApplySettings, AutoApplyWhen } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function AutoApplyScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const { ready, businessId } = useCurrent();

  const typesQ = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const promosQ = useApiQuery(['loyalty', 'promotions', businessId], () => listPromotions(businessId!), { enabled: ready && Boolean(businessId) });
  const settingsQ = useApiQuery(['loyalty', 'autoApply', businessId], () => getAutoApply(businessId!), { enabled: ready && Boolean(businessId) });

  const [draft, setDraft] = useState<AutoApplySettings | null>(null);
  // Заводим черновик из загруженных настроек один раз на бизнес. Раньше это был условный setState
  // прямо в рендере — на пустом бизнесе (owner-empty) это иногда успевало отработать до того, как
  // Next.js полностью проинициализировал роутер, и в консоль падало «Router action dispatched before
  // initialization» / «Can't perform a React state update on a component that hasn't mounted yet»
  // (b01-fix2). useEffect откладывает запись состояния до коммита — гонки нет.
  const seededFor = useRef<Id | undefined>(undefined);
  useEffect(() => {
    if (settingsQ.data && seededFor.current !== businessId) {
      seededFor.current = businessId;
      setDraft(settingsQ.data);
    }
  }, [settingsQ.data, businessId]);

  const save = useApiMutation((next: AutoApplySettings) => setAutoApply(businessId!, next));

  const discountPromotions = (promosQ.data ?? []).filter((p) => p.kind.startsWith('discount'));
  const promoOptions = [{ value: '', label: t('autoApply.notApplied') }, ...discountPromotions.map((p) => ({ value: p.id, label: p.name }))];
  const whenOptions: { value: AutoApplyWhen; label: string }[] = [
    { value: 'every', label: t('autoApply.whenEvery') },
    { value: 'firstOnly', label: t('autoApply.whenFirstOnly') },
  ];

  const submit = async () => {
    if (!draft) return;
    try {
      await save.mutate(draft);
      toast.success(t('autoApply.saved'));
    } catch {
      toast.error(t('autoApply.saveFailed'));
    }
  };

  if (typesQ.isError || promosQ.isError || settingsQ.isError) {
    return (
      <ErrorState
        onRetry={() => {
          typesQ.refetch();
          promosQ.refetch();
          settingsQ.refetch();
        }}
      />
    );
  }

  // Загрузка — та же страница: карточки и поля на своих местах, поля выключены, пока не пришли настройки
  const loading = typesQ.isLoading || promosQ.isLoading || settingsQ.isLoading || !draft;
  const form: AutoApplySettings = draft ?? { businessId: businessId ?? '', enabled: false, online: { when: 'firstOnly', scope: 'any' }, journal: { when: 'firstOnly' } };
  const setForm = (next: AutoApplySettings) => setDraft(next);

  if (!loading && !typesQ.data?.length) {
    return (
      <div data-f="F-06-078 F-06-079 F-06-080 F-14-079" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('autoApply.title')} />
        <EmptyState title={t('promotions.needCardTypeTitle')} description={t('promotions.needCardTypeText')} />
      </div>
    );
  }

  return (
    <div data-f="F-06-078 F-06-079 F-06-080" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('autoApply.title')} description={t('autoApply.subtitle')} />

      <SectionCard title={t('autoApply.online.title')} description={t('autoApply.online.text')}>
        <div className="flex flex-col gap-4" data-f="F-03-108">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t('autoApply.promotionLabel')}</span>
            <Select
              disabled={loading}
              options={promoOptions}
              value={form.online.promotionId ?? ''}
              onValueChange={(v) => setForm({ ...form, online: { ...form.online, promotionId: v || undefined } })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t('autoApply.whenLabel')}</span>
            <Select
              disabled={loading}
              options={whenOptions}
              value={form.online.when}
              onValueChange={(v) => setForm({ ...form, online: { ...form.online, when: v as AutoApplyWhen } })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t('autoApply.scopeLabel')}</span>
            <Select
              disabled={loading}
              options={[
                { value: 'any', label: t('autoApply.scopeAny') },
                { value: 'appOnly', label: t('autoApply.scopeAppOnly') },
              ]}
              value={form.online.scope}
              onValueChange={(v) => setForm({ ...form, online: { ...form.online, scope: v as 'any' | 'appOnly' } })}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title={t('autoApply.journal.title')} description={t('autoApply.journal.text')}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t('autoApply.promotionLabel')}</span>
            <Select
              disabled={loading}
              options={promoOptions}
              value={form.journal.promotionId ?? ''}
              onValueChange={(v) => setForm({ ...form, journal: { ...form.journal, promotionId: v || undefined } })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t('autoApply.whenLabel')}</span>
            <Select
              disabled={loading}
              options={whenOptions}
              value={form.journal.when}
              onValueChange={(v) => setForm({ ...form, journal: { ...form.journal, when: v as AutoApplyWhen } })}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title={t('autoApply.masterSwitch')}>
        <Switch
          disabled={loading}
          checked={form.enabled}
          onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
          label={t('autoApply.masterSwitchLabel')}
          labelPosition="start"
        />
      </SectionCard>

      <Button onClick={submit} loading={save.isPending} disabled={loading} className="self-start">
        {t('autoApply.save')}
      </Button>
    </div>
  );
}
