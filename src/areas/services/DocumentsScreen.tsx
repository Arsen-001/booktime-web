'use client';

/**
 * /biz/services/documents — дипломы и сертификаты мастера, проверяем мы (F-00-088). Владелец/админ выбирают
 * мастера (по умолчанию — первый, у кого есть документы, У28); мастер видит только себя. «Документы проверены» —
 * хотя бы один диплом одобрен. Загрузка — одна кнопка, снимок виден один раз в списке со статусом; удаление —
 * с «Отменить» 5 с (У26). Загрузка — не правка формы, а отправка на проверку: уходит сразу, с сообщением (У3).
 */
import { BadgeCheck } from 'lucide-react';
import Image from 'next/image';
import {
  addStaffDocument,
  getDocumentStatus,
  getRejectReasons,
  hasVerifiedDocuments,
  listStaffDocuments,
  removeStaffDocument,
  restoreStaffDocument,
  type ContentModerationStatus,
} from '@/api/services';
import type { StaffDocument } from '@/domain/services';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useLocale } from 'next-intl';
import { pickText } from '@/lib/text';
import { StaffPickerCard } from '@/areas/services/components/StaffPickerCard';
import { UploadButton } from '@/areas/services/components/UploadButton';
import { useStaffPicker } from '@/areas/services/components/useStaffPicker';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText, SkeletonOver } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { X } from 'lucide-react';
import { useToast } from '@/ui/Toast';

const STATUS_TONE: Record<ContentModerationStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  auto: 'success',
  rejected: 'danger',
};

const MAX_DOCUMENTS = 20;

