'use client';

/**
 * /biz/services/photos — фото работ мастера: 6 мест всего на мастера (галерея и фото к услугам вместе,
 * F-00-085), место сверх шести — за монеты (F-00-086). Владелец/админ выбирают мастера (по умолчанию — первый, у
 * кого есть фото, У28); мастер видит только себя. Каждый снимок показан один раз — карточкой со статусом проверки и
 * привязкой (У26); привязать можно только к услугам этого мастера, остальные — «не делает» (У29).
 * Правки — черновик, «Сохранить» внизу (У3), уход с несохранённым спрашивает (У17).
 */
import { useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { ImageIcon, ShoppingBag, X } from 'lucide-react';
import {
  buyPhotoSlot,
  getPhotoServiceLinks,
  getPhotoSlots,
  getPhotoStatuses,
  getRejectReasons,
  getStaffPhotos,
  listServiceRows,
  savePhotoProfile,
  type ContentModerationStatus,
} from '@/api/services';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { FormSaveBar } from '@/areas/services/components/FormSaveBar';
import { StaffPickerCard } from '@/areas/services/components/StaffPickerCard';
import { UploadButton } from '@/areas/services/components/UploadButton';
import { useStaffPicker } from '@/areas/services/components/useStaffPicker';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

const STATUS_TONE: Record<ContentModerationStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  auto: 'success',
  rejected: 'danger',
};

interface PhotoDraft {
  photos: string[];
  links: Record<string, string | undefined>;
}

