'use client';

import { useState } from 'react';
import { Clock, ExternalLink, MapPin, Megaphone, MessageCircle, MessageSquare, Phone, Send, Star, Ticket } from 'lucide-react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { getPublicBusinessData, trackWidgetEvent } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { ApplyWidgetTheme } from '@/areas/online/public/ApplyWidgetTheme';
import { UnpublishedNotice } from '@/areas/online/public/UnpublishedNotice';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { telLink } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton, buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { Sheet } from '@/ui/Sheet';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import type { PromoBlock } from '@/domain/online';

/**
 * Публичная страница салона/мастера по ссылке /b/<slug>[/f/<formId>] (F-00-006, F-00-007, раздел 03).
 * Правило: никаких каталогов, соседей, сторис и рекламы — только этот бизнес.
 * Файл принадлежит разделу online.
 */
export function PublicBusinessPage({ slug, formId }: { slug: string; formId?: string }) {
  const t = useT('online');
  const tc = useT('common');
  const locale = useLocale();
  const [salesOpen, setSalesOpen] = useState(false);
  // F-03-106: «только заголовок → некликабельный баннер; заголовок + описание + картинка → кликабельный,
  // открывает окно с описанием и кнопкой» — карточка сама открывает Modal, вложенная ссылка-кнопка (если
  // есть) была кликабельна и раньше, отдельного окна не было (fix2).
  const [openPromo, setOpenPromo] = useState<PromoBlock | undefined>();

  const q = useApiQuery(['public-business', slug, formId], () => getPublicBusinessData(slug, formId));
  // F-03-116: время показывается в формате, который бизнес выбрал в «Правилах записи»
  const fmt = useFormat({ hourCycle: q.data?.hourCycle });

  // «Записаться» внизу — один и тот же элемент до и после данных (второй ребёнок фрагмента): панель не пересоздаётся
  // и не въезжает заново, когда скелетон сменяется страницей
  const bookBar = (
    <StickyActionBar desktop="hidden">
      <LinkButton href={`/b/${slug}/book`}>{t('public.book')}</LinkButton>
    </StickyActionBar>
  );
  if (q.isLoading) {
    return (
      <>
        <PublicBusinessPageSkeleton slug={slug} />
        {bookBar}
      </>
    );
  }
  if (q.isError) {
    const code = (q.error as { code?: string } | undefined)?.code;
    if (code === 'not_published') return <UnpublishedNotice slug={slug} />;
    const notFound = code === 'not_found';
    return notFound ? (
      <EmptyState title={t('public.notFound')} description={t('public.notFoundHint')} />
    ) : (
      <ErrorState onRetry={q.refetch} />
    );
  }
  if (!q.data) return null;

  const { business, location, categories, services, staff, link, linkStaffGone, promoBlocks, businessStars, networkBranches, addressHidden, todayHours } = q.data;
  const displayName = business.name.trim() || t('public.unnamedBusiness');

  // F-03-008/083: сетевая ссылка без выбранного филиала — сначала выбор локации, дальше — обычная страница.
  if (networkBranches) {
    return (
      <div className="flex flex-col gap-4" data-f="F-03-008">
        <h1 className="text-xl font-semibold text-fg">{t('public.chooseBranch')}</h1>
        <ul className="flex flex-col gap-2" data-f="F-03-083">
          {networkBranches.map((b) => (
            <li key={b.id}>
              <Link href={`/b/${b.slug}${formId ? `/f/${formId}` : ''}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-surface-2">
                <Avatar name={b.name} src={b.logoUrl} colorIndex={1} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{b.name}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {networkBranches.length === 0 && <EmptyState title={t('public.noneOnline.title')} description={t('public.noneOnline.description')} />}
      </div>
    );
  }
  const bookHref = (serviceId?: string, staffId?: string) => {
    const params = new URLSearchParams();
    if (serviceId) params.set('service', serviceId);
    if (staffId) params.set('staff', staffId);
    const qs = params.toString();
    return `/b/${slug}/book${qs ? `?${qs}` : ''}`;
  };

  return (
    <>
    <div data-f="F-00-006" className="flex flex-col gap-4">
      <ApplyWidgetTheme theme={link?.theme} />

      {linkStaffGone && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-fg" data-f="F-03-143">
          {t('public.staffGone')}
        </div>
      )}

      {promoBlocks.map((p) => {
        // «Только заголовок → некликабельный баннер; заголовок + описание + картинка → кликабельный,
        // открывает окно с описанием и кнопкой» (F-03-106, «Логика»).
        const clickable = Boolean(p.description && p.imageUrl);
        const cardContent = (
          <>
            <Megaphone aria-hidden className="size-5 shrink-0 text-primary-text" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{p.title}</p>
              {p.description && <p className="truncate text-sm text-muted">{p.description}</p>}
            </div>
            {!clickable && p.buttonText && p.buttonLink && (
              <a
                href={p.buttonLink}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  void trackWidgetEvent(link?.id, business.id, 'clicked_promo_link');
                }}
                className="shrink-0 text-sm font-medium text-primary-text hover:underline"
              >
                {p.buttonText}
              </a>
            )}
          </>
        );
        return clickable ? (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenPromo(p)}
            data-f="F-03-106"
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2"
          >
            {cardContent}
          </button>
        ) : (
          <Card key={p.id} padding="md" className="flex items-center gap-3" data-f="F-03-106">
            {cardContent}
          </Card>
        );
      })}

      <Modal
        open={Boolean(openPromo)}
        onOpenChange={(open) => !open && setOpenPromo(undefined)}
        title={openPromo?.title ?? ''}
        size="sm"
        footer={
          openPromo?.buttonText && openPromo.buttonLink ? (
            <a
              href={openPromo.buttonLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => void trackWidgetEvent(link?.id, business.id, 'clicked_promo_link')}
              className={buttonClasses({ variant: 'primary', fullWidth: true })}
            >
              {openPromo.buttonText}
            </a>
          ) : undefined
        }
      >
        {openPromo?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={openPromo.imageUrl} alt="" className="mb-3 aspect-video w-full rounded-xl object-cover" />
        )}
        {openPromo?.description && <p className="text-sm text-fg">{openPromo.description}</p>}
      </Modal>

      <Card padding="lg" className="flex flex-col gap-4" data-f="F-03-026">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} src={business.logoUrl} size="xl" colorIndex={1} />
          <div className="min-w-0">
            <Link
              href={`/b/${slug}/about`}
              className="inline-flex min-h-10 items-center text-2xl font-semibold tracking-tight text-fg hover:underline"
            >
              {displayName}
            </Link>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{tc(`businessKind.${business.kind}`)}</Badge>
              {business.sphereIds.map((s) => (
                <Badge key={s} tone="primary">
                  {tc(`spheres.${s}`)}
                </Badge>
              ))}
              {businessStars > 0 && (
                <span data-f="F-03-105">
                  <Badge tone="warning" icon={<Star aria-hidden />}>
                    {businessStars}
                  </Badge>
                </span>
              )}
            </div>
          </div>
        </div>
        {business.description && <p className="text-muted">{pickText(business.description, locale)}</p>}
        {location && (
          <div className="flex flex-col gap-2 text-sm" data-f={addressHidden ? 'F-00-077' : undefined}>
            <p className="flex items-start gap-2 text-fg">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              {addressHidden ? (
                <span>
                  {tc(`districts.${location.district}`)}
                  <span className="block text-xs text-muted">{t('public.addressAfterConfirm')}</span>
                </span>
              ) : (
                <span>
                  {pickText(location.address, locale)} · {tc(`districts.${location.district}`)}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {!addressHidden && location.yandexMapsUrl && (
                <a
                  href={location.yandexMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-text hover:bg-primary-soft"
                >
                  <ExternalLink aria-hidden className="size-4" />
                  {t('public.openMap')}
                </a>
              )}
              <a
                href={telLink(business.phone)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-text hover:bg-primary-soft"
              >
                <Phone aria-hidden className="size-4" />
                {fmt.phone(business.phone)}
              </a>
            </div>
          </div>
        )}
        {todayHours !== undefined && (
          <p className="flex items-center gap-2 text-sm text-fg" data-f="F-15-105">
            <Clock aria-hidden className="size-4 shrink-0 text-muted" />
            {todayHours ? t('public.todayOpenUntil', { from: fmt.time(`2000-01-01T${todayHours.from}`), to: fmt.time(`2000-01-01T${todayHours.to}`) }) : t('public.todayClosed')}
            {location?.hoursText && <span className="text-muted">· {location.hoursText}</span>}
          </p>
        )}
        {/* F-05-137: обратный канал к уведомлениям — клиент сам пишет бизнесу в мессенджер, минуя запись.
        Ссылки, не автоматические уведомления; переписка идёт вне приложения. Показываем только то, что
        бизнес заполнил в «Настройки → Контакты» (F-15-108, F-15-107). */}
        {(business.socials?.whatsappNumber || business.socials?.telegramUrl || business.socials?.viberNumber || business.socials?.facebook || business.socials?.instagram) && (
          <div data-f="F-05-137" className="flex flex-wrap gap-2">
            {business.socials?.whatsappNumber && (
              <a
                href={`https://wa.me/${business.socials.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                <MessageCircle aria-hidden className="size-4" />
                WhatsApp
              </a>
            )}
            {business.socials?.telegramUrl && (
              <a
                href={business.socials.telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                <Send aria-hidden className="size-4" />
                Telegram
              </a>
            )}
            {business.socials?.viberNumber && (
              <a
                href={`viber://chat?number=${encodeURIComponent(business.socials.viberNumber)}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                <MessageSquare aria-hidden className="size-4" />
                Viber
              </a>
            )}
            {business.socials?.facebook && (
              <a
                href={business.socials.facebook.startsWith('http') ? business.socials.facebook : `https://${business.socials.facebook}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                <ExternalLink aria-hidden className="size-4" />
                Facebook
              </a>
            )}
            {business.socials?.instagram && (
              <a
                href={`https://instagram.com/${business.socials.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                <ExternalLink aria-hidden className="size-4" />
                Instagram
              </a>
            )}
          </div>
        )}
        {/* На телефоне «Записаться» — в липкой панели внизу (О22), вторая такая же кнопка в карточке не нужна */}
        <LinkButton href={bookHref()} data-f="F-03-012" className="max-md:hidden">
          {t('public.book')}
        </LinkButton>
        {link?.onlineSalesNetworkId && (
          <div data-f="F-03-107">
            <Button variant="secondary" fullWidth leftIcon={<Ticket aria-hidden className="size-4" />} onClick={() => setSalesOpen(true)}>
              {t('public.sales.button')}
            </Button>
          </div>
        )}
      </Card>

      {/* О22: фото — ниже главной карточки с кнопкой «Записаться», первый экран не занят картинкой */}
      {business.photos.length > 0 && (
        <div data-f="F-03-103" className="overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={business.photos[0]} alt="" className="aspect-video w-full object-cover" />
          {business.photos.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {business.photos.slice(1, 5).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {services.length === 0 || staff.length === 0 ? (
        <div data-f="F-03-134">
          <EmptyState title={t('public.noneOnline.title')} description={t('public.noneOnline.description')} />
        </div>
      ) : (
        <SectionCard title={t('public.services')}>
          <div className="flex flex-col gap-5">
            {categories
              .filter((c) => services.some((s) => s.categoryId === c.id))
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <div key={c.id} className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{pickText(c.name, locale)}</h3>
                  <ul className="divide-y divide-border">
                    {services
                      .filter((s) => s.categoryId === c.id)
                      .sort((a, b) => a.order - b.order)
                      .map((s) => (
                        <li key={s.id} className="flex items-center gap-3 py-3">
                          <Link href={bookHref(s.id)} className="min-w-0 flex-1">
                            <p className="font-medium text-fg">{pickText(s.name, locale)}</p>
                            <p className="text-sm text-muted">
                              {fmt.durationRange(s.durationMin, s.durationMax)} · {fmt.moneyRange(s.priceMin, s.priceMax)}
                            </p>
                          </Link>
                          <LinkButton href={bookHref(s.id)} size="sm" variant="secondary">
                            {t('public.book')}
                          </LinkButton>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        </SectionCard>
      )}

      {business.kind === 'salon' && staff.length > 0 && (
        <SectionCard title={t('public.masters')}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {staff.map((m) => (
              <li key={m.id}>
                <Link href={bookHref(undefined, m.id)} className="flex items-center gap-3 rounded-lg bg-surface-2 p-3 hover:bg-surface-3">
                  <Avatar name={m.name} src={m.avatarUrl} colorIndex={m.colorIndex} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{m.name}</p>
                    {m.position && <p className="truncate text-sm text-muted">{pickText(m.position, locale)}</p>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.accepts !== 'all' && (
                        <span data-f="F-00-070">
                          <Badge tone="neutral" size="sm" variant="soft">
                            {t(m.accepts === 'women' ? 'public.acceptsWomen' : 'public.acceptsMen')}
                          </Badge>
                        </span>
                      )}
                      {/* F-00-078: клиент должен видеть «выезд на дом» на карточке мастера в каталоге, не только
                          персонал в кабинете (StaffCard) — иначе не понятно, почему у мастера нет своих услуг «в салоне». */}
                      {m.workplaces.includes('visit') && (
                        <span data-f="F-00-078">
                          <Badge tone="accent" size="sm" variant="soft" icon={<MapPin aria-hidden />}>
                            {t('public.masterVisitsHome')}
                          </Badge>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {link?.onlineSalesNetworkId && (
        <Sheet open={salesOpen} onOpenChange={setSalesOpen} title={t('public.sales.title')} side="bottom">
          {/* ⭐ Сам виджет онлайн-продаж настраивает и строит раздел «Лояльность» (F-06-147…149) — здесь
              только кнопка-связка (F-03-107); просьба на реальную форму — qa/requests/online.md. */}
          <EmptyState title={t('public.sales.comingSoonTitle')} description={t('public.sales.comingSoonDescription')} />
        </Sheet>
      )}
    </div>
    {/* О22: «Записаться» всегда у большого пальца — липкая панель внизу на всей странице */}
    {services.length > 0 && staff.length > 0 ? bookBar : null}
    </>
  );
}

/**
 * Скелетон публичной страницы — та же раскладка, что у страницы салона (DESIGN.md «The skeleton IS the page»):
 * промоблок, главная карточка (логотип 64, название, метки, описание, адрес, карта, телефон, часы, соцсеть,
 * «Записаться»), фото 16:9 с превью, «Услуги» строками с кнопкой; «Записаться» внизу на телефоне — настоящая.
 */
function PublicBusinessPageSkeleton({ slug }: { slug: string }) {
  const t = useT('online');
  const linkRow = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-medium text-primary-text';
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <Megaphone aria-hidden className="size-5 shrink-0 text-primary-text" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">
            <SkeletonText width="22ch" />
          </p>
          <p className="truncate text-sm text-muted">
            <SkeletonText width="30ch" />
          </p>
        </div>
      </div>

      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="inline-flex size-16 shrink-0" />
          <div className="min-w-0">
            <span className="inline-flex min-h-10 items-center text-2xl font-semibold tracking-tight text-fg">
              <SkeletonText width="12ch" />
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {/* Вид бизнеса, сфера и звёздочки — как у типичной страницы */}
              <Badge tone="neutral">
                <SkeletonText width="5.4ch" />
              </Badge>
              <Badge tone="neutral">
                <SkeletonText width="8.6ch" />
              </Badge>
              <Badge tone="neutral" icon={<Star aria-hidden />}>
                <SkeletonText width="1ch" />
              </Badge>
            </div>
          </div>
        </div>
        <p className="text-muted">
          {/* Описание: на телефоне три строки, шире — две */}
          <Skeleton lines={3} className="sm:hidden" />
          <Skeleton lines={2} className="max-sm:hidden" />
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <p className="flex items-start gap-2 text-fg">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <SkeletonText width="24ch" />
          </p>
          <div className="flex flex-wrap gap-2">
            <span className={linkRow}>
              <ExternalLink aria-hidden className="size-4" />
              {t('public.openMap')}
            </span>
            <span className={linkRow}>
              <Phone aria-hidden className="size-4" />
              <SkeletonText width="15ch" />
            </span>
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-fg">
          <Clock aria-hidden className="size-4 shrink-0 text-muted" />
          <SkeletonText width="20ch" />
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg">
            <ExternalLink aria-hidden className="size-4" />
            <SkeletonText width="8.9ch" />
          </span>
        </div>
        <LinkButton href={`/b/${slug}/book`} className="max-md:hidden">
          {t('public.book')}
        </LinkButton>
      </Card>

      <div className="overflow-hidden rounded-2xl">
        <Skeleton variant="rect" className="aspect-video h-auto w-full rounded-none" />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} variant="rect" className="aspect-square h-auto w-full rounded-lg" />
          ))}
        </div>
      </div>

      <SectionCard title={t('public.services')}>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            <SkeletonText width="9ch" />
          </h3>
          <ul className="divide-y divide-border">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <p className="font-medium text-fg">
                    <SkeletonText width={i % 2 ? '16ch' : '20ch'} />
                  </p>
                  <p className="text-sm text-muted">
                    <SkeletonText width="12ch" />
                  </p>
                </span>
                <LinkButton href={`/b/${slug}/book`} size="sm" variant="secondary">
                  {t('public.book')}
                </LinkButton>
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

    </div>
  );
}
