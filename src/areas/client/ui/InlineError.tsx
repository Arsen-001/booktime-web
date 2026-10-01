'use client';

import { CircleAlert, RefreshCw } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';

/**
 * Ошибка одной секции в одну строку (ux-r1 №4, ux-r5 №5): на главной три полноразмерных ErrorState подряд превращали
 * страницу в стену тревоги. Полный ErrorState — только когда упал весь экран.
 */
export function InlineError({ onRetry }: { onRetry: () => void }) {
  const t = useT('client');
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2">
      <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />
      <p className="min-w-0 flex-1 text-sm text-fg">{t('common.sectionFailed')}</p>
      <Button variant="ghost" size="sm" leftIcon={<RefreshCw aria-hidden />} onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
