import 'server-only';
import { FileText, ShieldCheck, UserX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { ACCOUNT_DELETION } from '@/areas/client/legal/accountDeletion';
import { fillOperator } from '@/areas/client/legal/operator';
import { PRIVACY } from '@/areas/client/legal/privacy';
import { TERMS } from '@/areas/client/legal/terms';
import type { LegalDocs, LegalKind } from '@/areas/client/legal/types';
import { isLocale, type Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/localePath';
import { clampDescription } from '@/lib/seo/describe';
import { pageMetadata } from '@/lib/seo/meta';
import { Card } from '@/ui/Card';

const DOCS: Record<LegalKind, LegalDocs> = {
  privacy: PRIVACY,
  terms: TERMS,
  'account-deletion': ACCOUNT_DELETION,
};
const ICONS = {
  privacy: ShieldCheck,
  terms: FileText,
  'account-deletion': UserX,
} as const;
const ORDER: LegalKind[] = ['privacy', 'terms', 'account-deletion'];

/** Подписи вокруг документа (сам текст — в privacy.ts / terms.ts / accountDeletion.ts) */
const UI: Record<Locale, { contents: string; other: string }> = {
  ru: { contents: 'Содержание', other: 'Другие документы' },
  hy: { contents: 'Բովանդակություն', other: 'Այլ փաստաթղթեր' },
  en: { contents: 'Contents', other: 'Other documents' },
};

async function pageLocale(): Promise<Locale> {
  const raw = await getLocale();
  return isLocale(raw) ? raw : 'ru';
}

/** Метаданные юридической страницы: заголовок и описание на языке запроса, canonical + hreflang ru/hy/en */
export async function legalMetadata(kind: LegalKind): Promise<Metadata> {
  const locale = await pageLocale();
  const doc = DOCS[kind][locale];
  return pageMetadata({
    title: doc.title,
    description: clampDescription(doc.description),
    path: `/${kind}`,
    locale,
  });
}

/** Страница документа: заголовок → дата → вступление → содержание → разделы → ссылки на два других документа */
export async function LegalPage({ kind }: { kind: LegalKind }) {
  const locale = await pageLocale();
  const doc = DOCS[kind][locale];
  const fill = (s: string) => fillOperator(s, locale);
  const ui = UI[locale];

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">{doc.title}</h1>
        <p className="text-sm text-muted">{doc.updated}</p>
        {doc.intro.map((p) => (
          <p key={p} className="max-w-[70ch] text-base leading-relaxed text-fg">
            {fill(p)}
          </p>
        ))}
      </header>

      {doc.sections.length > 3 && (
        <Card as="aside" padding="md" aria-labelledby="legal-contents">
          <h2 id="legal-contents" className="mb-2 text-sm font-semibold text-muted">
            {ui.contents}
          </h2>
          <ol className="flex flex-col text-sm">
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex min-h-10 items-center text-primary-text underline-offset-4 hover:underline">
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {doc.sections.map((s, i) => (
        <section key={s.id} id={s.id} className="flex scroll-mt-20 flex-col gap-3">
          <h2 className="text-lg font-semibold text-fg md:text-xl">
            {i + 1}. {s.heading}
          </h2>
          {s.p?.map((p) => (
            <p key={p} className="max-w-[70ch] leading-relaxed text-fg">
              {fill(p)}
            </p>
          ))}
          {s.list &&
            (s.ordered ? (
              <ol className="flex max-w-[70ch] list-decimal flex-col gap-2 pl-6 leading-relaxed text-fg marker:font-semibold marker:text-primary-text">
                {s.list.map((item) => (
                  <li key={item}>{fill(item)}</li>
                ))}
              </ol>
            ) : (
              <ul className="flex max-w-[70ch] list-disc flex-col gap-2 pl-5 leading-relaxed text-fg marker:text-muted">
                {s.list.map((item) => (
                  <li key={item}>{fill(item)}</li>
                ))}
              </ul>
            ))}
          {s.after?.map((p) => (
            <p key={p} className="max-w-[70ch] leading-relaxed text-fg">
              {fill(p)}
            </p>
          ))}
        </section>
      ))}

      <nav aria-label={ui.other} className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-semibold text-muted">{ui.other}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ORDER.filter((k) => k !== kind).map((k) => {
            const Icon = ICONS[k];
            return (
              <Link
                key={k}
                href={localizedPath(`/${k}`, locale)}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-fg transition-colors hover:border-border-strong"
              >
                <Icon aria-hidden className="size-5 shrink-0 text-primary" />
                <span className="font-medium">{DOCS[k][locale].title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </article>
  );
}
