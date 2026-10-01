'use client';

/** Вкладка «Информация» карточки приложения (F-13-008): галерея-заглушка, описание, возможности, FAQ, юр. данные */
import { CheckCircle2 } from 'lucide-react';
import type { CatalogApp } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { KeyValueList } from '@/ui/KeyValueList';

export function AppInfoTab({ app, faq }: { app: CatalogApp; faq: { q: string; a: string }[] }) {
  const t = useT('integrations');
  return (
    <div className="flex flex-col gap-6" data-f="F-13-008">
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-surface-2 text-sm text-muted">
        {t('app.screenshotPlaceholder')}
      </div>

      {app.description && (
        <Accordion
          variant="plain"
          items={[{ id: 'about', title: t('app.aboutTitle'), content: <p className="text-sm text-muted">{app.description}</p> }]}
        />
      )}

      {app.features.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">{t('app.featuresTitle')}</h3>
          <ul className="flex flex-col gap-1.5">
            {app.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-text" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      {faq.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">{t('app.faqTitle')}</h3>
          <Accordion items={faq.map((f, i) => ({ id: `faq-${i}`, title: f.q, content: <p className="text-sm text-muted">{f.a}</p> }))} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">{t('app.legalTitle')}</h3>
        <KeyValueList
          columns={1}
          items={[
            { label: t('app.developerLabel'), value: app.developer },
            ...(app.legalInfo ? [{ label: t('app.legalInfoLabel'), value: app.legalInfo }] : []),
            ...(app.policyUrl
              ? [
                  {
                    label: t('app.policyLabel'),
                    value: (
                      <a href={app.policyUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-2">
                        {t('app.policyLink')}
                      </a>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>
    </div>
  );
}
