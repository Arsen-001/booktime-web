import { describeBusiness, seoContext } from '@/lib/seo/describe';
import { OG_SIZE, renderOgCard } from '@/lib/seo/ogCard';
import { getPublicBusinessForSeo } from '@/lib/seo/publicData';

// Картинка ссылки на салон для соцсетей и мессенджеров (SEO, 03.10.2026): название, услуги и район, знак BookTime.
// Сервер недоступен или салона нет — общая карточка BookTime с адресом страницы.
export const alt = 'BookTime';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [r, ctx] = await Promise.all([getPublicBusinessForSeo(slug), seoContext()]);
  const footer = `booktime.am/b/${slug}`;
  if (!r.ok) return renderOgCard({ title: ctx.t('app.tagline'), subtitle: ctx.t('seo.og.subtitle'), footer });
  const seo = describeBusiness(ctx, r.data);
  const place = [seo.district, ctx.t('seo.city')].filter(Boolean).join(', ');
  return renderOgCard({ title: seo.name, subtitle: `${seo.services} · ${place}`, tagline: ctx.t('seo.og.subtitle'), footer });
}
