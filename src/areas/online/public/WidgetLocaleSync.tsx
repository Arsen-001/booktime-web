'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { getPublicBusinessData } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { DEMO_COOKIES } from '@/demo/settings';
import { isLocale } from '@/i18n/config';

const CHOSEN_KEY = 'online.widgetLocaleChosen';
const CABINET_PHONE_KEY = 'online.cabinet.phone';

/**
 * F-03-114 «Какой язык увидит клиент»: язык по умолчанию у ссылки — только для НОВЫХ и неавторизованных
 * клиентов; вернувшийся (у которого уже сохранён явный выбор языка — свой или из личного кабинета)
 * видит свой язык, ссылка его не перебивает (1509, 1401).
 *
 * ⭐ Упрощение (assumed, см. qa/build/online-b04-fix1.md): язык всего приложения — один общий cookie
 * `lang` (DEMO_COOKIES.lang, фундамент), а не отдельно для каждой ссылки/визита — эта же кука двигает язык
 * во всём демо-приложении, включая кабинет бизнеса. Меняем её ТОЛЬКО когда по localStorage видно, что
 * этот браузер ни разу явно не выбирал язык и не входил в личный кабинет (значит это первый визит именно
 * сюда, по этой ссылке) — тогда один раз подставляем язык ссылки и запоминаем, что выбор «использован»,
 * чтобы не перебивать его на каждой странице виджета.
 */
export function WidgetLocaleSync({ slug }: { slug: string }) {
  const router = useRouter();
  const currentLocale = useLocale();
  const q = useApiQuery(['widget-locale-sync', slug], () => getPublicBusinessData(slug));

  useEffect(() => {
    const target = q.data?.link?.defaultLocale;
    if (!target || !isLocale(target)) return;

    // online-widget-lang (qa/build/online-g1-2-fix1.md): кука `lang` — ЕДИНСТВЕННАЯ общая, и ставит её не
    // только этот компонент: proxy.ts по демо-команде `?lang=` (CONVENTIONS `?demo=…&lang=…`), демо-переключатель,
    // и явный выбор языка в личном кабинете клиента (CabinetScreen). Раз кука УЖЕ стоит — она и есть явный выбор
    // (некому больше её поставить: getRequestLocale смотрит только на эту куку, без неё — DEFAULT_LOCALE), и язык
    // ссылки его не перебивает. Раньше проверялись только localStorage-флаги «уже выбирал / уже входил», поэтому
    // свежая кука от `?lang=en` (SSR уже отдал английский по ней) через секунду откатывалась обратно на язык
    // ссылки — ломало и демо-команду, и настоящего клиента, только что выбравшего язык сам.
    let cookieAlreadySet = false;
    try {
      cookieAlreadySet = document.cookie.split('; ').some((c) => c.startsWith(`${DEMO_COOKIES.lang}=`));
    } catch {
      return;
    }
    if (cookieAlreadySet) return;

    let chosen: string | null = null;
    let cabinetPhone: string | null = null;
    try {
      chosen = window.localStorage.getItem(CHOSEN_KEY);
      // О14: вошедший клиент запоминается под online.rememberedClient (старый ключ кабинета — тоже)
      cabinetPhone = window.localStorage.getItem(CABINET_PHONE_KEY) ?? window.localStorage.getItem('online.rememberedClient');
    } catch {
      return; // приватный режим — не трогаем язык, ссылка отработает как обычный визит без запоминания
    }
    if (chosen || cabinetPhone) return; // явный выбор уже был или клиент уже входил — язык ссылки не перебивает
    try {
      window.localStorage.setItem(CHOSEN_KEY, target);
    } catch {
      return;
    }
    if (target === currentLocale) return;
    document.cookie = `${DEMO_COOKIES.lang}=${target}; path=/; max-age=31536000`;
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- запускаем только когда пришли данные ссылки
  }, [q.data?.link?.defaultLocale]);

  return null;
}
