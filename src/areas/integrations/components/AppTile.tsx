'use client';

/** Плитка приложения (F-13-006) — витрина, категория, «Установлено». Значок — иконка категории на токенах, без чужих картинок. */
import { Star } from 'lucide-react';
import { APP_ICON, appIconKey, appTileTone } from '@/areas/integrations/catalog';
import { InstallStatusBadge } from '@/areas/integrations/components/InstallStatusBadge';
import type { CatalogApp, InstallStatus } from '@/domain/integrations';
import { ratingLabel } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export interface AppTileProps {
  app: CatalogApp;
  /** И6: статус подключения в выбранных филиалах; нет — приложение не подключено */
  status?: InstallStatus;
  className?: string;
}

function priceText(
  app: CatalogApp,
  t: ReturnType<typeof useT<'integrations'>>,
  money: ReturnType<typeof useFormat>['money'],
): string {
  const p = app.price;
  if (app.builtin) return t('price.builtin');
  switch (p.model) {
    case 'free':
      return t('price.free');
    case 'freeTier':
      return t('price.freeTier');
    case 'trialDays':
      return t('price.trialDays', { n: p.trialDays ?? 14 });
    case 'testPeriod':
      return t('price.testPeriod');
    case 'comingSoon':
      return t('price.comingSoon');
    case 'perMessage':
      return t('price.perMessage', {
        amount:
          p.currency === 'AMD'
            ? money(p.amount ?? 0)
            : `${p.amount} ${p.currency}`,
      });
    case 'fromPrice':
      return t('price.fromPrice', {
        amount:
          p.currency === 'AMD'
            ? money(p.amount ?? 0)
            : `${p.amount} ${p.currency}`,
      });
    default:
      return '';
  }
}

export function AppTile({ app, status, className }: AppTileProps) {
  const t = useT('integrations');
  const { money } = useFormat();
  const Icon = APP_ICON[appIconKey(app)];
  const tile = appTileTone(app.id);

  return (
    <Card
      as="li"
      href={`/biz/integrations/apps/${app.id}`}
      interactive
      padding="md"
      data-f="F-13-006"
      className={cn('flex h-full flex-col gap-3', className)}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tile.fill, color: tile.ink }}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="line-clamp-2 text-sm font-semibold text-fg">{app.name}</p>
            {!app.countries.includes('AM') && !app.builtin && (
              <Badge
                tone="neutral"
                variant="outline"
                size="sm"
                data-f="F-13-154 F-13-166"
              >
                {t(`country.tags.${app.countries[0].toLowerCase()}` as never)}
              </Badge>
            )}
          </div>
          <p className="line-clamp-1 text-xs text-muted">{app.subtitle}</p>
        </div>
      </div>

      {/* Нижняя строка — высотой со значок статуса (min-h-7): плитка подключённого и неподключённого одной высоты,
          ряд и скелетон не меняют высоту, когда приходят статусы */}
      <div className="mt-auto flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-fg">{priceText(app, t, money)}</span>
        {status && status !== 'disconnected' ? (
          <InstallStatusBadge status={status} size="sm" wrap />
        ) : app.reviewsCount > 0 ? (
          <span className="flex items-center gap-1 text-muted">
            <Star
              className="h-3.5 w-3.5 fill-warning text-warning"
              aria-hidden
            />
            {ratingLabel(app.rating)} ·{' '}
            {t('reviewsCountShort', { count: app.reviewsCount })}
          </span>
        ) : (
          <span className="text-muted">{t('newBadge')}</span>
        )}
      </div>
    </Card>
  );
}

/**
 * Скелетон плитки — та же разметка, что AppTile: карточка с отступами, значок 44 px, название, подзаголовок,
 * цена и оценка. Плитки ряда тянутся по самой высокой (h-full), поэтому ряд не меняет высоту, когда приходят данные.
 */
export function AppTileSkeleton({ className, nameLines = 1 }: { className?: string; /** Строк названия (у приложений категорий оно обычно в две строки) */ nameLines?: 1 | 2 }) {
  return (
    <Card as="li" padding="md" aria-hidden className={cn('flex h-full flex-col gap-3', className)}>
      <div className="flex items-start gap-3">
        <Skeleton variant="rect" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="line-clamp-2 w-full text-sm font-semibold text-fg">
              {nameLines === 2 ? <Skeleton lines={2} /> : <SkeletonText width="14ch" />}
            </p>
          </div>
          <p className="line-clamp-1 text-xs text-muted">
            <SkeletonText width="24ch" />
          </p>
        </div>
      </div>

      <div className="mt-auto flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-fg">
          <SkeletonText width="10ch" />
        </span>
        <span className="text-muted">
          <SkeletonText width="12ch" />
        </span>
      </div>
    </Card>
  );
}
