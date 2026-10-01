'use client';

/**
 * F-00-174: раздел кабинета «/biz/apps» → мастер видит свои тексты (описание места, «о мастере»,
 * описание услуги), у которых нет ручного en, и правит автоперевод — клиент увидит исправленный текст.
 */
import { useState } from 'react';
import { Languages } from 'lucide-react';
import { listTranslatable, setTranslationOverride } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { pseudoTranslateToEn } from '@/areas/client/translate';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function TranslationsScreen() {
  const t = useT('client');
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['translatable-texts', businessId ?? ''], () => listTranslatable(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const skeletonCount = useSkeletonCount('translations', { loading: q.isLoading || !ready, count: q.data?.length, fallback: 0, max: 10 });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-00-174" className="flex flex-col gap-5">
      <PageHeader title={t('translation.manageTitle')} description={t('translation.manageSubtitle')} />

      {(q.isLoading || !ready) && skeletonCount === 0 ? (
        // В прошлый раз (и в демо) переводить было нечего — та же пустая плашка, тексты полосами
        <EmptyState
          icon={<Languages aria-hidden className="size-8 text-muted" />}
          title={<SkeletonText width="20ch" />}
          description={
            // Ширина и строки — как у подсказки: на телефоне три строки, шире — две
            <span className="block w-[310px] max-w-full sm:w-[448px]">
              <Skeleton lines={3} className="sm:hidden" />
              <Skeleton lines={2} className="max-sm:hidden" />
            </span>
          }
        />
      ) : q.isLoading || !ready ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <TranslationRowSkeleton key={i} />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Languages aria-hidden className="size-8 text-muted" />}
          title={t('translation.manageEmptyTitle')}
          description={t('translation.manageEmptyHint')}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pageItems.map((row) => (
              <TranslationRow key={`${row.owner}:${row.ownerId}:${row.field}`} row={row} onSaved={() => void q.refetch()} />
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

interface Row {
  owner: 'staff' | 'business' | 'service';
  ownerId: string;
  field: string;
  label: string;
  ru: string;
  override?: string;
}

function TranslationRow({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const t = useT('client');
  const toast = useToast();
  const auto = pseudoTranslateToEn(row.ru);
  const [value, setValue] = useState(row.override ?? auto);
  const [dirty, setDirty] = useState(false);
  const save = useApiMutation(({ text }: { text: string }) => setTranslationOverride(row.owner, row.ownerId, row.field, text));
  const fieldLabel =
    row.owner === 'business'
      ? t('translation.fieldBusinessDescription')
      : row.owner === 'staff'
        ? t('translation.fieldStaffBio')
        : t('translation.fieldServiceDescription');

  const handleSave = async () => {
    try {
      await save.mutate({ text: value });
      setDirty(false);
      toast.success(t('translation.saved'));
      onSaved();
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  const handleReset = () => {
    setValue(auto);
    setDirty(true);
  };

  return (
    <SectionCard title={row.label} description={fieldLabel}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('translation.originalLabel')}</p>
          <p className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-fg">{row.ru}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">{t('translation.translationLabel')}</p>
            <Badge tone={row.override ? 'primary' : 'neutral'} variant="soft">
              {row.override ? t('translation.editedBadge') : t('translation.autoBadge')}
            </Badge>
          </div>
          <Textarea
            autoResize
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {row.override && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              {t('translation.resetToAuto')}
            </Button>
          )}
          <Button size="sm" onClick={() => void handleSave()} loading={save.isPending} disabled={!dirty}>
            {t('translation.save')}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

/** Скелетон строки перевода — та же карточка: название и поле, оригинал, «Перевод» с меткой, поле, «Сохранить» */
function TranslationRowSkeleton() {
  const t = useT('client');
  return (
    <SectionCard title={<SkeletonText width="14ch" />} description={<SkeletonText width="18ch" />}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('translation.originalLabel')}</p>
          <p className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-fg">
            <Skeleton lines={2} />
          </p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">{t('translation.translationLabel')}</p>
            <Badge tone="neutral" variant="soft">
              <SkeletonText width="5ch" />
            </Badge>
          </div>
          <Textarea autoResize disabled readOnly value={'\n'} aria-hidden />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" disabled>
            {t('translation.save')}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
