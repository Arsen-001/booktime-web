'use client';

/**
 * Пустое состояние «зарплата не настроена» — «Расчёт за день» и «Расчёт за период» (F-09-061).
 * Принадлежит разделу «payroll».
 */
import { Wallet } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export function PayrollNotConfigured() {
  const t = useT('payroll');
  return (
    <div data-f="F-09-061">
      <EmptyState
        icon={<Wallet aria-hidden />}
        title={t('notConfigured.title')}
        description={t('notConfigured.description')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <LinkButton href="/biz/payroll/settings" variant="outline">
              {t('notConfigured.settingsAction')}
            </LinkButton>
            <LinkButton href="/biz/payroll">{t('notConfigured.staffAction')}</LinkButton>
          </div>
        }
      />
    </div>
  );
}
