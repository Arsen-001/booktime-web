'use client';

/**
 * Мастерская «заказов» без онлайн-услуг на публичной странице /b/<slug> (05.10.2026): ателье, ремонт техники, химчистка,
 * детейлинг работают не по записи — вместо «Онлайн-запись пока недоступна» страница объясняет, как сдать вещь и как
 * узнать, что готово, и даёт позвонить / написать. Файл раздела online.
 * На телефоне «Позвонить» — липкая панель внизу (PublicBusinessPage), здесь кнопка только с md.
 */
import { BellRing, MessageCircle, PackagePlus, Phone, ReceiptText } from 'lucide-react';
import type { Business, Location } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { telLink, waLink } from '@/lib/phone';
import { buttonClasses } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';

const STEPS = [
  { key: 'bring', Icon: PackagePlus },
  { key: 'receipt', Icon: ReceiptText },
  { key: 'ready', Icon: BellRing },
] as const;

export function OrdersPlaceInfo({ business, location }: { business: Business; location: Location | undefined }) {
  const t = useT('online');
  const phone = location?.phone || business.phone;
  const whatsapp = business.socials?.whatsappNumber;

  return (
    <div data-f="online-orders-place">
      <SectionCard title={t('public.ordersPlace.title')} description={t('public.ordersPlace.description')}>
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3">
            {STEPS.map(({ key, Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                  <Icon aria-hidden className="size-4" />
                </span>
                <p className="pt-1.5 text-sm text-fg">{t(`public.ordersPlace.steps.${key}`)}</p>
              </li>
            ))}
          </ol>
          {(phone || whatsapp) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {phone && (
                // На телефоне «Позвонить» — в липкой панели внизу страницы (как «Записаться», О22)
                <a href={telLink(phone)} className={cn(buttonClasses({ variant: 'primary' }), 'max-md:hidden')}>
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
