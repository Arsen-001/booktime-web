'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Contact, ExternalLink, Images, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useCoreGet } from '@/api/core';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';

/** Масштаб предпросмотра телефона 390×844 → 195×422 */
const SCALE = 0.5;

function EditRow({ href, icon, title, hint }: { href: string; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 hover:bg-surface-3">
      <span className="text-primary-text [&_svg]:size-5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

/**
 * О27: «Страница для клиентов» показывает саму страницу — предпросмотр телефона и «Открыть страницу», а описание,
 * фото, контакты, часы и соцсети правятся по ссылкам прямо в нужных экранах настроек (хозяин — раздел settings),
 * а не «в тупике» этого экрана.
 */
export function PagePreviewCard({ businessId }: { businessId: Id | undefined }) {
  const t = useT('online');
  const businessQ = useCoreGet('businesses', businessId);
  const slug = businessQ.data?.slug;
  const pageUrl = slug ? `/b/${slug}` : undefined;

  return (
    <SectionCard
      title={t('page.preview.title')}
      description={t('page.preview.hint')}
      actions={
        pageUrl ? (
          <LinkButton href={pageUrl} target="_blank" rel="noopener" size="sm" variant="secondary" leftIcon={<ExternalLink aria-hidden />}>
            {t('page.preview.open')}
          </LinkButton>
        ) : (
          // До данных — та же кнопка на месте, выключена
          <Button size="sm" variant="secondary" leftIcon={<ExternalLink aria-hidden />} disabled>
            {t('page.preview.open')}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div
          className="mx-auto shrink-0 overflow-hidden rounded-[22px] border-4 border-border-strong bg-surface shadow-sm"
          style={{ width: 390 * SCALE + 8, height: 844 * SCALE + 8 }}
        >
          {pageUrl ? (
            <iframe
              src={pageUrl}
              title={t('page.preview.title')}
              tabIndex={-1}
              loading="lazy"
              className="pointer-events-none origin-top-left border-0"
              style={{ width: 390, height: 844, transform: `scale(${SCALE})` }}
            />
          ) : (
            <Skeleton variant="rect" className="size-full" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <EditRow href="/biz/settings/brand" icon={<Images aria-hidden />} title={t('page.preview.brand')} hint={t('page.preview.brandHint')} />
          <EditRow href="/biz/settings/gallery" icon={<Images aria-hidden />} title={t('page.preview.gallery')} hint={t('page.preview.galleryHint')} />
          <EditRow href="/biz/settings/contacts" icon={<Contact aria-hidden />} title={t('page.preview.contacts')} hint={t('page.preview.contactsHint')} />
          <EditRow href="/biz/settings/contacts" icon={<Share2 aria-hidden />} title={t('page.preview.socials')} hint={t('page.preview.socialsHint')} />
        </div>
      </div>
    </SectionCard>
  );
}