export function PhotosScreen() {
  const t = useT('services');
  const toast = useToast();
  const confirm = useConfirm();
  const locale = useLocale() as 'ru' | 'en';
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('services.edit');
  const picker = useStaffPicker('photos');
  const staffId = picker.staffId;

  const enabled = ready && Boolean(businessId) && Boolean(staffId);
  const photosQ = useApiQuery(['services', 'staffPhotos', staffId], () => getStaffPhotos(staffId ?? ''), { enabled });
  const slotsQ = useApiQuery(['services', 'photoSlots', staffId], () => getPhotoSlots(staffId ?? ''), { enabled });
  const servicesQ = useApiQuery(['services', 'rows', businessId], () => listServiceRows(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const saved = photosQ.data ?? [];
  const statusesQ = useApiQuery(['services', 'photoStatuses', staffId, saved.length], () => getPhotoStatuses(saved), {
    enabled: enabled && saved.length > 0,
  });
  const reasonsQ = useApiQuery(['services', 'photoReasons', staffId, saved.length], () => getRejectReasons(saved), {
    enabled: enabled && saved.length > 0,
  });
  const linksQ = useApiQuery(['services', 'photoLinks', staffId, saved.length], () => getPhotoServiceLinks(saved), {
    enabled: enabled && saved.length > 0,
  });

  const [draft, setDraft] = useState<PhotoDraft | null>(null);
  const [initial, setInitial] = useState<PhotoDraft | null>(null);
  const [filledFor, setFilledFor] = useState<string | undefined>(undefined);
  if (filledFor !== staffId && photosQ.data && (saved.length === 0 || linksQ.data)) {
    const d = { photos: saved, links: linksQ.data ?? {} };
    setDraft(d);
    setInitial(d);
    setFilledFor(staffId);
  }
  const dirty = Boolean(draft && initial) && JSON.stringify(draft) !== JSON.stringify(initial);
  const { confirmLeave } = useUnsavedGuard(dirty);

  const saveM = useApiMutation((d: PhotoDraft) => savePhotoProfile(staffId ?? '', businessId ?? '', d.photos, d.links));
  const buyM = useApiMutation(() => buyPhotoSlot(staffId ?? '', businessId ?? ''));
  const skeletonRows = useSkeletonCount('photos', {
    loading: !draft,
    count: draft?.photos.length,
    fallback: 6,
    max: 12,
  });

  if (picker.isError) return <ErrorState onRetry={picker.refetch} />;
  if (photosQ.isError || slotsQ.isError) return <ErrorState onRetry={() => (photosQ.isError ? photosQ.refetch() : slotsQ.refetch())} />;
  const loading = !picker.ready || photosQ.isLoading || slotsQ.isLoading || (Boolean(staffId) && filledFor !== staffId);

  const slots = slotsQ.data;
  const total = slots?.total ?? 6;
  const photos = draft?.photos ?? [];
  const statuses = statusesQ.data ?? {};
  const reasons = reasonsQ.data ?? {};
  const rows = servicesQ.data ?? [];
  const mine = rows.filter((r) => staffId && r.service.staffIds.includes(staffId));
  const others = rows.filter((r) => !staffId || !r.service.staffIds.includes(staffId));
  const serviceOptions = [
    { value: '', label: t('photos.linkGallery') },
    ...mine.map((r) => ({
      value: r.service.id,
      label: pickText(r.service.name, locale),
    })),
    ...others.map((r) => ({
      value: r.service.id,
      label: t('photos.notDoing', { name: pickText(r.service.name, locale) }),
      disabled: true,
    })),
  ];

  const save = async () => {
    if (!draft) return;
    try {
      await saveM.mutate(draft);
      setInitial(draft);
      toast.success(t('photos.saved'));
    } catch {
      toast.error(t('photos.saveFailed'));
    }
  };

  const onBuySlot = async () => {
    const ok = await confirm({
      title: t('photos.buyTitle'),
      description: t('photos.buyDescription', {
        price: slots?.priceCoins ?? 0,
      }),
      confirmLabel: t('photos.buyConfirm'),
    });
    if (!ok) return;
    try {
      await buyM.mutate(undefined);
      toast.success(t('photos.bought'));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_enough_coins') toast.error(t('photos.notEnoughCoins'));
      else toast.error(t('photos.buyFailed'));
    }
  };

  const setPhotos = (next: string[]) => setDraft((d) => (d ? { ...d, photos: next } : d));

  return (
    <div data-f="F-00-085 F-00-086" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('photos.title')} description={t('photos.subtitle')} />

      <StaffPickerCard picker={picker} kind="photos" beforeChange={confirmLeave} />

      {loading ? (
        // Та же карточка «Фото работ»: заголовок, «N из M» полосой, строки фото той же разметки и кнопка «Добавить»
        <SectionCard
          title={t('photos.gridTitle')}
          description={
            <>
              <SkeletonText width="11ch" />
              {` · ${t('photos.detailsHint')}`}
            </>
          }
          actions={
            // Все места заняты (в демо — 6 из 6) — на месте кнопка «Купить место», цена — полосой
            canEdit && skeletonRows >= 6 ? (
              <Button size="sm" variant="secondary" leftIcon={<ShoppingBag aria-hidden />} disabled>
                <SkeletonText width="22ch" />
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-4" aria-busy>
            {skeletonRows > 0 && (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: skeletonRows }, (_, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-border p-2.5">
                    <Skeleton variant="rect" className="size-20 shrink-0 rounded-lg" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="neutral" size="sm">
                          <SkeletonText width="9ch" />
                        </Badge>
                        {canEdit && <span aria-hidden className="size-10 shrink-0 md:size-9" />}
                      </div>
                      <Select aria-label={t('photos.linkLabel')} options={[]} value="" onValueChange={() => {}} disabled size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && skeletonRows < 6 && <UploadButton label={t('photos.add')} disabled onFiles={() => {}} />}
          </div>
        </SectionCard>
      ) : null}
      {loading && <FormSaveBar dirty={false} saving={false} canEdit={canEdit} onSave={() => {}} />}
      {loading ? null : !staffId ? (
        <ErrorState compact title={t('photos.noStaff')} />
      ) : (
        <>
          <SectionCard
            title={t('photos.gridTitle')}
            description={`${t('photos.usedOf', { used: photos.length, total })} · ${t('photos.detailsHint')}`}
            actions={
              canEdit && photos.length >= total ? (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<ShoppingBag aria-hidden />}
                  loading={buyM.isPending}
                  onClick={() => void onBuySlot()}
                >
                  {t('photos.buySlot', { price: slots?.priceCoins ?? 0 })}
                </Button>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-4">
              {photos.length === 0 ? (
                <EmptyState compact variant="section" icon={<ImageIcon aria-hidden />} title={t('photos.empty')} />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {photos.map((url) => {
                    const status = initial?.photos.includes(url) ? statuses[url] : 'pending';
                    return (
                      <li key={url} className="flex gap-3 rounded-xl border border-border p-2.5">
                        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          <Image src={url} alt="" fill sizes="80px" className="object-cover" unoptimized />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone={status ? STATUS_TONE[status] : 'neutral'} size="sm">
                              {initial?.photos.includes(url) ? t(`photos.status.${status ?? 'auto'}` as never) : t('photos.willCheck')}
                            </Badge>
                            {canEdit && (
                              <IconButton
                                size="sm"
                                variant="ghost"
                                icon={<X aria-hidden />}
                                label={t('photos.remove')}
                                onClick={() => setPhotos(photos.filter((p) => p !== url))}
                              />
                            )}
                          </div>
                          {status === 'rejected' && reasons[url] && (reasons[url].label || reasons[url].note) && (
                            <p className="text-xs text-danger">
                              {t('photos.rejectReason', {
                                reason: [reasons[url].label ? pickText(reasons[url].label, locale) : undefined, reasons[url].note].filter(Boolean).join(' · '),
                              })}
                            </p>
                          )}
                          <Select
                            aria-label={t('photos.linkLabel')}
                            options={serviceOptions}
                            value={draft?.links[url] ?? ''}
                            onValueChange={(v) =>
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      links: {
                                        ...d.links,
                                        [url]: v || undefined,
                                      },
                                    }
                                  : d,
                              )
                            }
                            disabled={!canEdit}
                            size="sm"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {canEdit && photos.length < total && (
                <UploadButton
                  label={t('photos.add')}
                  max={total - photos.length}
                  onFiles={(files) => setPhotos([...photos, ...files.map((f) => f.url)])}
                />
              )}
            </div>
          </SectionCard>
          <FormSaveBar dirty={dirty} saving={saveM.isPending} canEdit={canEdit} onSave={() => void save()} />
        </>
      )}
    </div>
  );
}
