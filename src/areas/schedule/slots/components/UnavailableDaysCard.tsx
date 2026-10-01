'use client';

/**
 * «Дни, закрытые для онлайн-записи» (F-02-042 — филиал, F-02-043 — сотрудник). Пусто — одна строка с действием,
 * а не крупное пустое состояние на пол-экрана (ux-best-c3 №4). Удаление — «Отменить» в тосте (F-00-061).
 */
import { useState } from 'react';
import { CalendarX2, Plus, Trash2 } from 'lucide-react';
import type { ISODate } from '@/domain/core';
import type { SlotScopeKind, UnavailableRange } from '@/domain/schedule';
import { addUnavailableRange, removeUnavailableRange } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export interface UnavailableDaysCardProps {
  scopeKind: SlotScopeKind;
  scopeId: string;
  ranges: UnavailableRange[];
  editable: boolean;
}

export function UnavailableDaysCard({ scopeKind, scopeId, ranges, editable }: UnavailableDaysCardProps) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from?: ISODate; to?: ISODate }>({});
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const add = useApiMutation((r: Omit<UnavailableRange, 'id'>) => addUnavailableRange(scopeKind, scopeId, r));
  const remove = useApiMutation((id: string) => removeUnavailableRange(scopeKind, scopeId, id));

  const submit = async () => {
    setTried(true);
    if (!range.from || !range.to) return;
    try {
      await add.mutate({ from: range.from, to: range.to, note: note.trim() || undefined });
      toast.success(t('slots.unavailable.added'));
      setOpen(false);
      setRange({});
      setNote('');
      setTried(false);
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  const onDelete = async (r: UnavailableRange) => {
    try {
      await remove.mutate(r.id);
      toast.show({
        title: t('slots.unavailable.removed'),
        tone: 'success',
        durationMs: 5000,
        action: {
          label: t('panel.undo'),
          onClick: () =>
            void add.mutate({ from: r.from, to: r.to, note: r.note }).then(
              () => toast.info(t('panel.undone')),
              () => toast.error(t('panel.saveFailed')),
            ),
        },
      });
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  const addButton = editable && (
    <Button size="sm" variant="secondary" leftIcon={<Plus aria-hidden />} onClick={() => setOpen(true)}>
      {t('slots.unavailable.add')}
    </Button>
  );

  return (
    <SectionCard
      id="unavailable-days"
      title={t('slots.unavailable.title')}
      description={t('slots.unavailable.hint')}
      actions={ranges.length > 0 ? addButton : undefined}
    >
      {ranges.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<CalendarX2 aria-hidden />}
          title={t('slots.unavailable.empty')}
          action={addButton || undefined}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {ranges.map((r) => (
            <li key={r.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-fg">
                  {t('slots.unavailable.range', { from: format.date(r.from, 'dayMonth'), to: format.date(r.to, 'dayMonth') })}
                </p>
                {r.note && <p className="truncate text-sm text-muted">{r.note}</p>}
              </div>
              {editable && (
                <IconButton
                  label={t('slots.unavailable.removeFor', { from: format.date(r.from, 'dayMonth') })}
                  icon={<Trash2 aria-hidden />}
                  variant="ghost"
                  onClick={() => void onDelete(r)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('slots.unavailable.addTitle')}
        description={t('slots.unavailable.hint')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('panel.cancel')}
            </Button>
            <Button onClick={submit} loading={add.isPending}>
              {t('slots.unavailable.addConfirm')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField
            label={t('slots.unavailable.dates')}
            error={tried && (!range.from || !range.to) ? t('slots.unavailable.needDates') : undefined}
          >
            <DateRangePicker value={range} onValueChange={(v) => setRange(v)} />
          </FormField>
          <FormField label={t('slots.unavailable.note')} optional>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('slots.unavailable.notePlaceholder')} />
          </FormField>
        </div>
      </Modal>
    </SectionCard>
  );
}
