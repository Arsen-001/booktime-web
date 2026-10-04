'use client';

import { ArrowRight, Gift } from 'lucide-react';
import Link from 'next/link';
import { ctaPrimary, sectionTitle } from '@/areas/client/business/cta';
import { useFormat } from '@/i18n/useFormat';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';

/**
 * Цены (решение владельца 04.10.2026): мастер-одиночка — 5 000 ֏ в месяц, салон — 4 000 ֏ за мастера в месяц,
 * не меньше 8 000 ֏; первым салонам первый месяц бесплатно (F-00-012, F-00-013).
 */
const SOLO_PRICE = 5000;
const SALON_PER_MASTER = 4000;
const SALON_MIN = 8000;

export function BusinessPricing() {
  const t = useT('client');
  const { money } = useFormat();
  const localize = useLocalizedHref();

  const plans = [
    { id: 'solo', title: t('bizLanding.pricing.soloTitle'), text: t('bizLanding.pricing.soloText'), price: money(SOLO_PRICE), unit: t('bizLanding.pricing.soloUnit') },
    {
      id: 'salon',
      title: t('bizLanding.pricing.salonTitle'),
      text: t('bizLanding.pricing.salonText'),
      price: money(SALON_PER_MASTER),
      unit: t('bizLanding.pricing.salonUnit'),
      note: t('bizLanding.pricing.salonMin', { min: money(SALON_MIN) }),
    },
  ];

  return (
    <section data-f="F-00-012 F-00-013" className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('bizLanding.pricing.title')}</h2>
        <p className="max-w-[60ch] text-base text-muted md:text-lg">{t('bizLanding.pricing.text')}</p>
      </div>
      <div className="inline-flex w-max max-w-full items-center gap-2.5 rounded-2xl bg-success-soft px-4 py-3 text-[15px] font-semibold text-success">
        <Gift aria-hidden className="size-5 shrink-0" />
        {t('bizLanding.pricing.free')}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {plans.map((p) => (
          <li key={p.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-xl font-bold tracking-tight text-fg">{p.title}</h3>
              <p className="text-[15px] text-muted">{p.text}</p>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <b className="font-display text-[2.25rem] leading-none font-extrabold tracking-tight text-fg tabular-nums">{p.price}</b>
              <span className="text-[15px] text-muted">{p.unit}</span>
            </p>
            {p.note ? <p className="-mt-2 text-sm text-muted">{p.note}</p> : null}
          </li>
        ))}
      </ul>
      <div>
        <Link href={localize('/register-business')} className={ctaPrimary}>
          {t('bizLanding.pricing.cta')}
          <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
