import { WaitlistAccessGate } from '@/areas/resources/WaitlistAccessGate';

// F-16-169: без права «Показывать лист ожидания» страницы нет и по прямому адресу.
export default function WaitlistLayout({ children }: LayoutProps<'/biz/waitlist'>) {
  return <WaitlistAccessGate>{children}</WaitlistAccessGate>;
}
