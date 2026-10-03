import type { Metadata } from 'next';
import { RegisterBusinessScreen } from '@/areas/client/register-business/RegisterBusinessScreen';
import { clampDescription, seoContext } from '@/lib/seo/describe';
import { pageMetadata } from '@/lib/seo/meta';

// SEO (04.10.2026): заголовок и описание на языке запроса, canonical на языке страницы + hreflang ru/hy/en (как у главной)
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await seoContext();
  return pageMetadata({
    title: t('seo.registerBusiness.title'),
    description: clampDescription(t('seo.registerBusiness.description')),
    path: '/register-business',
    locale,
  });
}

// /register-business — регистрация бизнеса: тип, сфера, промокод (F-00-035)
export default function Page() {
  return <RegisterBusinessScreen />;
}
