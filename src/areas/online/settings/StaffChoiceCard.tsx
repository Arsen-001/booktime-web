'use client';

import { useState } from 'react';
import { updateBusinessRules, type getBusinessRules } from '@/api/online';
import { useApiMutation } from '@/api/request';
import type { Id, Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

type Rules = Awaited<ReturnType<typeof getBusinessRules>>;

/**
 * О25 «Выбор специалиста» — общее для всех ссылок бизнеса, поэтому живёт в «Правилах записи», а не внутри одной
 * ссылки, и сохраняется так же, как соседние блоки, — кнопкой «Сохранить», а не само по клику.
 * «Любой специалист» (F-03-069) включён по умолчанию (О8); «Сотрудник для всех онлайн-записей» (F-03-070).
 */
export function StaffChoiceCard({ businessId, rules, staff }: { businessId: Id; rules: Rules; staff: Staff[] }) {
  const t = useT('online');
  const toast = useToast();
  const savedAny = rules.allowAnyStaffForAllLinks ?? true;
  const savedFor = rules.staffForAllBookings ?? '';
  const [any, setAny] = useState(savedAny);
  const [forAll, setForAll] = useState(savedFor);
  const mutation = useApiMutation((patch: Parameters<typeof updateBusinessRules>[1]) => updateBusinessRules(businessId, patch));
  const dirty = any !== savedAny || forAll !== savedFor;
  useUnsavedGuard(dirty);

  const masters = staff.filter((s) => s.role !== 'admin' && s.serviceIds.length > 0);

  const save = async () => {
    try {
      await mutation.mutate({ allowAnyStaffForAllLinks: any, staffForAllBookings: forAll || undefined });
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <section id="staff-choice" className="scroll-mt-24" data-f="F-03-069 F-03-070">
      <SectionCard title={t('settings.staffChoice.title')} description={t('settings.staffChoice.hint')}>
        <div className="flex flex-col gap-4">
          <Switch
            checked={any}
            onCheckedChange={setAny}
            disabled={Boolean(forAll)}
            label={t('linkSettings.steps.allowAnyStaff')}
            description={t('settings.staffChoice.anyHint')}
          />
          <FormField label={t('linkSettings.steps.staffForAllBookings')} hint={t('settings.staffChoice.forAllHint')}>
            <Select
              value={forAll}
              onValueChange={setForAll}
              options={[{ value: '', label: t('settings.staffChoice.clientChooses') }, ...masters.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </FormField>
          {dirty && (
            <div>
              <Button size="sm" onClick={save} loading={mutation.isPending}>
                {t('settings.save')}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>
    </section>
  );
}
