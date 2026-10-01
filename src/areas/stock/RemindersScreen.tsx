'use client';

/**
 * /biz/stock/reminders — ⭐ F-00-142: «у салона и у каждого мастера — своё место для напоминаний».
 * Склад сам собирает «заканчивается» (F-00-137), срок годности (F-00-140), замена/обслуживание
 * оборудования (F-00-141); плюс лёгкий свой тип — текстовое напоминание с датой (❓ открыто, наше решение).
 */
import { useState } from 'react';
import { AlertTriangle, Bell, CalendarClock, Plus, Wrench } from 'lucide-react';
import { completeCustomReminder, createCustomReminder, listReminders } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCoreList } from '@/api/core';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { ReminderKind } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';

const ICON: Record<ReminderKind, typeof Bell> = {
  lowStock: AlertTriangle,
  expiring: CalendarClock,
  expired: CalendarClock,
  equipmentService: Wrench,
  equipmentReplace: Wrench,
  custom: Bell,
};

/** Строка напоминания одной высоты — с датой и без (min-h под две строки текста): список не прыгает */
const ROW = 'flex min-h-15.5 items-center gap-3 rounded-xl border border-border bg-surface p-3';
/** Типичные метки в демо: «Заканчивается», «Просрочен», «Истекает срок» */
const BADGE_WIDTHS = ['12.5ch', '9ch', '12.5ch'];

/** Скелетон строки напоминания — та же разметка: значок, название и дата, метка вида */
function ReminderRowSkeleton({ i }: { i: number }) {
  return (
    <li className={ROW}>
      <Bell aria-hidden className="size-5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">
          <SkeletonText width={i % 2 ? '24ch' : '20ch'} />
        </p>
        <p className="text-xs text-muted">
          <SkeletonText width="14ch" />
        </p>
      </div>
      <Badge tone="neutral" size="sm">
        <SkeletonText width={BADGE_WIDTHS[i % BADGE_WIDTHS.length]} />
      </Badge>
    </li>
  );
}

export function RemindersScreen() {
  const t = useT('stock');
  const toast = useToast();
  const format = useFormat();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [staffFilter, setStaffFilter] = useState<'business' | Id>('business');
  const [addOpen, setAddOpen] = useState(false);
  const [text, setText] = useState('');
  const [date, setDate] = useState(today());

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const remindersQ = useApiQuery(
    ['stock', 'reminders', businessId, locationId, staffFilter],
    () => listReminders(businessId!, locationId!, staffFilter === 'business' ? undefined : staffFilter),
    { enabled },
  );
  const addMutation = useApiMutation((input: { text: string; date: string; staffId?: Id }) => createCustomReminder(businessId!, locationId!, input));
  const doneMutation = useApiMutation((id: Id) => completeCustomReminder(businessId!, id));

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(remindersQ.data ?? [], { resetKey: staffFilter });
  const skeletonRows = useSkeletonCount('reminders', { loading: remindersQ.isLoading, count: remindersQ.data ? pageItems.length : undefined, fallback: 3, max: 10 });

  if (remindersQ.isError) return <ErrorState onRetry={remindersQ.refetch} />;

  const items = remindersQ.data ?? [];
  const staffOptions = [{ value: 'business', label: t('reminders.businessTab') }, ...(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))];

  const save = async () => {
    if (!text.trim()) return;
    try {
      await addMutation.mutate({ text, date, staffId: staffFilter === 'business' ? undefined : staffFilter });
      toast.success(t('reminders.added'));
      setText('');
      setAddOpen(false);
    } catch {
      toast.error(t('reminders.addFailed'));
    }
  };

  const complete = async (id: Id) => {
    try {
      await doneMutation.mutate(id);
    } catch {
      toast.error(t('reminders.completeFailed'));
    }
  };

  return (
    <div data-f="F-00-142" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('reminders.title')}
        description={t('reminders.subtitle')}
        actions={
          <Button leftIcon={<Plus aria-hidden />} onClick={() => setAddOpen(true)}>
            {t('reminders.add')}
          </Button>
        }
      />

      <div className="max-w-xs">
        <Select value={staffFilter} onValueChange={(v) => setStaffFilter(v as 'business' | Id)} options={staffOptions} />
      </div>

      {remindersQ.isLoading ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <ReminderRowSkeleton key={i} i={i} />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell aria-hidden />} title={t('reminders.emptyTitle')} description={t('reminders.emptyText')} action={<Button variant="secondary" onClick={() => setAddOpen(true)}>{t('reminders.add')}</Button>} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {pageItems.map((r) => {
              const Icon = ICON[r.kind];
              return (
                <li key={r.id} className={ROW}>
                  <Icon aria-hidden className="size-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{r.title}</p>
                    {r.date && <p className="text-xs text-muted">{format.date(r.date, 'long')}</p>}
                  </div>
                  <Badge tone={r.severity === 'danger' ? 'danger' : r.severity === 'warning' ? 'warning' : 'neutral'} size="sm">
                    {t(`reminders.kind.${r.kind}`)}
                  </Badge>
                  {r.kind === 'custom' && (
                    <Button variant="ghost" size="sm" onClick={() => complete(r.id)}>
                      {t('reminders.complete')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {pager}
        </div>
      )}

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('reminders.addTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>{t('reminders.cancel')}</Button>
            <Button onClick={save} loading={addMutation.isPending} disabled={!text.trim()}>{t('reminders.save')}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t('reminders.text')} required>
            <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </FormField>
          <FormField label={t('reminders.date')}>
            <DatePicker value={date} onValueChange={(v) => v && setDate(v)} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
