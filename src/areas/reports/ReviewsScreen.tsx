'use client';

/**
 * F-12-068: отчёт «Отзывы» — ⭐ «У нас»: по умолчанию звёздочка мастеру и открытый текстовый отзыв о
 * салоне; при online.reviewMode бизнеса = 'text' (В-24) — оценка 1–5 и текст 1:1 с Altegio. Отчёт
 * показывает все виды и, для звёздочки/оценки, сколько получил каждый мастер за период.
 * F-12-069: удаление — только текстовый отзыв о салоне (звёздочку снимает сам клиент, «У нас»);
 * оценку+текст бизнес не удаляет, а скрывает из онлайн-записи (hide/unhide, 1:1 с Altegio) — и то, и
 * другое только с правом reviewsDelete.
 */
import { Eye, EyeOff, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { deleteCompanyReview, getReviewsReport, hideStaffReview, unhideStaffReview } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCoreList } from '@/api/core';
import { ExportExcelButton } from '@/areas/reports/components/ExportExcelButton';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useReportsPermissions } from '@/areas/reports/useReportsPermissions';
import { useCurrent } from '@/demo/hooks';
import type { ReviewRow } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import type { DateRange } from '@/ui/Calendar';
import { Badge } from '@/ui/Badge';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PermissionGate } from '@/ui/PermissionGate';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';

export function ReviewsScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, ready } = useCurrent();
  const perms = useReportsPermissions();

  const [range, setRange] = useState<Required<DateRange>>({ from: addDays(today(), -364), to: today() });
  const [subject, setSubject] = useState<string>('all');
  const [toDelete, setToDelete] = useState<ReviewRow | null>(null);

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const q = useApiQuery(
    ['reports', 'reviews', businessId, range, subject],
    () => getReviewsReport({ businessId: businessId!, filters: { range, subject: subject as never } }),
    { enabled: ready && !!businessId, keepPrevious: true },
  );

  const deleteMutation = useApiMutation((id: string) => deleteCompanyReview(businessId!, id), {
    invalidates: [['reports', 'reviews']],
  });
  const hideMutation = useApiMutation((id: string) => hideStaffReview(businessId!, id), { invalidates: [['reports', 'reviews']] });
  const unhideMutation = useApiMutation((id: string) => unhideStaffReview(businessId!, id), { invalidates: [['reports', 'reviews']] });

  const rows = q.data?.rows ?? [];
  const starSummary = q.data?.starSummary ?? [];
  const ratingSummary = q.data?.ratingSummary ?? [];

  const columns: TableColumn<ReviewRow>[] = useMemo(
    () => [
      { id: 'when', header: t('reviews.columns.when'), cell: (r) => f.date(r.createdAt, 'short'), mobile: 'aside' },
      { id: 'about', header: t('reviews.columns.about'), cell: (r) => (r.kind === 'company' ? t('reviews.company') : r.staffName), mobile: 'title' },
      {
        id: 'value',
        header: t('reviews.columns.value'),
        cell: (r) =>
          r.kind === 'staffStar' ? (
            <Star className="size-4 fill-current text-warning" aria-label={t('reviews.star')} />
          ) : r.kind === 'staffReview' ? (
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-fg">
                <Star className="size-3.5 fill-current text-warning" aria-hidden />
                {r.rating}
                {r.hiddenByBusiness && (
                  <Badge tone="neutral" variant="soft" size="sm" className="ml-1">
                    {t('reviews.hidden')}
                  </Badge>
                )}
              </span>
              {r.text && <span className="text-sm text-muted">{r.text}</span>}
            </span>
          ) : (
            (r.text ?? '—')
          ),
        mobile: 'subtitle',
      },
      {
        id: 'actions',
        header: '',
        cell: (r) =>
          r.kind === 'company' && perms.reviewsDelete ? (
            <span data-f="F-12-069 F-12-084">
              <IconButton icon={<Trash2 />} label={t('reviews.delete')} variant="ghost" onClick={() => setToDelete(r)} />
            </span>
          ) : r.kind === 'staffReview' && perms.reviewsDelete ? (
            <span data-f="F-12-069">
              {r.hiddenByBusiness ? (
                <IconButton icon={<Eye />} label={t('reviews.unhide')} variant="ghost" onClick={() => void unhideMutation.mutate(r.id)} />
              ) : (
                <IconButton icon={<EyeOff />} label={t('reviews.hide')} variant="ghost" onClick={() => void hideMutation.mutate(r.id)} />
              )}
            </span>
          ) : null,
        align: 'right',
        mobile: 'hidden',
      },
    ],
    [t, f, perms.reviewsDelete, hideMutation, unhideMutation],
  );

  const exportRows = rows.map((r) => [
    f.date(r.createdAt, 'short'),
    r.kind === 'company' ? t('reviews.company') : (r.staffName ?? ''),
    r.kind === 'staffStar' ? '★' : r.kind === 'staffReview' ? `${r.rating}★ ${r.text ?? ''}`.trim() : (r.text ?? ''),
  ]);

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-068" className="flex flex-col gap-6">
        <ReportHeader
          slug="reviews"
          crumbGroup="marketing"
          helpBody={t('help.reviews')}
          actions={<ExportExcelButton fileName="reviews.csv" type="reportBuilder" rows={exportRows} headers={[t('reviews.columns.when'), t('reviews.columns.about'), t('reviews.columns.value')]} disabled={rows.length === 0} />}
        />

        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker value={range} onValueChange={(r) => setRange({ from: r.from ?? range.from, to: r.to ?? range.to })} presets />
          <div className="w-full max-w-xs">
            <Select
              aria-label={t('reviews.filterSubject')}
              value={subject}
              onValueChange={setSubject}
              options={[
                { value: 'all', label: t('reviews.subjectAll') },
                { value: 'company', label: t('reviews.company') },
                ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        </div>

        {starSummary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {starSummary.map((s) => (
              <span key={s.staffId} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
                <Star className="size-3.5 fill-current text-warning" aria-hidden />
                {s.staffName} · {s.starsCount}
              </span>
            ))}
          </div>
        )}

        {ratingSummary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ratingSummary.map((s) => (
              <span key={s.staffId} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
                <Star className="size-3.5 fill-current text-warning" aria-hidden />
                {s.staffName} · {s.avgRating.toFixed(1)} ({s.count})
              </span>
            ))}
          </div>
        )}

        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState variant="page" icon={<Star />} title={t('reviews.emptyTitle')} description={t('reviews.emptyText')} />
        ) : (
          <Table columns={columns} rows={rows} rowKey={(r) => r.id} loading={q.isLoading} label={t('catalog.items.reviews.title')} />
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={t('reviews.deleteConfirmTitle')}
        description={t('reviews.deleteConfirmText')}
        confirmLabel={t('reviews.delete')}
        tone="danger"
        onConfirm={async () => {
          if (toDelete) await deleteMutation.mutate(toDelete.id);
        }}
      />
    </PermissionGate>
  );
}
