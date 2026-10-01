'use client';

/**
 * Вклад «resources» в карточку сотрудника — блок «Ассистирование» (F-16-136, F-16-138): галочка «Доступен
 * для ассистирования» разрешает выбирать сотрудника ассистентом в окне записи (F-16-142). Заведение самого
 * ассистента и компенсацию строит staff/payroll (F-16-137, F-16-140/141 — notOurs, см. план раздела).
 * Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/resources
 */
import Link from 'next/link';
import { listAssistantStaff, setStaffAssistantEligible } from '@/api/resources';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { StaffCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export default function ResourcesStaffCard({ staffId, businessId }: StaffCardExtProps) {
  const t = useT('resources');
  const toast = useToast();
  const staffQ = useApiQuery(['resources', 'assistant-staff', businessId], () => listAssistantStaff(businessId));
  const setEligible = useApiMutation((value: boolean) => setStaffAssistantEligible(staffId, value));

  // Пока список читается — тот же переключатель с подписью (неактивный): блок сразу своей высоты
  const loading = staffQ.isLoading;
  const current = (staffQ.data ?? []).find((s) => s.id === staffId);

  return (
    <div data-f="F-16-136 F-16-138" className="flex flex-col gap-3">
      <Switch
        checked={current?.eligible ?? false}
        disabled={loading || setEligible.isPending}
        onCheckedChange={async (value) => {
          try {
            await setEligible.mutate(value);
            staffQ.refetch();
            toast.success(t('form.updated'));
          } catch {
            toast.error(t('form.saveFailed'));
          }
        }}
        label={t('assistants.eligibleSwitch')}
        description={t('assistants.eligibleSwitchHint')}
      />
      <Link href="/biz/resources/assistants" className="text-sm font-medium text-primary-text hover:underline">
        {t('assistants.editLink')}
      </Link>
    </div>
  );
}
