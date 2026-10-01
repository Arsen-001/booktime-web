'use client';

/**
 * Колонки таблицы клиентов на десктопе (F-04-003): «Имя» первая всегда, закреплённые — сразу за ней.
 * На телефоне таблица рисует свою строку — `ClientMobileRow` (2–3 строки вместо 9 пар «подпись — значение»).
 * Сортирует api (`listClients`), поэтому у колонок нет sortValue — только флаг sortable.
 */
import type { ClientColumnId, ClientRow, ColumnsPrefs } from '@/domain/clients';
import { CLIENT_COLUMN_IDS } from '@/domain/clients';
import { CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import { BalanceText } from '@/areas/clients/components/BalanceText';
import { formatDisplayName } from '@/areas/clients/lib/rights';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Badge } from '@/ui/Badge';
import type { TableColumn } from '@/ui/Table';

/** F-04-202: почта без права контактов — «a•••@mail.com», не полностью скрыта (видно домен, как у телефона) */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return '•••' + email.slice(at);
  return `${email[0]}•••${email.slice(at)}`;
}

/** Порядок отображения: закреплённые (до 5) сразу за «Имя», затем остальные видимые по стандартному порядку */
export function orderedVisibleColumns(prefs: ColumnsPrefs): ClientColumnId[] {
  const visible = CLIENT_COLUMN_IDS.filter((id) => prefs.visible.includes(id));
  const pinned = visible.filter((id) => id !== 'name' && prefs.pinned.includes(id));
  const rest = visible.filter((id) => id !== 'name' && !prefs.pinned.includes(id));
  return ['name', ...pinned, ...rest];
}

/** `canSeeContacts` — право видеть телефон и почту (clients.phones + тонкое «контакты в списке», F-04-194/202) */
export function useClientColumns(
  prefs: ColumnsPrefs,
  highlightId: string | null,
  canSeeContacts: boolean,
  canBook: boolean,
  canViewFullName: boolean = true,
  canViewAccounts: boolean = true,
): TableColumn<ClientRow>[] {
  const t = useT('clients');
  const fmt = useFormat();

  const defs: Record<ClientColumnId, TableColumn<ClientRow>> = {
    name: {
      id: 'name',
      header: t('table.columns.name'),
      cell: (r) => (
        // Длинное ФИО — многоточием в пределах колонки: колонка не шире заданной, скелетон и строка одной ширины
        <span className="flex max-w-[17.5rem] min-w-0 items-center gap-3 whitespace-nowrap">
          <Avatar name={r.name} src={r.avatar} size="sm" />
          <span className="min-w-0 truncate font-medium text-fg">{formatDisplayName(r.name, r.lastName, r.middleName, canViewFullName, false)}</span>
          {highlightId === r.id && (
            <Badge tone="primary" className="animate-fade-in">
              {t('table.newBadge')}
            </Badge>
          )}
        </span>
      ),
      sortable: true,
      width: '18.5rem',
      skeleton: (
        <span className="inline-flex items-center gap-3">
          <Skeleton variant="circle" className="size-8" />
          <SkeletonText width="16ch" />
        </span>
      ),
    },
    phone: {
      id: 'phone',
      header: t('table.columns.phone'),
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{canSeeContacts ? fmt.phone(r.phone) : fmt.maskedPhone(r.phone)}</span>,
      sortable: true,
      width: '9.5rem',
    },
    email: {
      id: 'email',
      header: t('table.columns.email'),
      cell: (r) => (r.email ? canSeeContacts ? r.email : maskEmail(r.email) : <span className="text-muted">—</span>),
      sortable: true,
      width: '14rem',
    },
    sold: {
      id: 'sold',
      header: t('table.columns.sold'),
      cell: (r) => fmt.money(r.sold),
      sortable: true,
      align: 'right',
      width: '7rem',
    },
    balance: {
      id: 'balance',
      header: t('table.columns.balance'),
      cell: (r) => <BalanceText balance={r.balance} />,
      sortable: true,
      align: 'right',
      width: '9rem',
    },
    visits: {
      id: 'visits',
      header: t('table.columns.visits'),
      cell: (r) => fmt.number(r.visits),
      sortable: true,
      align: 'right',
      width: '5.5rem',
    },
    discount: {
      id: 'discount',
      header: t('table.columns.discount'),
      cell: (r) => (r.discount > 0 ? `${r.discount}%` : <span className="text-muted">—</span>),
      sortable: true,
      align: 'right',
      width: '5.5rem',
      // С1 (clients-review 27.09.2026): «Скидка» — самая необязательная из семи колонок по умолчанию
      // (у большинства клиентов 0%) — первая уходит под 1280px, чтобы «Последний визит» не обрезался
      // на 1440 с широким боковым меню (F-00-208, боковое меню теперь всегда 256px, не только на 1440).
      className: 'hidden xl:table-cell',
    },
    lastVisit: {
      id: 'lastVisit',
      header: t('table.columns.lastVisit'),
      // Относительно — «2 недели назад» (ux-r1 №20, core-k2 №1)
      cell: (r) =>
        r.lastVisit ? <span className="whitespace-nowrap">{fmt.ago(r.lastVisit)}</span> : <span className="text-muted">{t('table.noVisits')}</span>,
      sortable: true,
      width: '8.5rem',
    },
    firstVisit: {
      id: 'firstVisit',
      header: t('table.columns.firstVisit'),
      cell: (r) => (r.firstVisit ? <span className="whitespace-nowrap">{fmt.date(r.firstVisit, 'dayMonth')}</span> : <span className="text-muted">—</span>),
      sortable: true,
    },
  };

  // F-00-132/F-04-200: без права «Просмотр счетов» мастер не видит «Продано»/«Баланс» в списке
  const moneyColumns: ClientColumnId[] = ['sold', 'balance'];
  const columns = orderedVisibleColumns(prefs)
    .filter((id) => canViewAccounts || !moneyColumns.includes(id))
    .map((id) => defs[id]);
  if (!canBook) return columns;
  // «Записать» прямо из строки (ux-best-c1 №1): администратор нашёл клиента — сразу окно записи с ним
  const book: TableColumn<ClientRow> = {
    id: 'book',
    header: <span className="sr-only">{t('cardView.book')}</span>,
    width: '3.5rem',
    align: 'right',
    // Место кнопки 40×40 — строка скелетона той же высоты, что строка с кнопкой
    skeleton: <span className="inline-block size-10 align-middle" />,
    cell: (r) => (
      <Link
        href={`/biz/journal?new=1&client=${r.id}`}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('cardView.bookRow', { name: r.name })}
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-primary-text focus-visible:outline-2 focus-visible:outline-focus [&_svg]:size-5"
      >
        <CalendarPlus aria-hidden />
      </Link>
    ),
  };
  return [...columns, book];
}
