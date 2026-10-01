import type { LocalizedText, LocaleCode } from '@/domain/core';

/** Текст на языке пользователя; нет перевода — ru (F-00-173/174). */
export function pickText(text: LocalizedText | undefined, locale: LocaleCode): string {
  if (!text) return '';
  return text[locale]?.trim() ? (text[locale] as string) : text.ru;
}

/** Инициалы для аватара: «Анна Саргсян» → «АС» */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Поиск без учёта регистра и ё/е */
export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

// Транслитерация для адресов (e2e-q1 №9): «Салон Ани» → «salon-ani», «Նուռ» → «nur»
const RU_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const HY_LATIN: Record<string, string> = {
  ա: 'a', բ: 'b', գ: 'g', դ: 'd', ե: 'e', զ: 'z', է: 'e', ը: 'y', թ: 't', ժ: 'zh', ի: 'i', լ: 'l', խ: 'kh', ծ: 'ts',
  կ: 'k', հ: 'h', ձ: 'dz', ղ: 'gh', ճ: 'ch', մ: 'm', յ: 'y', ն: 'n', շ: 'sh', ո: 'o', չ: 'ch', պ: 'p', ջ: 'j', ռ: 'r',
  ս: 's', վ: 'v', տ: 't', ր: 'r', ց: 'ts', ւ: 'v', փ: 'p', ք: 'k', օ: 'o', ֆ: 'f', և: 'ev',
};

/**
 * Латинский адрес из названия: «E2E Салон Ани» → «e2e-salon-ani», «Նուռ Սթուդիո» → «nur-studio».
 * Только a–z, 0–9 и дефис; пусто, если в названии нет ни букв, ни цифр. Уникальность — uniqueBusinessSlug (api/core).
 */
export function slugify(value: string): string {
  const lower = value.toLowerCase().replace(/ու/g, 'u');
  let out = '';
  for (const ch of lower) out += RU_LATIN[ch] ?? HY_LATIN[ch] ?? ch;
  return out
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}
