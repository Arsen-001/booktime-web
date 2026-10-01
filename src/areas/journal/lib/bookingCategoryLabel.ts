/** Подпись категории записи (F-01-051): системная — через словарь, своя — введённое имя. */
import type { BookingCategoryDef } from "@/domain/journal";

type SystemLabelKey = NonNullable<BookingCategoryDef["labelKey"]>;

export function bookingCategoryLabel(
  t: (key: `bookingCategories.${SystemLabelKey}`) => string,
  category: BookingCategoryDef,
): string {
  if (category.system && category.labelKey)
    return t(`bookingCategories.${category.labelKey}`);
  return category.name ?? "";
}
