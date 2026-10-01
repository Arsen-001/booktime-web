'use client';

/** F-13-184, F-13-185, F-13-201, F-13-202: категория «Платёжные системы» — два входа + блок «Для Армении» */
import { ArrowRight, CreditCard } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { LinkButton } from '@/ui/Button';

export function PaymentsCategoryExtras() {
  const t = useT('integrations');
  return (
    <Card data-f="F-13-184 F-13-185 F-13-201 F-13-202 F-06-155" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden>
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">{t('category.payments.armenia.title')}</p>
          <p className="text-sm text-muted">{t('category.payments.armenia.text')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg">{t('category.payments.withoutProvider.title')}</p>
        <LinkButton href="/biz/finance" variant="secondary" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
          {t('category.payments.withoutProvider.cta')}
        </LinkButton>
      </div>
    </Card>
  );
}
