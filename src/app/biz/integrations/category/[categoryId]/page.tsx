import { notFound } from 'next/navigation';
import { CategoryScreen } from '@/areas/integrations/CategoryScreen';
import { ALL_CATEGORY_IDS, type IntegrationCategoryId } from '@/domain/integrations';

// /biz/integrations/category/[categoryId] — список категории (F-13-004).
// QA 30.09: неизвестная категория (старая или опечатанная ссылка) — 404, а не падение экрана
// («Element type is invalid»: у неизвестного id нет иконки CATEGORY_ICON и текстов).
export default async function Page({ params }: PageProps<'/biz/integrations/category/[categoryId]'>) {
  const { categoryId } = await params;
  if (!ALL_CATEGORY_IDS.includes(categoryId as IntegrationCategoryId)) notFound();
  return <CategoryScreen categoryId={categoryId as IntegrationCategoryId} />;
}
