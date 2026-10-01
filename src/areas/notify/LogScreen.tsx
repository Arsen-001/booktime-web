'use client';

/**
 * /biz/notifications/log — журнал отправок: фильтры период/тип/статус/канал/телефон, статусы доставки
 * (F-05-107, F-05-108), типы журнала — и настраиваемые, и служебные (F-05-130).
 *
 * Служебные типы без своего экрана у notify (сама отправка — на хозяине, notify только пишет журнал
 * через выделенные функции api/notify.ts — см. их доккомментарии): F-05-129 (фискальный чек,
 * sendFiscalReceiptEmail — зовёт finance), F-05-131 (выгрузка письмом, sendDataExportEmail — зовёт
 * reports/security), F-05-134 (отчёт «Выполнение плана» по расписанию, sendPlanReportEmail — зовёт
 * network). Пока хозяева не подключили вызов — в журнале демо-строка из сида (mock/slices/notify.ts),
 * чтобы тип был виден и фильтруется «Тип» уже сейчас.
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Download, MessageCircle } from 'lucide-react';
import { listLog, listScheduledLog } from '@/api/notify';
import { useApiQuery } from '@/api/request';
import { sentText, typeLabelIn } from '@/areas/notify/lib/logText';
import { LogMessageModal } from '@/areas/notify/log/LogMessageModal';
import { LogSummary } from '@/areas/notify/log/LogSummary';
import { downloadCsv, toCsv } from '@/lib/csv';
import { LOG_STATUSES } from '@/domain/notify';
import type { LogChannel, LogMessage, LogStatus } from '@/domain/notify';
import { CHANNEL_LABEL_RU, channelLabel } from '@/areas/notify/lib/registry';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Locale } from '@/i18n/config';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { maskPhone, normalizePhone, waLink } from '@/lib/phone';
import { normalizeSearch } from '@/lib/text';
import { toISODate, dayjs } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button, buttonClasses } from '@/ui/Button';
import { type DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { SegmentedControl } from '@/ui/SegmentedControl';
import type { TableColumn } from '@/ui/Table';
import { Table } from '@/ui/Table';

const STATUS_TONE: Record<LogStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  delivered: 'success',
  sent: 'info',
  read: 'success',
  sending: 'neutral',
  notDelivered: 'danger',
  rejected: 'danger',
  insufficientFunds: 'warning',
  rejectedByOperator: 'danger',
  rejectedByRateLimiter: 'warning',
};

/** Точно не дошло — предлагаем «Напомнить через WhatsApp» (ux-best-c1 п.4, ⭐ F-00-121: с номера мастера) */
const RETRY_STATUSES: LogStatus[] = ['notDelivered', 'rejected', 'rejectedByOperator', 'insufficientFunds'];


/** F-05-112: без права на телефоны номер скрыт даже внутри текста сообщения, не только в колонке «Контакт» */
const PHONE_IN_TEXT = /\+?374[\s ]?\d{2}[\s ]?\d{3}[\s ]?\d{3}/g;
function maskPhonesInText(text: string): string {
  return text.replace(PHONE_IN_TEXT, (m) => maskPhone(m));
}
function maskContact(contact: string): string {
  return contact.includes('@') ? contact : maskPhone(contact);
}

