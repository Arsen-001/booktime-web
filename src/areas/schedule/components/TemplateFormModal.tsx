'use client';

/** Окно «Создание / изменение шаблона» (F-02-009); сама форма — TemplateForm */
import type { DayHours, Id } from '@/domain/core';
import type { ScheduleTemplate, TemplateKind } from '@/domain/schedule';
import { TemplateForm } from '@/areas/schedule/components/TemplateForm';
import { useT } from '@/i18n/useT';
import { Modal } from '@/ui/Modal';

export interface TemplateFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  /** Заполнить форму из уже выбранных на панели часов/дней («Сохранить как шаблон») */
  initial?: {
    kind: TemplateKind;
    weekdays?: number[];
    shiftWork?: number;
    shiftOff?: number;
    hours: DayHours;
    weekdayHours?: ScheduleTemplate['weekdayHours'];
  };
  /** Редактирование существующего (F-02-009) */
  editing?: ScheduleTemplate;
  onSaved?: (template: ScheduleTemplate) => void;
}

export function TemplateFormModal({ open, onOpenChange, businessId, initial, editing, onSaved }: TemplateFormModalProps) {
  const t = useT('schedule');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? t('templates.editTitle') : t('templates.createTitle')} size="md">
      {open && (
        <TemplateForm
          key={editing?.id ?? 'new'}
          businessId={businessId}
          initial={initial}
          editing={editing}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Modal>
  );
}
