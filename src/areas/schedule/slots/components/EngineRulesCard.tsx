'use client';

/**
 * «Как это работает» (F-02-057, F-00-057, F-02-107): коротко словами мастера и свёрнуто по умолчанию, в самом низу
 * экрана — вместо справки на пол-экрана (ux-r5 L-1, text-q2 №2). Советы «если записей слишком много» — действиями.
 */
import Link from 'next/link';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';

const RULES = ['fits', 'buffer', 'release', 'horizon'] as const;

export function EngineRulesCard() {
  const t = useT('schedule');
  return (
    <Accordion
      items={[
        {
          id: 'engine',
          title: t('slots.engine.title'),
          content: (
            <ul className="flex flex-col gap-2 text-sm text-fg" data-f="F-02-057 F-00-057 F-02-064 F-02-072 F-02-080">
              {RULES.map((key) => (
                <li key={key} className="flex gap-2">
                  <span aria-hidden className="text-muted">
                    •
                  </span>
                  {t(`slots.engine.${key}` as 'slots.engine.fits')}
                </li>
              ))}
            </ul>
          ),
        },
        {
          id: 'limits',
          title: t('slots.limits.title'),
          content: (
            <ul className="flex flex-col gap-2 text-sm" data-f="F-02-107">
              <li>
                <a href="#slot-rules" className="inline-flex min-h-10 items-center text-primary-text underline-offset-4 hover:underline">
                  {t('slots.limits.disableSlots')}
                </a>
              </li>
              <li>
                <Link
                  href="/biz/services"
                  className="inline-flex min-h-10 items-center text-primary-text underline-offset-4 hover:underline"
                >
                  {t('slots.limits.disableServiceOnline')}
                </Link>
              </li>
              <li>
                <Link
                  href="/biz/clients"
                  className="inline-flex min-h-10 items-center text-primary-text underline-offset-4 hover:underline"
                >
                  {t('slots.limits.blockClient')}
                </Link>
              </li>
              <li>
                <a
                  href="#unavailable-days"
                  className="inline-flex min-h-10 items-center text-primary-text underline-offset-4 hover:underline"
                >
                  {t('slots.limits.unavailableDays')}
                </a>
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
