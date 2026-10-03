import { PublicBusinessPage } from '@/areas/online/public/PublicBusinessPage';
import { businessJsonLd, describeBusiness, seoContext } from '@/lib/seo/describe';
import { JsonLd } from '@/lib/seo/JsonLd';
import { getPublicBusinessForSeo } from '@/lib/seo/publicData';

// Минимальный каркас публичной страницы (раздел online развивает): без каталога и соседей.
// SEO (03.10.2026): в режиме api страница приходит с сервера уже с данными (не скелетон до гидрации) — поисковик
// и человек сразу видят название, адрес, услуги и цены; плюс разметка schema.org (LocalBusiness нужного подтипа).
export default async function Page({ params }: PageProps<'/b/[slug]'>) {
  const { slug } = await params;
  const [r, ctx] = await Promise.all([getPublicBusinessForSeo(slug), seoContext()]);
  const data = r.ok ? r.data : undefined;
  return (
    <>
      {data && <JsonLd data={businessJsonLd(ctx, data, describeBusiness(ctx, data))} />}
      <PublicBusinessPage slug={slug} initialData={data} />
    </>
  );
}
