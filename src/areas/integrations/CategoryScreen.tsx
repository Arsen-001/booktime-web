'use client';

/**
 * /biz/integrations/category/[categoryId] — список категории (F-13-004). Сам экран — CategoryScreenBody;
 * здесь он пересоздаётся по categoryId, чтобы при переходе в другую категорию не показывать карточки прежней
 * (внутри категории поиск, фильтры и страна держат прежний список, пока грузится новый — keepPrevious).
 */
import { CategoryScreenBody } from '@/areas/integrations/CategoryScreenBody';
import type { IntegrationCategoryId } from '@/domain/integrations';

export function CategoryScreen({ categoryId }: { categoryId: IntegrationCategoryId }) {
  return <CategoryScreenBody key={categoryId} categoryId={categoryId} />;
}
