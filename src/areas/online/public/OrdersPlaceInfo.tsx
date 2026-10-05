'use client';

/**
 * Мастерская «заказов» без онлайн-услуг на публичной странице /b/<slug> (05.10.2026): ателье, ремонт техники, химчистка,
 * детейлинг работают не по записи — вместо «Онлайн-запись пока недоступна» страница объясняет, как сдать вещь и как
 * узнать, что готово, и даёт позвонить / написать. Файл раздела online.
 * На телефоне «Позвонить» — липкая панель внизу (PublicBusinessPage), здесь кнопка только с md.
 * ⭐ Запись на сдачу (05.10.2026): есть окно приёма — главная кнопка «Записаться на сдачу» (на телефоне — в липкой панели),
 * «Позвонить» становится второй.
 */
import { BellRing, CalendarClock, MessageCircle, PackagePlus, Phone, ReceiptText } from 'lucide-react';
import type { Business, Location } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { telLink, waLink } from '@/lib/phone';
import { buttonClasses, LinkButton } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';

const STEPS = [
  { key: 'bring', Icon: PackagePlus },
  { key: 'receipt', Icon: ReceiptText },
  { key: 'ready', Icon: BellRing },
] as const;

export function OrdersPlaceInfo({ business, location, dropOffHref }: { business: Business; location: Location | undefined; dropOffHref?: string }) {
  const t = useT('online');
  const phone = location?.phone || business.phone;
  const whatsapp = business.socials?.whatsappNumber;
  const booked = Boolean(dropOffHref);

  return (
    <div data-f="online-orders-place">
      <SectionCard
        title={t(booked ? 'public.ordersPlace.titleBooked' : 'public.ordersPlace.title')}
        description={t(booked ? 'public.ordersPlace.descriptionBooked' : 'public.ordersPlace.description')}
      >
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3">
            {STEPS.map(({ key, Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                  {booked && key === 'bring' ? <CalendarClock aria-hidden className="size-4" /> : <Icon aria-hidden className="size-4" />}
                </span>
                <p className="pt-1.5 text-sm text-fg">{t(booked && key === 'bring' ? 'public.ordersPlace.steps.bringBooked' : `public.ordersPlace.steps.${key}`)}</p>
              </li>
            ))}
          </ol>
          {(phone || whatsapp || dropOffHref) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {dropOffHref && (
                // На телефоне «Записаться на сдачу» — в липкой панели внизу страницы
                <LinkButton href={dropOffHref} className="max-md:hidden">
                  {t('public.dropOff.button')}
                </LinkButton>
              )}
              {phone && (
                // Без записи на сдачу на телефоне «Позвонить» — в липкой панели внизу страницы (как «Записаться», О22)
                <a href={telLink(phone)} className={cn(buttonClasses({ variant: booked ? 'outline' : 'primary' }), !booked && 'max-md:hidden')}>
                  <Phone aria-hidden className="size-4" />
                  {t('public.ordersPlace.call')}
                </a>
              )}
              {whatsapp && (
                <a href={waLink(whatsapp)} target="_blank" rel="noreferrer" className={buttonClasses({ variant: 'outline' })}>
                  <MessageCircle aria-hidden className="size-4" />
                  {t('public.ordersPlace.write')}
                </a>
              )}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
