import { IntegrationsAccessGate } from '@/areas/integrations/IntegrationsAccessGate';

// Решение владельца 01.10: раздел «Интеграции» закрыт по прямому URL без integrations.manage — целиком,
// включая каталог, «API и вебхуки» и «Идентификаторы» (по образцу src/app/biz/finance/layout.tsx).
export default function IntegrationsLayout({ children }: LayoutProps<'/biz/integrations'>) {
  return <IntegrationsAccessGate>{children}</IntegrationsAccessGate>;
}
