/**
 * Категории клиента для ярлыков в журнале (F-01-214, F-00-188).
 * Настоящий справочник категорий — экран «Клиенты → Категории» (clients area, /biz/clients/categories);
 * пока он не построен, читаем по тегу клиента (Client.tags) с этими цветами по умолчанию.
 * См. просьбу в qa/requests/journal.md.
 */
export type ClientCategoryTone =
  "accent" | "primary" | "info" | "success" | "warning";

export interface ClientCategoryMeta {
  /** Слово тега в базе клиентов (см. TAGS в mock/seed/clients.ts), сравнение без учёта регистра */
  match: string;
  labelKey: "vip" | "loyal" | "regular";
  tone: ClientCategoryTone;
}

export const DEFAULT_CLIENT_CATEGORIES: ClientCategoryMeta[] = [
  { match: "vip", labelKey: "vip", tone: "accent" },
  { match: "постоянный", labelKey: "loyal", tone: "primary" },
  { match: "по рекомендации", labelKey: "regular", tone: "info" },
];

export function clientCategories(
  tags: string[] | undefined,
): ClientCategoryMeta[] {
  if (!tags?.length) return [];
  const lower = tags.map((t) => t.toLowerCase());
  return DEFAULT_CLIENT_CATEGORIES.filter((c) => lower.includes(c.match));
}
