'use client';

/**
 * F-13-054: публичная страница статуса платформы (второй пункт «Готово, когда» — есть публичная страница
 * состояния и ссылка на неё из справки/сайта). Моковый статус — фиксированный uptime и журнал инцидентов,
 * без запросов наружу.
 */
import { CheckCircle2 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { EmptyState } from '@/ui/EmptyState';

const COMPONENTS = ['api', 'webhooks', 'widget'] as const;

const INCIDENTS: { id: string; date: string; resolved: boolean }[] = [
  { id: 'inc-2026-08-14', date: '2026-08-14', resolved: true },
];

export function StatusPage() {
  const t = useT('integrations');
  const { date } = useFormat();

  return (
    <div data-f="F-13-054" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('api.docs.status.title')} description={t('api.docs.status.subtitle')} />

      <SectionCard title={t('api.docs.status.uptimeTitle')}>
        <div className="flex flex-col gap-3">
          {COMPONENTS.map((c) => (
            <div key={c} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-fg">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                {t(`api.docs.status.component.${c}`)}
              </span>
              <span className="text-sm text-muted">{t('api.docs.status.uptimeValue', { pct: '99.97' })}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t('api.docs.status.incidentsTitle')}>
        {INCIDENTS.length === 0 ? (
          <EmptyState title={t('api.docs.status.incidentsEmpty')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {INCIDENTS.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                <span className="text-fg">{date(new Date(i.date), 'long')}</span>
                <span className="text-success">{i.resolved ? t('api.docs.status.resolved') : t('api.docs.status.ongoing')}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
