import { PublicBusinessPage } from '@/areas/online/public/PublicBusinessPage';

// Минимальный каркас публичной страницы (раздел online развивает): без каталога и соседей.
export default async function Page({ params }: PageProps<'/b/[slug]'>) {
  const { slug } = await params;
  return <PublicBusinessPage slug={slug} />;
}
