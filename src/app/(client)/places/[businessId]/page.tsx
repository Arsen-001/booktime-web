import type { Metadata } from 'next';
import { PlaceCardScreen } from '@/areas/client/places/PlaceCardScreen';
import { notFoundMetadata } from '@/lib/seo/meta';
import { getPlaceForSeo } from '@/lib/seo/publicData';
import { seoContext } from '@/lib/seo/describe';

// SEO (03.10.2026): карточка места повторяет страницу салона — canonical на /b/<slug>, заголовок — название места
export async function generateMetadata({ params }: PageProps<'/places/[businessId]'>): Promise<Metadata> {
  const { businessId } = await params;
  const r = await getPlaceForSeo(businessId);
  if (!r.ok) return r.notFound ? notFoundMetadata((await seoContext()).t('seo.business.notFound')) : {};
  return { title: r.data.business.name, alternates: { canonical: `/b/${r.data.business.slug}` } };
}

// /places/[businessId] — карточка места для клиента (F-14-028, F-14-030)
export default async function Page({ params }: PageProps<'/places/[businessId]'>) {
  const { businessId } = await params;
  return <PlaceCardScreen businessId={businessId} />;
}
