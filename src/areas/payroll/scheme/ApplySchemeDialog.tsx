'use client';

/**
 * З12 (зарплата-ревью 27.09): «Применить к…» — сохранённая схема сотрудника становится новой версией схемы
 * у нескольких сотрудников сразу, с даты «Действует с» и с подтверждением. Принадлежит разделу «payroll».
 */
import { useState } from 'react';
import type { Id } from '@/domain/core';
import { applySchemeToStaff, type StaffSchemeStatus } from '@/api/payroll';
import { useApiMutation } from '@/api/request';
import { useT } from '@/i18n/useT';
import { dayjs, today } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { useConfirm, useToast } from '@/ui/Toast';

export interface ApplySchemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceStaffId: Id;
  candidates: StaffSchemeStatus[];
  /** Не раньше этого дня (закрытый период) */
  minDate?: string;
}

export function ApplySchemeDialog({ open, onOpenChange, sourceStaffId, candidates, minDate }: ApplySchemeDialogProps) {
  const t = useT('payroll');
  const toast = useToast();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<Id[]>([]);
  const [from, setFrom] = useState<string>(today());
  const applyM = useApiMutation((args: { ids: Id[]; from: string }) => applySchemeToStaff(sourceStaffId, args.ids, args.from));

  const options = candidates.filter((c) => c.staff.id !== sourceStaffId);
  const toggle = (id: Id, on: boolean) => setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  async function apply() {
    if (selected.length === 0) return;
    const ok = await confirm({
      title: t('scheme.applyTo.confirmTitle', { count: selected.length }),
      description: t('scheme.applyTo.confirmText', { date: dayjs(from).format('DD.MM.YYYY') }),
      confirmLabel: t('scheme.applyTo.confirm'),
    });
    if (!ok) return;
    try {
      const count = await applyM.mutate({ ids: selected, from });
      toast.success(t('scheme.applyTo.done', { count }));
      setSelected([]);
      onOpenChange(false);
    } catch {
      toast.error(t('scheme.applyTo.failed'));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('scheme.applyTo.title')}
      description={t('scheme.applyTo.description')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('scheme.copy.cancel')}
          </Button>
          <Button onClick={apply} disabled={selected.length === 0} loading={applyM.isPending}>
            {t('scheme.applyTo.confirm')}
          </Button>
        </>
      }
    >
      <div data-f="F-09-012" className="flex flex-col gap-4">
        <FormField label={t('scheme.effectiveFrom')} hint={t('scheme.effectiveFromHint')}>
          <DatePicker value={from} onValueChange={(d) => d && setFrom(d)} min={minDate} />
        </FormField>
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {options.map((c) => (
            <li key={c.staff.id}>
              <Checkbox
                checked={selected.includes(c.staff.id)}
                onCheckedChange={(on) => toggle(c.staff.id, on)}
                label={c.staff.name}
              />
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
