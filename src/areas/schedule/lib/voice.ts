/**
 * Разбор фразы вида «Мария, четверг, 15:00, маникюр» в черновик записи (F-00-063).
 * Позже — волна 3, распознавание голосом; сейчас — тот же разбор текста, введённого руками,
 * чтобы «Готово, когда» можно было проверить действием, а не только описанием.
 */
const WEEKDAYS: Record<string, number> = {
  понедельник: 0,
  пн: 0,
  вторник: 1,
  вт: 1,
  среда: 2,
  среду: 2,
  ср: 2,
  четверг: 3,
  чт: 3,
  пятница: 4,
  пятницу: 4,
  пт: 4,
  суббота: 5,
  субботу: 5,
  сб: 5,
  воскресенье: 6,
  вс: 6,
};

export interface VoiceDraft {
  name?: string;
  weekday?: number;
  time?: string;
  serviceText?: string;
  /** Части фразы, которые не удалось разобрать — остаются как есть в «услуге», чтобы ничего не потерять */
  raw: string;
}

/** Ничего не выбрасывает — то, что не разобрано, остаётся в serviceText, мастер поправит руками */
export function parseVoicePhrase(phrase: string): VoiceDraft {
  const raw = phrase.trim();
  const parts = raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);

  let name: string | undefined;
  let weekday: number | undefined;
  let time: string | undefined;
  const rest: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    const timeMatch = lower.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    const weekdayHit = Object.keys(WEEKDAYS).find((w) => lower === w || lower.includes(w));
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    } else if (weekdayHit) {
      weekday = WEEKDAYS[weekdayHit];
    } else if (!name) {
      name = part;
    } else {
      rest.push(part);
    }
  }

  return { name, weekday, time, serviceText: rest.join(', ') || undefined, raw };
}

/**
 * Услуга по разобранному слову (recheck-c2 F-00-063): совпадение с началом слова названия без учёта регистра.
 * Ровно одна — подставляем; несколько — возвращаем все (экран поднимет их наверх списка).
 */
export function matchServices(text: string | undefined, services: { id: string; label: string }[]): string[] {
  const needle = (text ?? '').trim().toLowerCase();
  if (needle.length < 3) return [];
  const words = needle.split(/[\s,]+/).filter((w) => w.length >= 3);
  return services
    .filter((s) => {
      const hay = s.label.toLowerCase().split(/[\s,()«»"-]+/);
      return words.some((w) => hay.some((h) => h.startsWith(w) || (h.length >= 4 && w.startsWith(h.slice(0, Math.max(4, h.length - 2))))));
    })
    .map((s) => s.id);
}