export function DocumentsScreen() {
  const t = useT('services');
  const toast = useToast();
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('services.edit');
  const picker = useStaffPicker('documents');
  const staffId = picker.staffId;

  const enabled = ready && Boolean(businessId) && Boolean(staffId);
  const docsQ = useApiQuery(['services', 'documents', staffId], () => listStaffDocuments(staffId!), { enabled });
  const verifiedQ = useApiQuery(['services', 'documentsVerified', staffId], () => hasVerifiedDocuments(staffId!), { enabled });
  const docs = docsQ.data ?? [];
  const statusesQ = useApiQuery(
    ['services', 'documentStatuses', staffId, docs.length],
    async () => Object.fromEntries(await Promise.all(docs.map(async (d) => [d.id, await getDocumentStatus(d.imageUrl)] as const))),
    { enabled: enabled && docs.length > 0 },
  );

  const reasonsQ = useApiQuery(['services', 'documentReasons', staffId, docs.length], () => getRejectReasons(docs.map((d) => d.imageUrl)), {
    enabled: enabled && docs.length > 0,
  });
  const locale = useLocale() as 'ru' | 'en';

  const addM = useApiMutation((args: { imageUrl: string; fileName?: string }) =>
    addStaffDocument(staffId ?? '', businessId ?? '', args.imageUrl, args.fileName),
  );
  const removeM = useApiMutation((id: string) => removeStaffDocument(id));
  const restoreM = useApiMutation(restoreStaffDocument);

  const loading = !picker.ready || docsQ.isLoading || verifiedQ.isLoading;
  const skeletonRows = useSkeletonCount('documents', { loading, count: loading ? undefined : docs.length, fallback: 0, max: MAX_DOCUMENTS });
  if (picker.isError) return <ErrorState onRetry={picker.refetch} />;
  if (docsQ.isError) return <ErrorState onRetry={docsQ.refetch} />;

  const statuses = statusesQ.data ?? {};
  const reasons = reasonsQ.data ?? {};

  const onFiles = async (files: { url: string; name: string }[]) => {
    if (!canEdit) return;
    try {
      for (const f of files) await addM.mutate({ imageUrl: f.url, fileName: f.name });
      if (files.length) toast.success(t('documents.uploaded'));
    } catch {
      toast.error(t('documents.uploadFailed'));
    }
  };

  const onRemove = async (doc: StaffDocument) => {
    try {
      await removeM.mutate(doc.id);
      toast.success(t('documents.removed'), {
        action: {
          label: t('delete.undo'),
          onClick: () => void restoreM.mutate(doc),
        },
        durationMs: 5000,
      });
    } catch {
      toast.error(t('documents.removeFailed'));
    }
  };

  return (
    <div data-f="F-00-088" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={t('documents.title')} description={t('documents.subtitle')} />

      <StaffPickerCard picker={picker} kind="documents" />

      {loading ? (
        // Та же карточка списка: заголовок, подсказка, кнопка «Добавить» (неактивная) и строки документов той же разметки
        <SectionCard
          title={t('documents.listTitle')}
          description={t('documents.uploadHint')}
          actions={canEdit ? <UploadButton label={t('documents.addButton')} disabled onFiles={() => {}} /> : undefined}
        >
          {skeletonRows === 0 ? (
            // В прошлый раз документов не было (в демо — так): то же пустое состояние, текст под плашкой
            <EmptyState
              compact
              kind="default"
              title={<SkeletonOver>{t('documents.empty')}</SkeletonOver>}
              description={<SkeletonOver>{t('documents.emptyHint')}</SkeletonOver>}
            />
          ) : (
          <ul className="flex flex-col gap-3" aria-busy>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <Skeleton variant="rect" className="size-14 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    <SkeletonText width={i % 2 ? '14ch' : '20ch'} />
                  </p>
                  <p className="text-xs text-muted">
                    <SkeletonText width="9ch" />
                  </p>
                </div>
                <Badge tone="neutral" size="sm">
                  <SkeletonText width="9ch" />
                </Badge>
                {canEdit && <span aria-hidden className="size-11 shrink-0 md:size-10" />}
              </li>
            ))}
          </ul>
          )}
        </SectionCard>
      ) : !staffId ? (
        <ErrorState compact title={t('photos.noStaff')} />
      ) : (
        <>
          {verifiedQ.data && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success">
              <BadgeCheck aria-hidden className="size-4 shrink-0" />
              {t('documents.verifiedBanner')}
            </div>
          )}

          <SectionCard
            title={t('documents.listTitle')}
            description={t('documents.uploadHint')}
            actions={
              canEdit ? (
                <UploadButton label={t('documents.addButton')} max={MAX_DOCUMENTS - docs.length} onFiles={(f) => void onFiles(f)} />
              ) : undefined
            }
          >
            {docs.length === 0 ? (
              <EmptyState compact kind="default" title={t('documents.empty')} description={t('documents.emptyHint')} />
            ) : (
              <ul className="flex flex-col gap-3">
                {docs.map((doc) => {
                  const status = statuses[doc.id];
                  return (
                    <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
                        <Image src={doc.imageUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{doc.fileName ?? t('documents.untitled')}</p>
                        <p className="text-xs text-muted">{format.date(doc.uploadedAt, 'short')}</p>
                        {status === 'rejected' && reasons[doc.imageUrl] && (reasons[doc.imageUrl].label || reasons[doc.imageUrl].note) && (
                          <p className="text-xs text-danger">
                            {t('photos.rejectReason', {
                              reason: [
                                reasons[doc.imageUrl].label ? pickText(reasons[doc.imageUrl].label, locale) : undefined,
                                reasons[doc.imageUrl].note,
                              ]
                                .filter(Boolean)
                                .join(' · '),
                            })}
                          </p>
                        )}
                      </div>
                      <Badge tone={status ? STATUS_TONE[status] : 'neutral'} size="sm">
                        {t(`photos.status.${status ?? 'auto'}` as never)}
                      </Badge>
                      {canEdit && (
                        <IconButton
                          icon={<X aria-hidden />}
                          label={t('documents.remove')}
                          variant="ghost"
                          onClick={() => void onRemove(doc)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
