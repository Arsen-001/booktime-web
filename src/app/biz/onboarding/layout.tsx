import { OnboardingAccessGate } from '@/areas/settings/OnboardingAccessGate';

// «Быстрый старт» — только с settings.manage (владелец 01.10.2026); приглашение и восстановление — всем
export default function OnboardingLayout({ children }: LayoutProps<'/biz/onboarding'>) {
  return <OnboardingAccessGate>{children}</OnboardingAccessGate>;
}
