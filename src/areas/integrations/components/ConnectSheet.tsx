'use client';

/**
 * Лист подключения приложения (F-13-014, F-13-015, F-13-016, ⭐ F-00-010): разрешения понятными словами,
 * выбор филиалов у сети, регистрация у партнёра «на сайте» или формой внутри карточки.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { listLocationOptions } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { SCOPE_ORDER } from '@/areas/integrations/catalog';
import { paysPartnerDirectly, type CatalogApp, type RequestedScope } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import type { LocaleCode } from '@/domain/core';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';

export interface ConnectSheetProps {
  app: CatalogApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableLocationIds: string[];
  submitting: boolean;
  onConfirm: (locationIds: string[], scopes: RequestedScope[]) => void;
}

export function ConnectSheet({ app, open, onOpenChange, availableLocationIds, submitting, onConfirm }: ConnectSheetProps) {
  const t = useT('integrations');
  const locale = useLocale() as LocaleCode;
  // Родитель меняет key={} при каждом открытии (см. AppScreen) — компонент монтируется заново,
  // поэтому выбор филиалов не нужно сбрасывать эффектом.
  const [selected, setSelected] = useState<string[]>(availableLocationIds.slice(0, 1));

  const locationsQ = useApiQuery(['integrations', 'locationOptions', availableLocationIds.join(','), locale], () => listLocationOptions(availableLocationIds, locale), {
    enabled: open && app.multiLocation && availableLocationIds.length > 1,
  });

  const scopes = SCOPE_ORDER.filter((s) => app.requestedScopes.includes(s));
  // Ревью 27.09 (И12): что понадобится и что будет после «Подключить» — до нажатия, а не после
  const needs = [
    app.registrationMode === 'website' ? t('connect.needs.account', { developer: app.developer }) : t('connect.needs.contacts'),
    ...(paysPartnerDirectly(app) ? [t('connect.needs.payment')] : []),
    ...(app.ownerOnly ? [t('connect.needs.owner')] : []),
  ];
  const nextSteps = app.builtin ? [t('connect.next.instant')] : (t.raw('connect.next.steps') as string[]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('connect.title', { app: app.name })}
      description={t('connect.subtitle')}
      footer={
        <Button fullWidth loading={submitting} disabled={selected.length === 0} onClick={() => onConfirm(selected, app.requestedScopes)}>
          {t('connect.confirm')}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2" data-f="F-13-014">
          <h3 className="text-sm font-semibold text-fg">{t('connect.permissions.title')}</h3>
          <ul className="flex flex-col gap-1.5">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-2 text-sm text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {t(`connect.permissions.scopes.${scope}` as never)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t('connect.permissions.hint')}</p>
        </section>

        {app.multiLocation && availableLocationIds.length > 1 && (
          <section className="flex flex-col gap-2" data-f="F-13-015">
            <h3 className="text-sm font-semibold text-fg">{t('connect.locations.title')}</h3>
            {locationsQ.isLoading ? (
              <Skeleton lines={3} />
            ) : (
              <div className="flex flex-col gap-1">
                {(locationsQ.data ?? []).map((loc) => (
                  <Checkbox
                    key={loc.id}
                    label={loc.name}
                    checked={selected.includes(loc.id)}
                    onCheckedChange={(checked) => setSelected((prev) => (checked ? [...prev, loc.id] : prev.filter((id) => id !== loc.id)))}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">{t('connect.needs.title')}</h3>
          <ul className="flex flex-col gap-1.5">
            {needs.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3" data-f="F-13-016">
          <h3 className="text-sm font-semibold text-fg">{t('connect.registration.title')}</h3>
          {app.registrationMode === 'website' && app.websiteUrl ? (
            <a
              href={app.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary-text underline decoration-border-strong underline-offset-2"
            >
              {t('connect.registration.websiteLink', { developer: app.developer })}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="text-sm text-muted">{t('connect.registration.form')}</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-fg">{t('connect.next.title')}</h3>
          <ol className="flex flex-col gap-1.5">
            {nextSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-sm text-muted">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text" aria-hidden>
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Sheet>
  );
}
