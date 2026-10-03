import type { Metadata } from 'next';
import { HomeScreen } from '@/areas/client/home/HomeScreen';
import { homeJsonLd, seoContext } from '@/lib/seo/describe';
import { JsonLd } from '@/lib/seo/JsonLd';
import { pageMetadata } from '@/lib/seo/meta';

// SEO (03.10.2026): заголовок и описание главной на языке запроса, canonical, Organization + WebSite с поиском
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await seoContext();
  return pageMetadata({ title: t('seo.home.title'), description: t('seo.home.description'), path: '/', locale, branded: true });
}

export default async function Page() {
  const ctx = await seoContext();
  return (
    <>
      <JsonLd data={homeJsonLd(ctx)} />
      <HomeScreen />
    </>
  );
}
