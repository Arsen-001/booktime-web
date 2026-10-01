'use client';

/**
 * Список клиентов за цифрой главной: «Пора позвать» и «Не записались снова». Строка — карточка клиента (ссылка),
 * справа «Позвонить» (tel:, если телефон виден по праву clients.phones). Внизу — рассылка этим людям (право
 * notify.mailings). Длинный список — страницами по 10 (DESIGN.md «Long lists»).
 */
import { Megaphone, Phone, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { LocaleCode } from '@/domain/core';
import type { HomeClientRow } from '@/domain/reports';
import { useCan } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { translit } from '@/lib/translit';
import { Avatar } from '@/ui/Avatar';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { Sheet } from '@/ui/Sheet';

export interface HomeClientsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  clients: HomeClientRow[];
  /** Всего в подборке (список приходит обрезанным до HOME_LIST_LIMIT) */
  total: number;
}

export function HomeClientsSheet({ open, onOpenChange, title, description, clients, total }: HomeClientsSheetProps) {
  const t = useT('reports');
  const canMail = useCan('notify.mailings');
  const { pageItems, pager } = usePagedList(clients);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="md"
      footer={
        canMail && clients.length > 0 ? (
          <LinkButton href="/biz/notifications/mailings" variant="secondary" leftIcon={<Megaphone aria-hidden />} fullWidth>
            {t('home.list.mailing')}
          </LinkButton>
        ) : undefined
      }
    >
      {clients.length === 0 ? (
        <EmptyState compact icon={<Users />} title={t('home.list.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('home.list.count', { n: total })}</p>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {pageItems.map((c) => (
              <ClientRow key={c.clientId} client={c} />
            ))}
          </ul>
          {pager}
          {total > clients.length && <p className="text-sm text-muted">{t('home.list.more', { n: clients.length })}</p>}
        </div>
      )}
    </Sheet>
  );
}

function ClientRow({ client }: { client: HomeClientRow }) {
  const t = useT('reports');
  const f = useFormat();
  const locale = useLocale() as LocaleCode;
  const service = client.serviceName ? pickText(client.serviceName, locale) : '';
  // Английский интерфейс — имя латиницей (владелец, 01.10.2026); данные не меняются
  const name = locale === 'en' ? translit(client.name) : client.name;
  // Прошлый год — с годом («24.10.2025»), иначе «24 окт.» читается как будущая дата
  const day = (d: string) => (d.slice(0, 4) === today().slice(0, 4) ? f.date(d, 'dayMonthShort') : f.date(d, 'short'));
  return (
    <li className="flex min-h-16 items-center gap-2 pr-2">
      <Link
        href={`/biz/clients/${client.clientId}`}
        aria-label={t('home.list.open', { name })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Avatar name={name} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium text-fg">{name}</span>
          {service && <span className="truncate text-[13px] text-muted">{service}</span>}
          <span className="flex flex-wrap gap-x-2 text-[13px] text-muted">
            {client.lastVisit && <span>{t('home.list.lastVisit', { date: day(client.lastVisit) })}</span>}
            {client.dueAt && <span className="font-medium text-primary-text">{t('home.list.dueSince', { date: day(client.dueAt) })}</span>}
          </span>
        </span>
      </Link>
      {client.phone && (
        <a
          href={`tel:${client.phone}`}
          aria-label={t('home.list.call', { name })}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary-text outline-none hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Phone className="size-5" aria-hidden />
        </a>
      )}
    </li>
  );
}
