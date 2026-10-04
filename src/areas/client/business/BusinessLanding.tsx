'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BusinessBenefits } from '@/areas/client/business/BusinessBenefits';
import { BusinessCompare } from '@/areas/client/business/BusinessCompare';
import { BusinessFaq } from '@/areas/client/business/BusinessFaq';
import { BusinessFinalCta } from '@/areas/client/business/BusinessFinalCta';
import { BusinessHero } from '@/areas/client/business/BusinessHero';
import { BusinessPricing } from '@/areas/client/business/BusinessPricing';
import { BusinessSpheres } from '@/areas/client/business/BusinessSpheres';
import { ctaPrimary } from '@/areas/client/business/cta';
import { HowItWorks } from '@/areas/client/home/HowItWorks';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';

/**
 * /business — «Для бизнеса» (04.10.2026): страница, на которую ведём владельцев салонов, клиник, мастеров и мастерских
 * из WhatsApp, Instagram и звонков. Язык оформления — главная гостя (landing.css): первый экран с живым журналом →
 * что вы получаете → сравнение с Altegio / Emly / Booker.am → переход за один день → для кого → цены → вопросы → призыв.
 */
export function BusinessLanding() {
  const t = useT('client');
  const localize = useLocalizedHref();

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <BusinessHero />
      <BusinessBenefits />
      <BusinessCompare />
      <HowItWorks
        keys="bizLanding.steps"
        text={t('bizLanding.steps.text')}
        footer={
          <div>
            <Link href={localize('/register-business')} className={ctaPrimary}>
              {t('bizLanding.steps.cta')}
              <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        }
      />
      <BusinessSpheres />
      <BusinessPricing />
      <BusinessFaq />
      <BusinessFinalCta />
    </div>
  );
}
