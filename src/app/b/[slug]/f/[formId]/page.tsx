import { PublicBusinessPage } from '@/areas/online/public/PublicBusinessPage';

// Та же публичная страница, но по другой ссылке (форме) — F-03-012
export default async function Page({ params }: PageProps<'/b/[slug]/f/[formId]'>) {
  const { slug, formId } = await params;
  return <PublicBusinessPage slug={slug} formId={formId} />;
}
