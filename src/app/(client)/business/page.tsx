import type { Metadata } from 'next';
import { BusinessLanding } from '@/areas/client/business/BusinessLanding';
import { clampDescription, seoContext } from '@/lib/seo/describe';
import { pageMetadata } from '@/lib/seo/meta';

// SEO (04.10.2026): заголовок и описание на языке запроса, canonical на языке страницы + hreflang ru/hy/en
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await seoContext();
  return pageMetadata({
    title: t('seo.forBusiness.title'),
    description: clampDescription(t('seo.forBusiness.description')),
    path: '/business',
    locale,
    branded: true,
  });
}

// /business — «Для бизнеса»: страница для владельцев салонов, клиник, мастеров и мастерских (F-00-035)
export default function Page() {
  return <BusinessLanding />;
}
