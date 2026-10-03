import type { Metadata } from 'next';
import { MasterCardScreen } from '@/areas/client/masters/MasterCardScreen';
import { describeMaster, seoContext } from '@/lib/seo/describe';
import { notFoundMetadata, pageMetadata } from '@/lib/seo/meta';
import { getMasterForSeo } from '@/lib/seo/publicData';

// SEO (03.10.2026): «<Имя> — <должность>, <салон> | BookTime»; у мастера-одиночки canonical — его страница /b/<slug>
export async function generateMetadata({ params }: PageProps<'/masters/[staffId]'>): Promise<Metadata> {
  const { staffId } = await params;
  const [r, ctx] = await Promise.all([getMasterForSeo(staffId), seoContext()]);
  if (!r.ok) return r.notFound ? notFoundMetadata(ctx.t('seo.business.notFound')) : {};
  const seo = describeMaster(ctx, r.data);
  return pageMetadata({ title: seo.title, description: seo.description, path: seo.canonicalPath, locale: ctx.locale, type: 'profile' });
}

// /masters/[staffId]?service=… — карточка мастера для клиента (F-00-123); service — из поиска: окна под найденную услугу
export default async function Page({ params, searchParams }: PageProps<'/masters/[staffId]'>) {
  const { staffId } = await params;
  const { service } = await searchParams;
  return <MasterCardScreen staffId={staffId} serviceId={typeof service === 'string' ? service : undefined} />;
}
