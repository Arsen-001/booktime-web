'use client';

/**
 * Заставка «Расчёт зарплат не настроен» (F-09-010) — до первого «Настроить». Первый шаг порядка
 * первичной настройки (F-09-003): заставка схемы → «Основные настройки» → расчёты. Принадлежит разделу «payroll».
 */
import { Wallet } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export interface SchemePromoProps {
  onConfigure: () => void;
  compact?: boolean;
}

export function SchemePromo({ onConfigure, compact = false }: SchemePromoProps) {
  const t = useT('payroll');
  return (
    <div data-f="F-09-010 F-09-003">
      <EmptyState
        variant={compact ? 'section' : 'page'}
        icon={<Wallet aria-hidden />}
        title={t('scheme.promo.title')}
        description={t('scheme.promo.description')}
        action={<Button onClick={onConfigure}>{t('scheme.promo.action')}</Button>}
        framed={compact}
      />
    </div>
  );
}
