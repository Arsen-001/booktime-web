/**
 * Латиница для показа имён в английском интерфейсе (владелец, 01.10.2026): «Анна Саргсян» → «Anna Sargsyan»,
 * «Աննա» → «Anna». Только отображение — данные не меняются. Латиница и прочие символы проходят как есть.
 *   translitName('Салон «Лилия»') // 'Salon «Liliya»'
 */

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const HY: Record<string, string> = {
  ա: 'a', բ: 'b', գ: 'g', դ: 'd', ե: 'e', զ: 'z', է: 'e', ը: 'y', թ: 't', ժ: 'zh', ի: 'i', լ: 'l', խ: 'kh', ծ: 'ts',
  կ: 'k', հ: 'h', ձ: 'dz', ղ: 'gh', ճ: 'ch', մ: 'm', յ: 'y', ն: 'n', շ: 'sh', ո: 'o', չ: 'ch', պ: 'p', ջ: 'j', ռ: 'r',
  ս: 's', վ: 'v', տ: 't', ր: 'r', ց: 'ts', ւ: 'v', փ: 'p', ք: 'k', և: 'ev', օ: 'o', ֆ: 'f',
};

const HAS_NON_LATIN = /[Ѐ-ӿ԰-֏]/;

function isLetter(ch: string | undefined): boolean {
  return Boolean(ch && /\p{L}/u.test(ch));
}

/** Кириллица (ru) и армянский алфавит → латиница; регистр первой буквы сохраняется */
export function translit(text: string): string {
  if (!text || !HAS_NON_LATIN.test(text)) return text;
  let out = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const upper = ch !== lower;
    const wordStart = !isLetter(chars[i - 1]);
    let latin: string | undefined;
    // Армянский: «ու» → u, «ե»/«ո» в начале слова → ye/vo (Երևան → Yerevan, Ոսկի → Voski)
    if (lower === 'ո' && chars[i + 1]?.toLowerCase() === 'ւ') {
      latin = 'u';
      i++;
    } else if (lower === 'ե' && wordStart) latin = 'ye';
    else if (lower === 'ո' && wordStart) latin = 'vo';
    else latin = RU[lower] ?? HY[lower];
    if (latin === undefined) {
      out += ch;
      continue;
    }
    if (!upper || !latin) {
      out += latin;
      continue;
    }
    // «ЖАННА» → «ZHANNA», «Жанна» → «Zhanna»
    const nextUpper = chars[i + 1] !== undefined && isLetter(chars[i + 1]) && chars[i + 1] === chars[i + 1].toUpperCase();
    out += nextUpper ? latin.toUpperCase() : latin[0].toUpperCase() + latin.slice(1);
  }
  return out;
}