export function LogScreen() {
  const t = useT('notify');
  const format = useFormat();
  const locale = useLocale() as Locale;
  const { ready, businessId } = useCurrent();
  const canPhones = useCan('clients.phones');

  const [range, setRange] = useState<DateRange>(() => ({
    from: toISODate(dayjs().subtract(1, 'month')),
    to: toISODate(dayjs()),
  }));
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [phone, setPhone] = useState('');
  // Ув11: «Отправлено» — журнал; «Запланировано» — что уйдёт в ближайшую неделю (напоминания, отложенное ночью)
  const [view, setView] = useState<'sent' | 'scheduled'>('sent');
  const [selected, setSelected] = useState<LogMessage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const sentQ = useApiQuery(['notify', 'log', businessId], () => listLog(businessId!), { enabled: ready && !!businessId });
  const scheduledQ = useApiQuery(['notify', 'logScheduled', businessId], () => listScheduledLog(businessId!), {
    enabled: ready && !!businessId,
  });
  const q = view === 'sent' ? sentQ : scheduledQ;

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    (q.data ?? []).forEach((m) => seen.add(typeLabelIn(m.typeLabel, locale)));
    return Array.from(seen).sort((a, b) => a.localeCompare(b, locale));
  }, [q.data, locale]);

  const filtered = useMemo(() => {
    return (q.data ?? []).filter((m) => {
      // «Запланировано» — будущее: период журнала (прошлый месяц) к нему не применяем
      if (view === 'sent' && range.from && m.createdAt.slice(0, 10) < range.from) return false;
      if (view === 'sent' && range.to && m.createdAt.slice(0, 10) > range.to) return false;
      if (typeFilter && typeLabelIn(m.typeLabel, locale) !== typeFilter) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      if (channelFilter && m.channel !== channelFilter) return false;
      if (phone && !normalizeSearch(m.contact).includes(normalizeSearch(phone))) return false;
      return true;
    });
  }, [q.data, range, typeFilter, statusFilter, channelFilter, phone, locale, view]);

  const activeCount = [typeFilter, statusFilter, channelFilter].filter(Boolean).length;
  const resetFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setChannelFilter('');
    setPhone('');
  };
  const maskText = (text: string) => (canPhones ? text : maskPhonesInText(text));
  const costText = (row: LogMessage) =>
    row.costAmd === undefined ? '—' : row.costAmd === 0 ? t('log.free') : format.money(row.costAmd);

  /** Ув11: настоящая выгрузка — CSV (Excel открывает сразу) по отфильтрованным строкам, а не тост */
  const exportCsv = () => {
    const csv = toCsv(
      filtered.map((row) => [
        format.dateTime(row.createdAt),
        typeLabelIn(row.typeLabel, locale),
        channelLabel(row.channel, locale),
        canPhones ? row.contact : maskContact(row.contact),
        maskText(sentText(row)),
        row.scheduled ? t('log.scheduledBadge') : t(`log.status.${row.status}`),
        row.costAmd ?? '',
      ]),
      [
        t('log.columns.date'),
        t('log.columns.type'),
        t('log.columns.channel'),
        t('log.columns.contact'),
        t('log.columns.text'),
        t('log.columns.status'),
        t('log.columns.costAmd'),
      ],
    );
    downloadCsv(`notifications-${view}-${toISODate(dayjs())}.csv`, csv);
  };

  const columns: TableColumn<LogMessage>[] = [
    // Ширины у всех колонок, длинное — в одну строку с многоточием: скелетон и строки одной ширины и высоты
    { id: 'date', header: t('log.columns.date'), cell: (row) => <span className="whitespace-nowrap">{format.dateTime(row.createdAt)}</span>, width: '11rem', skeletonWidth: '14ch' },
    { id: 'type', header: t('log.columns.type'), cell: (row) => <span className="line-clamp-1">{typeLabelIn(row.typeLabel, locale)}</span>, width: '14rem', skeletonWidth: '18ch' },
    {
      id: 'channel',
      header: t('log.columns.channel'),
      cell: (row) => <span className="block max-w-[9rem] truncate">{channelLabel(row.channel, locale)}</span>,
      mobile: 'meta',
      width: '11rem',
      skeletonWidth: '6ch',
    },
    {
      id: 'contact',
      header: t('log.columns.contact'),
      cell: (row) => <span className="line-clamp-1 break-all">{canPhones ? row.contact : maskContact(row.contact)}</span>,
      mobile: 'subtitle',
      width: '12rem',
      skeletonWidth: '15ch',
    },
    {
      id: 'text',
      header: t('log.columns.text'),
      // Ув16: текст — на языке, на котором он ушёл клиенту, а не на языке кабинета
      cell: (row) => <span className="block max-w-[14rem] truncate">{maskText(sentText(row))}</span>,
      width: '16rem',
      skeletonWidth: '16ch',
    },
    { id: 'cost', header: t('log.columns.cost'), cell: (row) => <span className="whitespace-nowrap tabular-nums">{costText(row)}</span>, width: '7rem', mobile: 'meta', skeletonWidth: '6ch' },
    {
      id: 'status',
      header: t('log.columns.status'),
      cell: (row) =>
        row.scheduled ? (
          <Badge tone="info" size="sm">
            {t('log.scheduledBadge')}
          </Badge>
        ) : (
          <Badge tone={STATUS_TONE[row.status]} size="sm">
            {t(`log.status.${row.status}`)}
          </Badge>
        ),
      mobile: 'badge',
      width: '10rem',
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="9ch" />
        </Badge>
      ),
    },
    {
      id: 'retry',
      header: '',
      cell: (row) => {
        // ⭐ F-00-121: напомнить нужно КЛИЕНТУ, а не мастеру — берём телефон получателя (row.contact),
        // не staffId (это была ошибка: ссылка открывала WhatsApp мастера).
        // F-05-112: без права на телефоны ссылка wa.me/<номер> раскрывала номер — кнопки нет
        const clientPhone = canPhones && row.channel !== 'email' ? normalizePhone(row.contact) : undefined;
        if (!RETRY_STATUSES.includes(row.status) || !clientPhone) return null;
        return (
          <a
            href={waLink(clientPhone, t('log.remindWhatsappText', { text: sentText(row) }))}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            <MessageCircle aria-hidden className="size-3.5" />
            {t('log.remindWhatsapp')}
          </a>
        );
      },
      mobile: 'meta',
      width: '12rem',
      // Кнопка «Напомнить» — только у недоставленных; строка и так высотой с кнопку
      skeleton: <span />,
    },
  ];

  return (
    <div
      data-f="F-05-107 F-05-108 F-05-130 F-05-112 F-05-133 F-05-138 F-05-139 F-05-129 F-05-131 F-05-134 F-01-095 F-01-117 F-01-125"
      className="flex flex-col gap-6"
    >
      <PageHeader
        title={t('log.title')}
        description={t('log.subtitle')}
        actions={
          <Button variant="outline" leftIcon={<Download aria-hidden />} onClick={exportCsv} disabled={!filtered.length}>
            {t('log.export')}
          </Button>
        }
      />

      <SegmentedControl
        aria-label={t('log.title')}
        value={view}
        onValueChange={(v) => {
          setView(v as 'sent' | 'scheduled');
        }}
        options={[
          { value: 'sent', label: t('log.views.sent') },
          {
            value: 'scheduled',
            // Пока грузится — место числа уже в подписи: пришли данные — кнопка не меняет ширину
            label: scheduledQ.isLoading || !ready ? (
              <>
                {t('log.views.scheduled')} · <SkeletonText width="2ch" />
              </>
            ) : scheduledQ.data?.length ? (
              `${t('log.views.scheduled')} · ${scheduledQ.data.length}`
            ) : (
              t('log.views.scheduled')
            ),
          },
        ]}
      />

      {view === 'sent' && <LogSummary rows={filtered} loading={!ready || sentQ.isLoading} />}

      <FilterBar
        activeCount={activeCount}
        onReset={resetFilters}
        search={{ value: phone, onValueChange: (v) => { setPhone(v); }, placeholder: t('log.searchPlaceholder') }}
        filters={[
          ...(view === 'sent'
            ? [
                {
                  id: 'period',
                  label: t('log.filters.period'),
                  primary: true,
                  node: <DateRangePicker value={range} onValueChange={(r) => { setRange(r); }} presets />,
                },
              ]
            : []),
          {
            id: 'type',
            label: t('log.filters.type'),
            node: (
              <Select
                placeholder={t('log.filters.anyType')}
                options={typeOptions.map((label) => ({ value: label, label }))}
                value={typeFilter}
                onValueChange={(v) => { setTypeFilter(v); }}
              />
            ),
          },
          {
            id: 'status',
            label: t('log.filters.status'),
            node: (
              <Select
                placeholder={t('log.filters.anyStatus')}
                options={LOG_STATUSES.map((s) => ({ value: s, label: t(`log.status.${s}`) }))}
                value={statusFilter}
                onValueChange={(v) => { setStatusFilter(v); }}
              />
            ),
          },
          {
            id: 'channel',
            label: t('log.filters.channel'),
            node: (
              <Select
                placeholder={t('log.filters.anyChannel')}
                options={(Object.keys(CHANNEL_LABEL_RU) as LogChannel[]).map((c) => ({ value: c, label: channelLabel(c, locale) }))}
                value={channelFilter}
                onValueChange={(v) => { setChannelFilter(v); }}
              />
            ),
          },
        ]}
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <>
          <Table
            columns={columns}
            // Постранично — встроенный вывод Table (10 на странице, выбор 10/20/50/100)
            rows={filtered}
            rowKey={(row) => row.id}
            loading={!ready || q.isLoading}
            loadingRows={10}
            onRowClick={(row) => {
              setSelected(row);
              setDetailOpen(true);
            }}
            empty={
              filtered.length === 0 && (q.data ?? []).length > 0 ? (
                <EmptyState variant="section" kind="search" onReset={resetFilters} description={t('log.emptyFiltered')} />
              ) : view === 'scheduled' ? (
                <EmptyState variant="section" title={t('log.scheduledEmptyTitle')} description={t('log.scheduledEmptyText')} />
              ) : undefined
            }
          />
        </>
      )}

      <LogMessageModal
        message={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        statusTone={STATUS_TONE}
        mask={maskText}
      />
    </div>
  );
}
