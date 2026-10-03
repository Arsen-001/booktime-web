'use client';

import { AdBanner } from '@/areas/client/ui/AdBanner';
import { ForBusinessBanner } from '@/areas/client/home/ForBusinessBanner';
import { FreeTodaySection } from '@/areas/client/home/FreeTodaySection';
import { GuestHero } from '@/areas/client/home/GuestHero';
import { HomeSearchBar } from '@/areas/client/home/HomeSearchBar';
import { MembershipReminderBanner } from '@/areas/client/home/MembershipReminderBanner';
import { MyMastersSection } from '@/areas/client/home/MyMastersSection';
import { HowItWorks } from '@/areas/client/home/HowItWorks';
import { RepeatVisitCard } from '@/areas/client/home/RepeatVisitCard';
import { SphereGrid } from '@/areas/client/home/SphereGrid';
import { SphereLinks } from '@/areas/client/home/SphereLinks';
import { StoriesRow } from '@/areas/client/home/StoriesRow';
import { UpcomingSection } from '@/areas/client/home/UpcomingSection';
import { useClientSession } from '@/areas/client/ui/useClientSession';
import { useT } from '@/i18n/useT';

/**
 * Главная приложения клиента (F-00-001, F-00-008, F-14-010). Порядок — по важности (ux-best-c3 №5, demo-q3/q4):
 * поиск и сферы → сторис → «Свободно сегодня» → мои записи и «снова к мастеру» → мои мастера → реклама.
 * Гостю (владелец 03.10.2026) — первая страница сайта: кто мы и поиск → сферы плитками → «Свободно сегодня», если есть
 * → как записаться → «Вы мастер или салон?» (вариант «Живая запись»). Пустое «Свободно сегодня» гостю не показываем: тупик на первом экране.
 */
export function HomeScreen() {
  const t = useT('client');
  // Раскладка вошедшего — с первого кадра (пока база поднимается, секции рисуют свои скелетоны)
  const { appUserId, signedIn } = useClientSession();

  if (!signedIn) {
    return (
      <div data-f="F-00-172 F-00-175" className="flex flex-col gap-14 md:gap-24">
        <GuestHero />
        {/* Сторис гостю не показываем (владелец 03.10.2026): пустые кружки мелькали и пропадали */}
        <div data-f="F-00-008">
          <SphereGrid />
        </div>
        <FreeTodaySection hideWhenEmpty />
        <HowItWorks />
        <ForBusinessBanner />
        <AdBanner placementId="pl_banner_home" />
      </div>
    );
  }

  return (
    <div data-f="F-00-172 F-00-175" className="flex flex-col gap-6">
      <h1 className="sr-only">{t('home.title')}</h1>
      <div data-f="F-00-008" className="flex flex-col gap-4">
        <HomeSearchBar />
        <SphereLinks />
        <StoriesRow />
      </div>

      <MembershipReminderBanner appUserId={appUserId} />
      <FreeTodaySection />
      <RepeatVisitCard appUserId={appUserId} />
      <UpcomingSection appUserId={appUserId} />
      <MyMastersSection appUserId={appUserId} />
      <AdBanner placementId="pl_banner_home" />
    </div>
  );
}
