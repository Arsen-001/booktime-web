'use client';

/**
 * F-00-195 «План месяца» прямо с главной: цель по полученным деньгам. Та же запись, что карточка плана в
 * «Основных показателях» (setMonthlyPlan) — план один, видят его оба экрана.
 */
import { useState } from 'react';
import { setMonthlyPlan } from '@/api/reports';
import { useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { useToast } from '@/ui/Toast';

export interface PlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  month: string;
  monthLabel: string;
  goal: number | null;
}

export function PlanModal({ open, onOpenChange, businessId, month, monthLabel, goal }: PlanModalProps) {
  const t = useT('reports');
  const toast = useToast();
  // Главная и «Основные показатели» читают план своими ключами — перечитываем оба (в режиме api записи ядра нет)
  const save = useApiMutation((value: number) => setMonthlyPlan(businessId, month, value), {
    invalidates: [
      ['reports', 'home', businessId],
      ['reports', 'monthlyPlan', businessId],
    ],
  });
  // Черновик — от плана на момент открытия (поле ввода живёт только в этом окне, CONVENTIONS §18.9)
  const [draft, setDraft] = useState<number | undefined>(goal ?? undefined);
  const [error, setError] = useState(false);
  const [openedWith, setOpenedWith] = useState<{
    open: boolean;
    goal: number | null;
  }>({ open, goal });
  if (openedWith.open !== open || openedWith.goal !== goal) {
    setOpenedWith({ open, goal });
    if (open) {
      setDraft(goal ?? undefined);
      setError(false);
    }
  }

  const submit = async () => {
    if (!draft || draft <= 0) {
      setError(true);
      return;
    }
    try {
      await save.mutate(draft);
      toast.success(t('home.planModal.saved'));
      onOpenChange(false);
    } catch {
      toast.error(t('home.planModal.failed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('home.planModal.title', { month: monthLabel })}
      description={t('home.planModal.description')}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('home.planModal.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={() => void submit()}>
            {t('home.planModal.save')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label={t('home.planModal.label')} error={error ? t('home.planModal.invalid') : undefined}>
          <MoneyInput
            value={draft}
            onValueChange={(v) => {
              setDraft(v);
              if (v && v > 0) setError(false);
            }}
            autoFocus
          />
        </FormField>
      </form>
    </Modal>
  );
}
