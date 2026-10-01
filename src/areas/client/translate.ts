/**
 * F-00-174: автоперевод своего текста мастера (описание, свои услуги, новости) на en, когда en не
 * заполнен вручную. Реального сервиса перевода в проекте нет (бэкенда нет вовсе) — здесь
 * словарь-заглушка на салонную лексику: правдоподобно демонстрирует пометку «переведено автоматически»
 * и «показать оригинал», реальный перевод подключится вместе с бэкендом.
 */
const DICTIONARY: Record<string, string> = {
  мастер: 'master',
  мастера: 'master',
  маникюр: 'manicure',
  педикюр: 'pedicure',
  стрижка: 'haircut',
  стрижку: 'haircut',
  окрашивание: 'coloring',
  укладка: 'styling',
  massage: 'massage',
  массаж: 'massage',
  брови: 'eyebrows',
  ресницы: 'lashes',
  наращивание: 'extensions',
  опыт: 'experience',
  лет: 'years',
  года: 'years',
  год: 'year',
  работаю: 'working',
  люблю: 'love',
  своё: 'my',
  свою: 'my',
  дело: 'craft',
  клиенты: 'clients',
  клиентов: 'clients',
  качество: 'quality',
  индивидуальный: 'personal',
  подход: 'approach',
  салон: 'salon',
  студия: 'studio',
  запись: 'booking',
  услуга: 'service',
  услуги: 'services',
  цена: 'price',
  скидка: 'discount',
  акция: 'promo',
  новинка: 'new',
  добро: 'welcome',
  пожаловать: 'welcome',
  и: 'and',
  в: 'in',
  на: 'on',
  с: 'with',
  для: 'for',
  не: 'not',
  очень: 'very',
  всегда: 'always',
  жду: 'looking forward to',
  вас: 'you',
};

/**
 * Псевдо-перевод ru → en, слово за словом: известные слова заменяются, пунктуация и регистр первой
 * буквы предложения сохраняются, неизвестные слова остаются как есть (транслитерация — за рамками мока).
 */
export function pseudoTranslateToEn(ru: string): string {
  return ru
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) return chunk;
      const match = chunk.match(/^([«"']*)([\p{L}\p{N}-]*)([.,!?»"':;]*)$/u);
      if (!match) return chunk;
      const [, prefix, word, suffix] = match;
      const lower = word.toLowerCase();
      const translated = DICTIONARY[lower];
      if (!translated) return chunk;
      const capitalized = word[0] === word[0]?.toUpperCase() ? translated[0].toUpperCase() + translated.slice(1) : translated;
      return `${prefix}${capitalized}${suffix}`;
    })
    .join('');
}
