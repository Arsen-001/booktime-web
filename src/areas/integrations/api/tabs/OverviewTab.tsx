'use client';

/** F-13-051: открытый REST API — что даёт, базовый адрес, «видит только данные своего бизнеса». */
import { ShieldCheck } from 'lucide-react';
import { CopyRow } from '@/areas/integrations/components/CopyRow';
import { useOrigin } from '@/areas/integrations/hooks/useOrigin';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { SectionCard } from '@/ui/SectionCard';

export function OverviewTab({ onGoDocs }: { onGoDocs: () => void }) {
  const t = useT('integrations');
  const { businessId } = useCurrent();
  const origin = useOrigin();

  return (
    <div data-f="F-13-051" className="flex flex-col gap-4">
      <SectionCard title={t('api.overview.title')} description={t('api.overview.text')}>
        <CopyRow label={t('api.overview.baseUrlLabel')} value={`${origin || 'https://app.example'}/api/v1`} />
      </SectionCard>

      <Card className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="font-medium text-fg">{t('api.overview.scopeTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('api.overview.scopeText', { id: businessId ?? '—' })}</p>
        </div>
      </Card>

      <button
        type="button"
        onClick={onGoDocs}
        className="inline-flex min-h-11 items-center self-start text-sm text-primary-text underline decoration-border-strong underline-offset-2"
      >
        {t('api.overview.docsLink')}
      </button>
    </div>
  );
}
