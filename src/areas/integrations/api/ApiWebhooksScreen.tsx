'use client';

/**
 * /biz/integrations/api — вкладки «Обзор», «Ключи и токены», «Идентификаторы», «Вебхуки», «MCP и ИИ»,
 * «Документация» (F-13-051…072, пачка b02).
 */
import { BookOpen, Eye, Hash, KeyRound, Sparkles, Webhook } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DocsTab } from '@/areas/integrations/api/tabs/DocsTab';
import { IdentifiersTab } from '@/areas/integrations/api/tabs/IdentifiersTab';
import { KeysTab } from '@/areas/integrations/api/tabs/KeysTab';
import { McpTab } from '@/areas/integrations/api/tabs/McpTab';
import { OverviewTab } from '@/areas/integrations/api/tabs/OverviewTab';
import { WebhooksTab } from '@/areas/integrations/api/tabs/WebhooksTab';
import { useT } from '@/i18n/useT';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { Tabs } from '@/ui/Tabs';

const VALID_TABS = ['overview', 'keys', 'identifiers', 'webhooks', 'mcp', 'docs'] as const;
type TabId = (typeof VALID_TABS)[number];

// b02-shared: 6 вкладок не помещаются на телефоне (390 px) — стрелка прокрутки Tabs перекрывает соседнюю
// подпись. Полная правка — в Tabs.tsx (фундамент), просьба записана в qa/requests/integrations.md. Здесь —
// смягчение своими средствами: иконка есть всегда, полный текст виден от sm и шире, а на телефоне вкладка
// уже втрое — общая ширина полосы меньше, стрелка реже перекрывает текст.
const TAB_ICON: Record<TabId, typeof Eye> = { overview: Eye, keys: KeyRound, identifiers: Hash, webhooks: Webhook, mcp: Sparkles, docs: BookOpen };

// QA 30.09: при 760 px шесть вкладок не влезали и на десктопе 1440 — стрелка прокрутки срезала «Ключи и токены»;
// ширина max-w-5xl (1024 px) вмещает все шесть подписей.
export function ApiWebhooksScreen() {
  const t = useT('integrations');
  const initial = useSearchParams().get('tab');
  const [tab, setTab] = useState<TabId>((VALID_TABS as readonly string[]).includes(initial ?? '') ? (initial as TabId) : 'overview');

  const tabs = VALID_TABS.map((id) => {
    const Icon = TAB_ICON[id];
    return {
      value: id,
      icon: <Icon aria-hidden />,
      label: (
        <>
          <span className="sm:hidden">{t(`api.tabs.short.${id}`)}</span>
          <span className="hidden sm:inline">{t(`api.tabs.${id}`)}</span>
        </>
      ),
    };
  });

  return (
    <div
      data-f="F-13-051 F-13-052 F-13-053 F-13-054 F-13-055 F-13-056 F-13-058 F-13-060 F-13-061 F-13-062 F-13-063 F-13-064 F-13-065 F-13-068 F-13-069 F-13-071 F-13-072 F-13-024 F-13-067 F-01-202 F-01-203 F-08-138"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
    >
      <PageHeader title={t('api.title')} description={t('api.subtitle')} />
      <Tabs items={tabs} value={tab} onValueChange={(v) => setTab(v as TabId)} />

      {tab === 'overview' && <OverviewTab onGoDocs={() => setTab('docs')} />}
      {tab === 'keys' && (
        <PermissionGate permission="integrations.manage" fallback="message">
          <KeysTab />
        </PermissionGate>
      )}
      {tab === 'identifiers' && <IdentifiersTab />}
      {tab === 'webhooks' && (
        // F-13-067: отдельное право «Изменение настроек WebHook» — страница скрыта и без него,
        // не только без общего integrations.manage.
        <PermissionGate permission="integrations.manage" fallback="message">
          <PermissionGate permission="integrations.webhooksEdit" fallback="message">
            <WebhooksTab />
          </PermissionGate>
        </PermissionGate>
      )}
      {tab === 'mcp' && (
        <PermissionGate permission="integrations.manage" fallback="message">
          <McpTab />
        </PermissionGate>
      )}
      {tab === 'docs' && <DocsTab />}
    </div>
  );
}
