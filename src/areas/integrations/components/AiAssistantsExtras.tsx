'use client';

/**
 * F-13-106/F-13-107: общая механика категории «ИИ-боты и ассистенты» — откуда бот берёт свободные окна и что
 * может записать; ссылка на документацию API (та же, что видит любой сторонний бот).
 */
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';

export function AiAssistantsExtras() {
  const t = useT('integrations');

  return (
    <Card data-f="F-13-106 F-13-107 F-02-093" className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-fg">{t('category.aiAssistants.mechanicTitle')}</p>
      <p className="text-sm text-muted">{t('category.aiAssistants.mechanicText')}</p>
      <Link href="/biz/integrations/api" className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text hover:underline">
        {t('category.aiAssistants.docsLink')}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Card>
  );
}
