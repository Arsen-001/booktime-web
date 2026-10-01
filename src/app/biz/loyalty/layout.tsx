import { LoyaltyAccessGate } from '@/areas/loyalty/LoyaltyAccessGate';

// F-06-003: экраны раздела «Лояльность» несут финансовые данные клиентов и должны быть закрыты по
// прямому URL для персоны без права loyalty.manage, а не только скрыты в меню.
export default function LoyaltyLayout({ children }: LayoutProps<'/biz/loyalty'>) {
  return <LoyaltyAccessGate>{children}</LoyaltyAccessGate>;
}
