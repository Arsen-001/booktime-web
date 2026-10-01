'use client';

/**
 * /biz/settings/sphere — «Сфера бизнеса» (F-15-029/030, F-00-148, F-15-032): сфера и уточнение вида
 * деятельности (заблокированы — меняются заявкой к нам, F-15-005), слова по сфере на языке кабинета.
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { saveSystemSettings, useSystemSettings } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent, useDemo, useTerms } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { SPHERE_ICONS } from '@/shell/sphereIcons';

export function SphereScreen() {
  const t = useT('settings');
  const tc = useT('common');
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const { sphere } = useDemo();
  const terms = useTerms();
  const Icon = SPHERE_ICONS[sphere] ?? Sparkles;

  const q = useSystemSettings(businessId, { enabled: ready });
  const [subtype, setSubtype] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (
    ready &&
    businessId &&
    loadedFor !== businessId &&
    !q.isLoading &&
    q.data
  ) {
    setLoadedFor(businessId);
    setSubtype(q.data.sphereSubtype ?? '');
  }

  const dirty =
    q.data !== undefined && subtype !== (q.data.sphereSubtype ?? '');
  const save = useApiMutation(saveSystemSettings);
  const loading = !ready || q.isLoading;

  async function handleSave() {
    if (!businessId || !q.data) return;
    try {
      await save.mutate({
        businessId,
        city: q.data.city,
        dateTimeFormat: q.data.dateTimeFormat,
        messageLanguage: q.data.messageLanguage,
        sphereSubtype: subtype || undefined,
      });
      toast.success(t('sphere.saved'));
    } catch {
      toast.error(t('sphere.saveFailed'));
    }
  }

  return (
    <div
      data-f="F-15-029 F-15-030 F-00-148 F-15-032"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t('sphere.title')}
        description={t('sphere.description')}
        back={{ href: '/biz/settings' }}
      />

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !loading && !canManage ? (
        <EmptyState
          icon={<Sparkles aria-hidden />}
          title={t('sphere.accessDenied')}
        />
      ) : (
        // До ответа — та же страница, поле подвида пустое и выключено (DESIGN.md «The skeleton IS the page»)
        <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
          <div data-f="F-15-029">
            <SectionCard title={t('sphere.currentTitle')}>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex-1 text-sm font-medium text-fg">
                  {tc(`spheres.${sphere}` as never)}
                </span>
                <Badge tone="neutral">{t('sphere.locked')}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton
                  href="/biz/onboarding/spheres"
                  variant="secondary"
                  size="sm"
                >
                  {t('sphere.viewAll')}
                </LinkButton>
                <LinkButton
                  href="/biz/onboarding/sphere-request"
                  variant="ghost"
                  size="sm"
                >
                  {t('sphere.requestChange')}
                </LinkButton>
              </div>
            </SectionCard>
          </div>

          <div data-f="F-15-030">
            <SectionCard
              title={t('sphere.subtypeTitle')}
              description={t('sphere.subtypeHint')}
            >
              <FormField label={t('sphere.subtypeLabel')} optional>
                <Input
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  placeholder={t('sphere.subtypePlaceholder')}
                />
              </FormField>
            </SectionCard>
          </div>

          <div data-f="F-00-148">
            <SectionCard
              title={t('sphere.termsTitle')}
              description={t('sphere.termsHint')}
            >
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-surface-2/50 p-3">
                  <p className="text-muted">{t('sphere.termClient')}</p>
                  <p className="font-medium text-fg">
                    {terms.client} / {terms.clients}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-2/50 p-3">
                  <p className="text-muted">{t('sphere.termMaster')}</p>
                  <p className="font-medium text-fg">
                    {terms.master} / {terms.masters}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted">
                {t('sphere.termsLangHint')}
              </p>
            </SectionCard>
          </div>

          <div data-f="F-15-032">
            <SectionCard
              title={t('sphere.staffTitle')}
              description={t('sphere.staffHint', { word: terms.master })}
            />
          </div>

          <StickyActionBar>
            <Button
              onClick={handleSave}
              disabled={!dirty}
              loading={save.isPending}
            >
              {t('sphere.save')}
            </Button>
          </StickyActionBar>
        </fieldset>
      )}
    </div>
  );
}
