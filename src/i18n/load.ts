import 'server-only';
import type { AbstractIntlMessages } from 'next-intl';
import { DEFAULT_LOCALE, NAMESPACES, type Locale } from '@/i18n/config';

type Dict = Record<string, unknown>;

async function loadNamespace(locale: Locale, ns: string): Promise<Dict> {
  try {
    return (await import(`../../messages/${locale}/${ns}.json`)).default as Dict;
  } catch {
    return {};
  }
}

function isDict(v: unknown): v is Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Глубокое слияние: base (ru) + сверху перевод. Возвращает ключи, которые взяты из base. */
function mergeWithFallback(base: Dict, over: Dict, prefix: string, fallbacks: string[]): Dict {
  const out: Dict = {};
  for (const key of Object.keys(base)) {
    const b = base[key];
    const o = over[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isDict(b)) {
      out[key] = mergeWithFallback(b, isDict(o) ? o : {}, path, fallbacks);
    } else if (Array.isArray(b)) {
      // Массив (t.raw): перевод берём целиком, если он непустой и без пустых элементов; иначе ru и пометка.
      // Раньше массив перевода не брался никогда — en показывал ru (client b05-fix1, b06-fix1)
      const valid =
        Array.isArray(o) && o.length > 0 && o.every((x) => (typeof x === 'string' ? x.trim() !== '' : x !== null && x !== undefined));
      out[key] = valid ? o : b;
      if (!valid) fallbacks.push(path);
    } else if (typeof o === 'string' && o.trim() !== '') {
      out[key] = o;
    } else {
      out[key] = b;
      fallbacks.push(path);
    }
  }
  // Ключи, которые есть в переводе, но нет в ru, тоже оставляем (без них ru — ошибка типов)
  for (const key of Object.keys(over)) {
    if (!(key in out)) out[key] = over[key];
  }
  return out;
}

export interface LoadedMessages {
  messages: AbstractIntlMessages;
  /** 'namespace.key' — ключи, для которых в этом языке нет перевода и показан ru */
  fallbackKeys: string[];
}

export async function loadMessages(locale: Locale): Promise<LoadedMessages> {
  const messages: Record<string, Dict> = {};
  const fallbackKeys: string[] = [];
  await Promise.all(
    NAMESPACES.map(async (ns) => {
      const base = await loadNamespace(DEFAULT_LOCALE, ns);
      if (locale === DEFAULT_LOCALE) {
        messages[ns] = base;
        return;
      }
      const over = await loadNamespace(locale, ns);
      messages[ns] = mergeWithFallback(base, over, ns, fallbackKeys);
    }),
  );
  return { messages: messages as AbstractIntlMessages, fallbackKeys };
}
