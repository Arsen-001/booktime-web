'use client';

import { AdBanner } from '@/areas/client/ui/AdBanner';
import { FreeTodaySection } from '@/areas/client/home/FreeTodaySection';
import { HomeSearchBar } from '@/areas/client/home/HomeSearchBar';
import { MembershipReminderBanner } from '@/areas/client/home/MembershipReminderBanner';
import { MyMastersSection } from '@/areas/client/home/MyMastersSection';
import { RepeatVisitCard } from '@/areas/client/home/RepeatVisitCard';
import { SphereLinks } from '@/areas/client/home/SphereLinks';
import { StoriesRow } from '@/areas/client/home/StoriesRow';
import { UpcomingSection } from '@/areas/client/home/UpcomingSection';
import { useClientSession } from '@/areas/client/ui/useClientSession';
import { useT } from '@/i18n/useT';
import { HintBanner } from '@/ui/onboarding/HintBanner';

/**
 * Главная приложения клиента (F-00-001, F-00-008, F-14-010). Порядок — по важности (ux-best-c3 №5, demo-q3/q4):
 * поиск и сферы → сторис → «Свободно сегодня» → мои записи и «снова к мастеру» → мои мастера → реклама.
 * Гостю — тихая подсказка «смотрите без входа» вместо второй кнопки «Войти» (ux-r1 №3, onboarding-k1…k4).
 */
export function HomeScreen() {
  const t = useT('client');
  // Раскладка вошедшего — с первого кадра (пока база поднимается, секции рисуют свои скелетоны)
  const { appUserId, signedIn } = useClientSession();

  return (
    <div data-f="F-00-172 F-00-175" className="flex flex-col gap-6">
      <h1 className="sr-only">{t('home.title')}</h1>
      <div data-f="F-00-008" className="flex flex-col gap-4">
        <HomeSearchBar />
        <SphereLinks />
        <StoriesRow />
      </div>

      {!signedIn && (
        <HintBanner id="client.browseWithoutLogin" scope="global" tone="info" title={t('home.guestHintTitle')}>
          {t('login.guestNotice')}
        </HintBanner>
      )}

      {signedIn && <MembershipReminderBanner appUserId={appUserId} />}

      <FreeTodaySection />

      {signedIn && (
        <>
          <RepeatVisitCard appUserId={appUserId} />
          <UpcomingSection appUserId={appUserId} />
          <MyMastersSection appUserId={appUserId} />
        </>
      )}

      <AdBanner placementId="pl_banner_home" />
    </div>
  );
}
