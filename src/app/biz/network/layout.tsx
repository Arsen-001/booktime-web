import { NetworkAccessGate } from '@/areas/network/NetworkAccessGate';

// Сеть1: кабинет сети закрыт по прямому URL без network.manage (кроме /biz/network/switch), а не только скрыт в меню.
export default function NetworkLayout({ children }: LayoutProps<'/biz/network'>) {
  return <NetworkAccessGate>{children}</NetworkAccessGate>;
}
