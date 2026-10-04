'use client';

import { Check } from 'lucide-react';
import { sectionTitle } from '@/areas/client/business/cta';
import { useT } from '@/i18n/useT';

/**
 * «Чем BookTime отличается от Altegio, Emly и Booker.am» — только факты из docs/better-than-altegio.md и
 * docs/competitors/*.md (03.10.2026), спокойным тоном. Строки, где о конкуренте в документах нет данных или где мы
 * сами ещё «скоро» (приложения, вход по WhatsApp/SMS до ключей Meta/Twilio), сюда не берём.
 * Компьютер — таблица с выделенной колонкой BookTime; телефон — карточка на каждую строку.
 */
const ROWS = ['telegram', 'languages', 'catalog', 'prepay'] as const;
const RIVALS = [
  { id: 'altegio', name: 'Altegio' },
  { id: 'emly', name: 'Emly' },
  { id: 'booker', name: 'Booker.am' },
] as const;

export function BusinessCompare() {
  const t = useT('client');

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className={sectionTitle}>{t('bizLanding.compare.title')}</h2>
        <p className="max-w-[60ch] text-base text-muted md:text-lg">{t('bizLanding.compare.text')}</p>
      </div>

      {/* Компьютер и планшет */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
        <table className="w-full table-fixed border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-[20%] px-5 py-4 text-sm font-semibold text-muted">
                {t('bizLanding.compare.feature')}
              </th>
              <th scope="col" className="w-[24%] bg-primary-soft px-5 py-4 font-display text-lg font-extrabold text-primary-text">
                BookTime
              </th>
              {RIVALS.map((r) => (
                <th key={r.id} scope="col" className="px-5 py-4 font-display text-lg font-bold text-fg">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((row) => (
              <tr key={row} className="align-top">
                <th scope="row" className="px-5 py-4 font-semibold text-fg">
                  {t(`bizLanding.compare.rows.${row}.title`)}
                </th>
                <td className="bg-primary-soft px-5 py-4 font-semibold text-fg">
                  <span className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    {t(`bizLanding.compare.rows.${row}.bt`)}
                  </span>
                </td>
                {RIVALS.map((r) => (
                  <td key={r.id} className="px-5 py-4 text-muted">
                    {t(`bizLanding.compare.rows.${row}.${r.id}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Телефон */}
      <ul className="flex flex-col gap-3 md:hidden">
        {ROWS.map((row) => (
          <li key={row} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <h3 className="font-display text-lg font-bold tracking-tight text-fg">{t(`bizLanding.compare.rows.${row}.title`)}</h3>
            <div className="flex gap-2 rounded-xl bg-primary-soft px-3 py-2.5">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              <p className="text-[15px] text-fg">
                <b className="font-bold text-primary-text">BookTime</b> · {t(`bizLanding.compare.rows.${row}.bt`)}
              </p>
            </div>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-2 px-1 text-[15px]">
              {RIVALS.map((r) => (
                <div key={r.id} className="contents">
                  <dt className="font-semibold text-fg">{r.name}</dt>
                  <dd className="text-muted">{t(`bizLanding.compare.rows.${row}.${r.id}`)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted">{t('bizLanding.compare.note')}</p>
    </section>
  );
}
