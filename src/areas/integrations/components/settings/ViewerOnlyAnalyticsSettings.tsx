'use client';

/**
 * F-13-085: Power BI (Metrika360) — отдельный пользователь «только просмотр» может выгружать данные во
 * внешнюю аналитику и ничего не менять.
 */
import { Eye } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { SectionCard } from '@/ui/SectionCard';

export function ViewerOnlyAnalyticsSettings() {
  const t = useT('integrations');

  return (
    <div data-f="F-13-085" className="flex flex-col gap-4">
      <SectionCard title={t('app.settings.viewerOnly.title')}>
        <div className="flex flex-col gap-3">
          <Badge tone="neutral" icon={<Eye className="h-3.5 w-3.5" aria-hidden />}>
            {t('app.settings.viewerOnly.badge')}
          </Badge>
          <p className="text-sm text-muted">{t('app.settings.viewerOnly.hint')}</p>
        </div>
      </SectionCard>
    </div>
  );
}
