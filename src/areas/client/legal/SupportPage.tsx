import 'server-only';
import { ArrowRight, Building2, Mail } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLinks, pageLocale } from '@/areas/client/legal/LegalPage';
import { OPERATOR, fillOperator } from '@/areas/client/legal/operator';
import { SUPPORT } from '@/areas/client/legal/support';
import { localizedPath } from '@/i18n/localePath';
import { cn } from '@/lib/cn';
import { clampDescription } from '@/lib/seo/describe';
import { pageMetadata } from '@/lib/seo/meta';
import { buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';

/** Почта уже настоящая (а не заглушка «[Email для обращений]» из operator.ts) — тогда показываем кнопку «Написать» */
const HAS_EMAIL = /^[^\s@[\]]+@[^\s@]+\.[^\s@]+$/.test(OPERATOR.email);

/** Метаданные /support: заголовок и описание на языке запроса, canonical + hreflang ru/hy/en */
export async function supportMetadata(): Promise<Metadata> {
  const locale = await pageLocale();
  const doc = SUPPORT[locale];
  return pageMetadata({ title: doc.title, description: clampDescription(doc.description), path: '/support', locale });
}

/**
 * /support — «Помощь и поддержка» (05.10.2026; Support URL обоих приложений в App Store и Google Play):
 * заголовок → как связаться → вопросы клиентов → вопросы салонов → документы. Все ответы открыты сразу (без
 * раскрывашек): страница короткая, её читают проверяющие магазинов и поисковики.
 */
export async function SupportPage() {
  const locale = await pageLocale();
  const doc = SUPPORT[locale];
  const fill = (s: string) => fillOperator(s, locale);
  const mailto = `mailto:${OPERATOR.email}?subject=${encodeURIComponent(doc.contact.emailSubject)}`;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">{doc.title}</h1>
        <p className="max-w-[70ch] text-base leading-relaxed text-muted">{doc.intro}</p>
      </header>

      <Card as="section" padding="lg" aria-labelledby="support-contact" data-f="F-00-182" className="flex flex-col gap-4">
        <h2 id="support-contact" className="flex items-center gap-2 text-lg font-semibold text-fg">
          <Mail aria-hidden className="size-5 shrink-0 text-primary" />
          {doc.contact.heading}
        </h2>
        <p className="max-w-[70ch] leading-relaxed text-fg">{fill(doc.contact.text)}</p>
        {HAS_EMAIL && (
          <a href={mailto} data-variant="primary" className={cn(buttonClasses({ variant: 'primary' }), 'self-start')}>
            <Mail aria-hidden />
            {doc.contact.emailCta}
          </a>
        )}
        <div className="border-t border-border pt-4">
          <p className="flex max-w-[70ch] gap-2 text-sm leading-relaxed text-muted">
            <Building2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{doc.contact.business}</span>
          </p>
        </div>
      </Card>

      {doc.groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`support-${g.id}`} className="flex scroll-mt-20 flex-col gap-3">
          <h2 id={`support-${g.id}`} className="text-lg font-semibold text-fg md:text-xl">
            {g.heading}
          </h2>
          <Card padding="none" className="divide-y divide-border">
            {g.items.map((item) => (
              <div key={item.id} id={`${g.id}-${item.id}`} className="flex scroll-mt-20 flex-col gap-1.5 px-4 py-4 sm:px-5">
                <h3 className="text-base font-semibold text-fg">{item.q}</h3>
                <p className="max-w-[70ch] leading-relaxed text-muted">{fill(item.a)}</p>
                {item.links?.map((l) => (
                  <Link
                    key={l.href}
                    href={localizedPath(l.href, locale)}
                    className="inline-flex min-h-10 items-center gap-1.5 self-start font-medium text-primary-text underline-offset-4 hover:underline"
                  >
                    {l.label}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                ))}
              </div>
            ))}
          </Card>
        </section>
      ))}

      <LegalLinks locale={locale} exclude="support" heading={doc.docsHeading} />
    </article>
  );
}
