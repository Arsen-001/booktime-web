'use client';

/**
 * Строка клиента на телефоне (ux-r1 №1, ux-r5 улучшение 1, speed-k3 №2): аватар · имя и «был 2 недели назад» ·
 * телефон · долг/аванс, только если не ноль. ~72 px вместо 9 строк «подпись — значение»: на экран влезает 6–7 клиентов.
 */
import type { ClientRow } from '@/domain/clients';
import { BalanceText } from '@/areas/clients/components/BalanceText';
import { formatDisplayName } from '@/areas/clients/lib/rights';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export interface ClientMobileRowProps {
  row: ClientRow;
  canSeeContacts: boolean;
  /** F-04-106: без права — только имя + первая буква фамилии */
  canViewFullName?: boolean;
  /** F-00-132/F-04-200: без права «Просмотр счетов» — баланс/долг не показываем */
  canViewAccounts?: boolean;
  highlighted: boolean;
}

export function ClientMobileRow({ row, canSeeContacts, canViewFullName = true, canViewAccounts = true, highlighted }: ClientMobileRowProps) {
  const t = useT('clients');
  const fmt = useFormat();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={row.name} src={row.avatar} size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate text-base font-semibold text-fg">
            {formatDisplayName(row.name, row.lastName, row.middleName, canViewFullName, false)}
          </span>
          <span className="shrink-0 text-sm text-muted">{row.lastVisit ? fmt.ago(row.lastVisit) : t('table.noVisits')}</span>
        </div>
        {/* Высота строки — под значок (min-h-7): карточки со значком и без одной высоты, скелетон совпадает.
            Не влезают телефон + «Не пришёл: N» + долг — значки уходят на вторую строку, а не за край; не влезают и там (hy) —
            переносятся по одному */}
        <div className="flex min-h-7 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-sm text-muted tabular-nums">{canSeeContacts ? fmt.phone(row.phone) : fmt.maskedPhone(row.phone)}</span>
          <span className="ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1.5">
            {highlighted && <Badge tone="primary">{t('table.newBadge')}</Badge>}
            {row.noShowCount > 0 && <Badge tone="warning">{t('list.noShowsShort', { count: row.noShowCount })}</Badge>}
            {canViewAccounts && <BalanceText balance={row.balance} hideZero className="text-sm font-medium" />}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Скелетон строки клиента — та же разметка: аватар, имя и «когда был», телефон */
export function ClientMobileRowSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Skeleton variant="circle" className="size-10 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate text-base font-semibold text-fg">
            <SkeletonText width="16ch" />
          </span>
          <span className="shrink-0 text-sm text-muted">
            <SkeletonText width="6ch" />
          </span>
        </div>
        <div className="flex h-7 min-w-0 items-center justify-between gap-x-2">
          <span className="whitespace-nowrap text-sm text-muted tabular-nums">
            <SkeletonText width="15ch" />
          </span>
        </div>
      </div>
    </div>
  );
}
