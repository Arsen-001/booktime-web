'use client';

/**
 * /biz/settings/gallery — «Галерея» (F-15-111): до 6 фото компании, показываются клиенту после проверки
 * (F-00-168) — кроме тех, что уже были у бизнеса (сняты на визите, видны сразу).
 */
import { useEffect, useState } from 'react';
import { ImagePlus, Images, X } from 'lucide-react';
import { GALLERY_MAX_PHOTOS, getMediaReviewStatus, saveGalleryPhotos, useGalleryPhotos } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { useSettingsDraft } from '@/areas/settings/useSettingsDraft';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'auto';

export function GalleryScreen() {
  const t = useT('settings');
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = useGalleryPhotos(businessId, { enabled: ready });

  const form = useSettingsDraft(q.data, ready ? businessId : undefined);
  const { draft, dirty, setDraft } = form;

  const [statuses, setStatuses] = useState<Record<string, ReviewStatus>>({});
  useEffect(() => {
    if (!businessId || !draft) return;
    let cancelled = false;
    Promise.all(draft.map((url) => getMediaReviewStatus(businessId, url).then((s) => [url, s] as const)))
      .then((entries) => {
        if (!cancelled) setStatuses(Object.fromEntries(entries));
      })
      .catch(() => {
        /* статусы проверки — подсказка к фото; не получили — фото показываются без отметок */
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, draft]);

  const save = useApiMutation(saveGalleryPhotos);
  const loading = !ready || q.isLoading || !draft;
  // Сколько фото было в прошлый раз (в демо — три и плитка «Выбрать фото»)
  const skeletonPhotos = useSkeletonCount('gallery-photos', { loading, count: draft?.length, fallback: 3, max: GALLERY_MAX_PHOTOS });

  async function handleSave() {
    if (!draft || !businessId) return;
    try {
      const saved = await save.mutate({ businessId, photos: draft });
      form.markSaved(saved);
      toast.success(t('gallery.saved'));
    } catch {
      toast.error(t('gallery.saveFailed'));
    }
  }

  return (
    <div data-f="F-15-111 F-00-087" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('gallery.title')} description={t('gallery.description')} back={{ href: '/biz/settings' }} />

      {/* Ошибка — раньше loading: при ошибке draft не появляется, и скелетон висел вечно (QA 30.09, ?api=error) */}
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : loading ? (
        <>
          <SectionCard title={t('gallery.photosTitle')} description={t('gallery.photosHint', { max: GALLERY_MAX_PHOTOS })}>
            <GallerySkeleton photos={skeletonPhotos} />
          </SectionCard>
          <StickyActionBar>
            <Button disabled>{t('gallery.save')}</Button>
          </StickyActionBar>
        </>
      ) : !canManage ? (
        <EmptyState icon={<Images aria-hidden />} title={t('gallery.accessDenied')} />
      ) : (
        <>
          <SectionCard title={t('gallery.photosTitle')} description={t('gallery.photosHint', { max: GALLERY_MAX_PHOTOS })}>
            <ImageUpload value={draft} onValueChange={setDraft} max={GALLERY_MAX_PHOTOS} maxSizeMb={12} aspect="4/3" />
            {draft.length === 0 && <p className="mt-3 text-sm text-muted">{t('gallery.empty')}</p>}
            {draft.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.map((url, i) => {
                  const status = statuses[url] ?? 'auto';
                  if (status === 'auto') return null;
                  return (
                    <Badge key={url} tone={status === 'pending' ? 'warning' : status === 'approved' ? 'success' : 'danger'} size="sm">
                      {t('gallery.photoLabel', { n: i + 1 })}: {t(`gallery.reviewStatus.${status}`)}
                    </Badge>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <StickyActionBar>
            <Button onClick={handleSave} disabled={!dirty} loading={save.isPending}>
              {t('gallery.save')}
            </Button>
          </StickyActionBar>
        </>
      )}
    </div>
  );
}

/**
 * Галерея до ответа — та же сетка, что у ImageUpload (4:3, 3/4/6 в ряд): места фото полосами, плитка «Выбрать фото»,
 * если место осталось, подсказка про формат ниже.
 */
function GallerySkeleton({ photos }: { photos: number }) {
  const t = useT('settings');
  const tu = useT('ui');
  return (
    <div aria-busy className="w-full">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: photos }, (_, i) => (
          <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-surface-2">
            <Skeleton variant="rect" className="absolute inset-0 h-full rounded-none" />
            <IconButton size="sm" variant="secondary" icon={<X aria-hidden />} label={tu('upload.remove')} disabled className="absolute top-1.5 right-1.5 rounded-full bg-surface/90 shadow-sm" />
          </div>
        ))}
        {photos < GALLERY_MAX_PHOTOS && (
          <span className="flex aspect-[4/3] cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong bg-surface p-3 text-center opacity-60">
            <ImagePlus className="size-6 text-primary-text" aria-hidden />
            <span className="text-sm font-medium text-fg">{tu('upload.choose')}</span>
            <span className="hidden text-xs text-muted sm:block">{tu('upload.drop')}</span>
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">{tu('upload.hint', { mb: 12 })}</p>
      {photos === 0 && <p className="mt-3 text-sm text-muted">{t('gallery.empty')}</p>}
      {/* Место строки отметок проверки (у фото «как было» отметок нет — строка пустая, но с тем же отступом) */}
      {photos > 0 && <div className="mt-3 flex flex-wrap gap-2" />}
    </div>
  );
}
