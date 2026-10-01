import { ResourcesAccessGate } from '@/areas/resources/ResourcesAccessGate';

// F-16-026: без тонкого права «Ресурсы» раздел закрыт и по прямому адресу, не только скрыт в меню.
export default function ResourcesLayout({ children }: LayoutProps<'/biz/resources'>) {
  return <ResourcesAccessGate>{children}</ResourcesAccessGate>;
}
