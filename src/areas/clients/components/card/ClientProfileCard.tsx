'use client';

/**
 * Профиль клиента в карточке: аватар, телефон, метки, связь и «что важно знать» (ux-r2 улучшение 1, ux-best-c2 №4).
 * К1 (clients-review 27.09.2026): имя — только в заголовке страницы (полное ФИО, ClientCardScreen), здесь не
 * повторяется вторым блоком. Уровень, категории и долг выглядят по-разному: уровень — медалью, категории —
 * нейтральными чипами, неявки — предупреждением, примечание — полосой «Важно знать».
 */
import { Ban, Medal, StickyNote, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ClientRow } from '@/domain/clients';
import { ClientContactButtons } from '@/areas/clients/components/card/ClientContactButtons';
import { ClientReferralBadges } from '@/areas/clients/components/card/ClientReferralBadges';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export interface ClientProfileCardProps {
  row: ClientRow;
  canSeeContacts: boolean;
  canSeeNote: boolean;
  waText: string;
  /** Меню «⋯» на телефоне — в углу карточки, а не отдельной строкой под заголовком */
  menu?: ReactNode;
}

export function ClientProfileCard({ row, canSeeContacts, canSeeNote, waText, menu }: ClientProfileCardProps) {
  const t = useT('clients');
  const fmt = useFormat();
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <Avatar name={row.name} src={row.avatar} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p data-f="F-04-202" className="text-lg font-medium text-fg tabular-nums">
            {canSeeContacts ? fmt.phone(row.phone) : fmt.maskedPhone(row.phone)}
          </p>
          {row.additionalPhone && (
            <p className="text-sm text-muted tabular-nums">{canSeeContacts ? fmt.phone(row.additionalPhone) : fmt.maskedPhone(row.additionalPhone)}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {row.importanceClass && (
              <Badge tone="neutral" icon={<Medal aria-hidden />}>
                {t(`importance.${row.importanceClass}`)}
              </Badge>
            )}
            {row.tags.map((tag) => (
              <Badge key={tag} tone="neutral" variant="outline">
                {tag}
              </Badge>
            ))}
            {row.noShowCount > 0 && (
              <Badge data-f="F-04-156" tone="warning" icon={<UserX aria-hidden />}>
                {t('card.noShowCount', { count: row.noShowCount })}
              </Badge>
            )}
            {row.blocked && (
              <Badge tone="danger" icon={<Ban aria-hidden />}>
                {t('form.blacklisted')}
              </Badge>
            )}
          </div>
          <ClientReferralBadges businessId={row.businessId} clientId={row.id} gender={row.gender} />
        </div>
        {menu && <div className="shrink-0 md:hidden">{menu}</div>}
      </div>

      {row.note && canSeeNote && (
        <div data-f="F-04-057 F-04-195" className="flex gap-3 rounded-xl bg-warning-soft px-4 py-3">
          <StickyNote aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{t('cardView.noteTitle')}</p>
            <p className="text-sm text-fg">{row.note}</p>
          </div>
        </div>
      )}

      {canSeeContacts && <ClientContactButtons phone={row.phone} waText={waText} preferredContact={row.preferredContact} />}
    </Card>
  );
}

/**
 * Профиль до загрузки — та же карточка: аватар 64 px, телефон строкой той же высоты, строка меток (одна плашка),
 * «⋯» на телефоне и ряд из четырёх круглых кнопок связи.
 */
export function ClientProfileCardSkeleton({ canSeeContacts, menu }: { canSeeContacts: boolean; menu?: ReactNode }) {
  return (
    <Card padding="lg" className="flex flex-col gap-4" aria-busy>
      <div className="flex items-start gap-4">
        <Skeleton variant="circle" className="size-16 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-lg font-medium text-fg tabular-nums">
            <SkeletonText width="16ch" />
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" variant="outline">
              <SkeletonText width="7ch" />
            </Badge>
          </div>
        </div>
        {menu && <div className="shrink-0 md:hidden">{menu}</div>}
      </div>
      {canSeeContacts && (
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="circle" className="size-11 shrink-0" />
          ))}
        </div>
      )}
    </Card>
  );
}
