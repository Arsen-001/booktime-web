'use client';

/**
 * /biz/settings/brand — «Бренд» (F-15-100…103): имя для клиентов, описание, логотип. Всё, что видит клиент,
 * идёт на нашу проверку (F-00-168) — после «Сохранить» показываем «на проверке» до решения панели.
 */
import { useState } from 'react';
import { Building2, X } from 'lucide-react';
import { getMediaReviewStatus, saveBrand, useBrand } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Form } from '@/ui/Form';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Skeleton } from '@/ui/Skeleton';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';
import { useRememberedFlag } from '@/areas/settings/useRememberedFlag';
import { useSettingsDraft } from '@/areas/settings/useSettingsDraft';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'auto';

const STATUS_TONE: Record<
  ReviewStatus,
  'warning' | 'success' | 'danger' | 'neutral'
> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  auto: 'neutral',
};

export function BrandScreen() {
  const t = useT('settings');
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = useBrand(businessId, { enabled: ready });

  const form = useSettingsDraft(
    q.data ? { brandName: q.data.brandName, descriptionRu: q.data.descriptionRu, logoUrl: q.data.logoUrl } : undefined,
    ready ? businessId : undefined,
  );
  const { draft, dirty } = form;
  const setDraft = form.setDraft;

  const [status, setStatus] = useState<ReviewStatus>('auto');
  const [statusLoadedFor, setStatusLoadedFor] = useState<string | null>(null);
  if (ready && businessId && statusLoadedFor !== businessId) {
    setStatusLoadedFor(businessId);
    getMediaReviewStatus(businessId, 'brand')
      .then(setStatus)
      .catch(() => setStatus('auto'));
  }

  const save = useApiMutation(saveBrand);
  const loading = !ready || q.isLoading || !draft;
  const d = draft ?? { brandName: '', descriptionRu: '', logoUrl: undefined };
  // Подсказка про автоперевод — при описании; до ответа — если описание было в прошлый раз (в демо есть)
  // Логотип есть — квадрат с картинкой и «Заменить» (другая высота, чем плитка «Выбрать фото»); в демо есть
  const showLogo = useRememberedFlag('brand-logo', loading, draft ? Boolean(draft.logoUrl) : undefined, true);
  const showTranslateHint = useRememberedFlag('brand-translate-hint', loading, draft ? Boolean(draft.descriptionRu) : undefined, true);

  async function handleSave() {
    if (!draft || !businessId) return;
    try {
      const saved = await save.mutate({ businessId, staffId, ...draft });
      form.markSaved({
        brandName: saved.brandName,
        descriptionRu: saved.descriptionRu,
        logoUrl: saved.logoUrl,
      });
      const s = await getMediaReviewStatus(businessId, 'brand');
      setStatus(s);
      toast.success(t('brand.saved'));
    } catch {
      toast.error(t('brand.saveFailed'));
    }
  }

  return (
    <div
      data-f="F-15-100 F-15-101 F-15-102 F-15-103"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t('brand.title')}
        description={t('brand.description')}
        back={{ href: '/biz/settings' }}
      />

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !loading && !canManage ? (
        <EmptyState
          icon={<Building2 aria-hidden />}
          title={t('brand.accessDenied')}
        />
      ) : (
        // До ответа — та же форма с пустыми выключенными полями (DESIGN.md «The skeleton IS the page»)
        <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
          <Form onSubmit={(e) => e.preventDefault()} className="gap-6">
            <SectionCard title={t('brand.nameTitle')}>
              <FormField
                label={t('brand.nameLabel')}
                hint={t('brand.nameHint')}
              >
                <Input
                  value={d.brandName}
                  onChange={(e) =>
                    setDraft({ ...d, brandName: e.target.value })
                  }
                  placeholder={t('brand.namePlaceholder')}
                />
              </FormField>
            </SectionCard>

            <SectionCard
              title={t('brand.descriptionTitle')}
              description={t('brand.descriptionHint')}
            >
              <Textarea
                value={d.descriptionRu}
                onChange={(e) =>
                  setDraft({ ...d, descriptionRu: e.target.value })
                }
                placeholder={t('brand.descriptionPlaceholder')}
                rows={5}
              />
              {showTranslateHint && (
                <p className="mt-2 text-sm text-muted">
                  {t('brand.autoTranslateHint')}
                </p>
              )}
            </SectionCard>

            <SectionCard
              title={t('brand.logoTitle')}
              description={t('brand.logoHint')}
              actions={
                status !== 'auto' && (
                  <Badge tone={STATUS_TONE[status]}>
                    {t(`brand.reviewStatus.${status}`)}
                  </Badge>
                )
              }
            >
              {loading && showLogo ? (
                <LogoSkeleton />
              ) : (
              <ImageUpload
                value={d.logoUrl ? [d.logoUrl] : []}
                onValueChange={(urls) =>
                  setDraft({ ...d, logoUrl: urls[0] })
                }
                max={1}
                maxSizeMb={12}
                aspect="square"
              />
              )}
            </SectionCard>

            <SectionCard
              title={t('brand.usedWhereTitle')}
              description={t('brand.usedWhereText')}
            />
          </Form>

          <StickyActionBar>
            <Button
              onClick={handleSave}
              disabled={!dirty}
              loading={save.isPending}
            >
              {t('brand.save')}
            </Button>
          </StickyActionBar>
        </fieldset>
      )}
    </div>
  );
}

/** Логотип до ответа — та же разметка, что у ImageUpload с одной картинкой: квадрат, кнопка «убрать», «Заменить», подсказка */
function LogoSkeleton() {
  const tu = useT('ui');
  return (
    <div aria-busy className="w-full">
      <div className="grid max-w-xs grid-cols-1 gap-3">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2">
          <Skeleton variant="rect" className="absolute inset-0 h-full rounded-none" />
          <IconButton size="sm" variant="secondary" icon={<X aria-hidden />} label={tu('upload.remove')} disabled className="absolute top-1.5 right-1.5 rounded-full bg-surface/90 shadow-sm" />
        </div>
      </div>
      <span className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-primary-text">{tu('upload.replace')}</span>
      <p className="mt-2 text-sm text-muted">{tu('upload.hint', { mb: 12 })}</p>
    </div>
  );
}
