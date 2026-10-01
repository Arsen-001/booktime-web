'use client';

import { useState } from 'react';
import { Copy, Eye, QrCode, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { copyText } from '@/areas/online/links/copyText';
import { LinkQrModal } from '@/areas/online/links/LinkQrModal';
import type { BookingLink } from '@/domain/online';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export interface LinkCardProps {
  link: BookingLink;
  locationName: string | undefined;
  staffName: string | undefined;
  publicUrl: string;
  onDelete: () => void;
  onMakePrimary: () => void;
  /** О24: бизнес ещё не опубликован — клиенты по ссылке увидят «скоро откроется», предупреждаем при копировании */
  unpublished?: boolean;
}

/** Карточка ссылки в списке (F-03-003) */
export function LinkCard({ link, locationName, staffName, publicUrl, onDelete, onMakePrimary, unpublished = false }: LinkCardProps) {
  const t = useT('online');
  const toast = useToast();
  const [qrOpen, setQrOpen] = useState(false);

  const copy = async () => {
    if (await copyText(publicUrl)) {
      if (unpublished) toast.warning(t('links.card.copiedUnpublished'));
      else toast.success(t('links.card.copied'));
    } else {
      toast.error(t('links.card.copyFailed'));
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-3" data-f="F-03-003">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/biz/online/links/${link.id}`}
            className="inline-flex min-h-10 items-center text-base font-semibold text-fg hover:underline"
          >
            {link.name}
          </Link>
          {locationName && <p className="mt-0.5 text-sm text-muted">{t('links.card.forLocation', { name: locationName })}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" data-f="F-03-004">
          {link.primary && (
            <Badge tone="primary" icon={<Star aria-hidden />} data-f="F-03-007">
              {t('links.card.primary')}
            </Badge>
          )}
          {link.kind === 'network' && <Badge tone="accent">{t('links.card.network')}</Badge>}
          {staffName && <Badge tone="neutral">{t('links.card.forStaff', { name: staffName })}</Badge>}
          {unpublished && (
            <Badge tone="warning" variant="soft">
              {t('links.card.unpublished')}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2" data-f="F-03-009">
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-10 min-w-0 flex-1 items-center truncate text-sm text-primary-text hover:underline"
        >
          {publicUrl.replace(/^https?:\/\//, '')}
        </a>
        <IconButton icon={<Copy aria-hidden />} label={t('links.card.copy')} size="sm" onClick={copy} />
        <IconButton
          icon={<Eye aria-hidden />}
          label={t('links.card.preview')}
          size="sm"
          data-f="F-03-011"
          onClick={() => window.open(publicUrl, '_blank', 'noopener')}
        />
        <IconButton
          icon={<QrCode aria-hidden />}
          label={t('links.card.qr')}
          size="sm"
          onClick={() => setQrOpen(true)}
        />
      </div>

      <LinkQrModal open={qrOpen} onOpenChange={setQrOpen} url={publicUrl} title={link.name} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!link.primary && (
            <Button variant="ghost" size="sm" onClick={onMakePrimary} data-f="F-03-007">
              {t('links.card.makePrimary')}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2" data-f="F-03-010">
          <IconButton
            icon={<Trash2 aria-hidden />}
            label={link.primary ? t('links.card.deleteDisabled') : t('links.card.delete')}
            size="sm"
            variant="ghost"
            disabled={link.primary}
            onClick={onDelete}
            className={link.primary ? undefined : 'text-danger hover:bg-danger-soft'}
          />
          <LinkButton href={`/biz/online/links/${link.id}`} variant="secondary" size="sm">
            {t('links.card.configure')}
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}

/**
 * Скелетон карточки ссылки — та же разметка, что LinkCard у основной ссылки (DESIGN.md «The skeleton IS the page»):
 * название, «для локации …», метка, строка адреса с тремя кнопками, внизу корзина и «Настроить».
 */
export function LinkCardSkeleton() {
  const t = useT('online');
  return (
    <Card padding="md" aria-hidden className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="inline-flex min-h-10 items-center text-base font-semibold text-fg">
            <SkeletonText width="14ch" />
          </span>
          <p className="mt-0.5 text-sm text-muted">
            <SkeletonText width="20ch" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">
            <SkeletonText width="8ch" />
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
        <span className="flex min-h-10 min-w-0 flex-1 items-center truncate text-sm text-primary-text">
          <SkeletonText width="24ch" />
        </span>
        <IconButton icon={<Copy aria-hidden />} label={t('links.card.copy')} size="sm" disabled />
        <IconButton icon={<Eye aria-hidden />} label={t('links.card.preview')} size="sm" disabled />
        <IconButton icon={<QrCode aria-hidden />} label={t('links.card.qr')} size="sm" disabled />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2" />
        <div className="flex items-center gap-2">
          <IconButton icon={<Trash2 aria-hidden />} label={t('links.card.delete')} size="sm" variant="ghost" disabled />
          <Button variant="secondary" size="sm" disabled>
            {t('links.card.configure')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
