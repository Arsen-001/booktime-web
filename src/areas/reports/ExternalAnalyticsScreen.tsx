'use client';

/**
 * Аналитика, которая живёт не в витрине «Все отчеты» (F-12-002), а рядом с настоящей работой или во
 * внешних сервисах — собрана в одном месте, чтобы не потеряться. Три группы:
 *  - F-12-111 · F-12-114: быстрые цифры в самом кабинете (журнал, карточка клиента, кассы, зарплата,
 *    документы) — карточки ведут на настоящий экран.
 *  - F-12-107…110: внешние сервисы через «Интеграции» (Power BI, ИИ-боты, Google Analytics/Facebook
 *    Pixel, Google Maps) — 🔒 подключения нет, карточки ведут на маркетплейс интеграций/настройки, где
 *    подключение и произойдёт (демо).
 *  - F-12-102…104: аналитика сети — доступна только владельцу сети, у нас это отдельная роль/кабинет
 *    («Сеть и филиалы»); здесь — только справочная карта прав и правило валюты (🔒 демо: сама раздача
 *    прав по отчётам сети живёт в кабинете сети, не в «Отчётах»).
 */
import { ArrowUpRight, Building2, Globe, MessagesSquare, Newspaper, PieChart } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { PermissionGate } from '@/ui/PermissionGate';

interface LinkCardProps {
  icon: ReactNode;
  title: string;
  desc: string;
  href?: string;
  demo?: boolean;
}

function LinkCard({ icon, title, desc, href, demo }: LinkCardProps) {
  const t = useT('reports');
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block text-sm font-semibold text-fg">{title}</span>
          {demo && (
            <Badge tone="neutral" size="sm">
              {t('external.demo')}
            </Badge>
          )}
        </span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
      {href && <ArrowUpRight className="size-4 shrink-0 text-muted" aria-hidden />}
    </>
  );
  const cls =
    'flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5';
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function ExternalAnalyticsScreen() {
  const t = useT('reports');

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div className="flex flex-col gap-6">
        <ReportHeader slug="external" helpBody={t('external.help')} />

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{t('external.groups.inCabinet')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div data-f="F-12-111" className="contents">
              <LinkCard icon={<PieChart className="size-5" aria-hidden />} title={t('external.items.journalSummary.title')} desc={t('external.items.journalSummary.desc')} href="/biz/journal" />
              <LinkCard icon={<PieChart className="size-5" aria-hidden />} title={t('external.items.clientStats.title')} desc={t('external.items.clientStats.desc')} href="/biz/clients" />
              <LinkCard icon={<PieChart className="size-5" aria-hidden />} title={t('external.items.cashAccounts.title')} desc={t('external.items.cashAccounts.desc')} href="/biz/finance/accounts" />
              <LinkCard icon={<PieChart className="size-5" aria-hidden />} title={t('external.items.payrollCalc.title')} desc={t('external.items.payrollCalc.desc')} href="/biz/payroll/period" />
            </div>
            <div data-f="F-12-114" className="contents">
              <LinkCard icon={<Newspaper className="size-5" aria-hidden />} title={t('external.items.documents.title')} desc={t('external.items.documents.desc')} href="/biz/finance/documents" />
              <LinkCard icon={<Newspaper className="size-5" aria-hidden />} title={t('external.items.settlements.title')} desc={t('external.items.settlements.desc')} href="/biz/finance/settlements" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{t('external.groups.services')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div data-f="F-12-107" className="contents">
              <LinkCard demo icon={<PieChart className="size-5" aria-hidden />} title={t('external.items.powerBi.title')} desc={t('external.items.powerBi.desc')} href="/biz/integrations" />
            </div>
            <div data-f="F-12-108" className="contents">
              <LinkCard demo icon={<MessagesSquare className="size-5" aria-hidden />} title={t('external.items.telegramAi.title')} desc={t('external.items.telegramAi.desc')} href="/biz/integrations" />
            </div>
            <div data-f="F-12-109" className="contents">
              <LinkCard demo icon={<Globe className="size-5" aria-hidden />} title={t('external.items.gaFbPixel.title')} desc={t('external.items.gaFbPixel.desc')} href="/biz/online/settings" />
            </div>
            <div data-f="F-12-110" className="contents">
              <LinkCard demo icon={<Globe className="size-5" aria-hidden />} title={t('external.items.googleMaps.title')} desc={t('external.items.googleMaps.desc')} href="/biz/integrations" />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{t('external.groups.network')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div data-f="F-12-102" className="contents">
              <LinkCard demo icon={<Building2 className="size-5" aria-hidden />} title={t('external.items.networkRights.title')} desc={t('external.items.networkRights.desc')} href="/biz/network" />
            </div>
            <div data-f="F-12-103" className="contents">
              <LinkCard demo icon={<Building2 className="size-5" aria-hidden />} title={t('external.items.networkCurrency.title')} desc={t('external.items.networkCurrency.desc')} href="/biz/network" />
            </div>
            <div data-f="F-12-104" className="contents">
              <LinkCard demo icon={<Building2 className="size-5" aria-hidden />} title={t('external.items.networkLoyalty.title')} desc={t('external.items.networkLoyalty.desc')} href="/biz/loyalty" />
            </div>
          </div>
          <p className="text-xs text-muted">{t('external.networkHint')}</p>
        </section>
      </div>
    </PermissionGate>
  );
}
