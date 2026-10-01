'use client';

/**
 * /biz/integrations/developers/help — F-13-029 «Центр помощи» разработчика: ссылки на гайд и на
 * документацию API; b05: требования к SMS-агрегатору (F-13-049), публикация телефонии (F-13-105) и блок
 * «Партнёрство и контакты» (F-13-050).
 */
import { BookOpen, Code2, MessageSquareText, Phone, Users } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';

export function DeveloperHelpScreen() {
  const t = useT('integrations');

  return (
    <div data-f="F-13-029" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('developers.help.title')} description={t('developers.help.subtitle')} back={{ href: '/biz/integrations/developers' }} />

      <Card className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden>
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium text-fg">{t('developers.help.guideTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('developers.help.guideText')}</p>
          <Link href="/biz/integrations/developers" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary-text underline decoration-border-strong underline-offset-2">
            {t('developers.help.guideLink')}
          </Link>
        </div>
      </Card>

      <Card className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text" aria-hidden>
          <Code2 className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium text-fg">{t('developers.help.apiDocsTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('developers.help.apiDocsText')}</p>
          <Link href="/biz/integrations/api?tab=docs" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary-text underline decoration-border-strong underline-offset-2">
            {t('developers.help.apiDocsLink')}
          </Link>
        </div>
      </Card>

      <Card data-f="F-13-049" className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden>
          <MessageSquareText className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-fg">{t('developers.help.smsAggregatorTitle')}</p>
          <p className="text-sm text-muted">{t('developers.help.smsAggregatorText')}</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-muted">
            {(t.raw('developers.help.smsAggregatorItems') as string[]).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card data-f="F-13-105" className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text" aria-hidden>
          <Phone className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-fg">{t('developers.help.telephonyTitle')}</p>
          <p className="text-sm text-muted">{t('developers.help.telephonyText')}</p>
        </div>
      </Card>

      <Card data-f="F-13-050" className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden>
          <Users className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-fg">{t('developers.help.partnershipTitle')}</p>
          <p className="text-sm text-muted">{t('developers.help.partnershipText')}</p>
          <p className="text-sm text-muted">{t('developers.help.partnershipContacts')}</p>
          <p className="text-xs text-muted">{t('developers.help.requestFeatureNote')}</p>
        </div>
      </Card>
    </div>
  );
}
