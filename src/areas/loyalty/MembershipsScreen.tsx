'use client';

/**
 * /biz/loyalty/memberships — абонементы сети (F-06-129): фильтры по статусу, остатку визитов и сроку
 * окончания; статусы и переходы — F-06-194. Выгрузка — «Операции с Excel».
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Gift, RefreshCw, Search, Upload } from 'lucide-react';
import { findClientByPhone } from '@/api/core';
import { listMembershipTypes, listMemberships, sellMembership } from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { listStaffBrief } from '@/api/client';
import { BulkImportModal } from '@/areas/loyalty/components/BulkImportModal';
import { BadgeSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { MEMBERSHIP_STATUSES, type MembershipStatus } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { SalePaymentField } from '@/areas/loyalty/components/SalePaymentField';
import { downloadCsv, toCsv } from '@/lib/csv';
import { dayjs } from '@/lib/date';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { StatCard } from '@/ui/StatCard';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

const STATUS_TONE: Record<MembershipStatus, BadgeTone> = {
  issued: 'info',
  active: 'success',
  frozen: 'warning',
  used: 'neutral',
  expired: 'danger',
  deactivated: 'neutral',
};

/** F-06-122/F-06-197: продажа абонемента — тип, клиент по телефону (обязателен — абонемент всегда именной), код, цена/скидка/продавец */
function SellMembershipDialog({
  open,
  onOpenChange,
  businessId,
  locationId,
  onSold,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  onSold: () => void;
}) {
  const t = useT('loyalty');
  const toast = useToast();
  const typesQ = useApiQuery(['loyalty', 'membershipTypes', businessId], () => listMembershipTypes(businessId), { enabled: open });
  const staffQ = useApiQuery(['staff', 'brief', businessId], () => listStaffBrief(businessId), { enabled: open });

  const [membershipTypeId, setMembershipTypeId] = useState('');
  const [phone, setPhone] = useState('');
  const [clientId, setClientId] = useState<Id | undefined>(undefined);
  const [clientName, setClientName] = useState('');
  const [searching, setSearching] = useState(false);
  const [code, setCode] = useState('');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [discountPercent, setDiscountPercent] = useState<number | undefined>(undefined);
  const [sellerId, setSellerId] = useState('');
  const [methodKey, setMethodKey] = useState('');

  const format = useFormat();
  // Архивный абонемент не продаётся (в списке продажи его нет; final-api.md: «Безлимит на месяц» был в архиве, но предлагался)
  const sellable = (typesQ.data ?? []).filter((mt) => !mt.archived);
  const type = typesQ.data?.find((mt) => mt.id === membershipTypeId);

  const reset = () => {
    setMembershipTypeId('');
    setPhone('');
    setClientId(undefined);
    setClientName('');
    setCode('');
    setPrice(undefined);
    setDiscountPercent(undefined);
    setSellerId('');
    setMethodKey('');
  };

  const searchClient = async () => {
    if (!phone.trim()) return;
    setSearching(true);
    try {
      const client = await findClientByPhone(businessId, phone.trim());
      if (client) {
        setClientId(client.id);
        setClientName(client.name);
      } else {
        setClientId(undefined);
        setClientName('');
        toast.error(t('sell.clientNotFound'));
      }
    } finally {
      setSearching(false);
    }
  };

  const sellMutation = useApiMutation(() =>
    sellMembership(businessId, {
      membershipTypeId,
      clientId: clientId!,
      code: code.trim() || undefined,
      locationId,
      sellerId: sellerId || undefined,
      price,
      discountPercent,
      payment: methodKey ? { methodKey } : undefined,
    }),
  );

  const canSell = Boolean(type) && Boolean(clientId) && (Boolean(code.trim()) || Boolean(type?.allowNoCode)) && Boolean(methodKey);

  const submit = async () => {
    try {
      await sellMutation.mutate(undefined);
      toast.success(t('sell.membershipSold'));
      reset();
      onOpenChange(false);
      onSold();
    } catch (err) {
      if (err instanceof ApiError && ['payment_setup_incomplete', 'method_not_found', 'invalid_amount', 'forbidden'].includes(err.code)) toast.error(t('sell.paymentFailed'));
      else toast.error(t('sell.needCode'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={t('sell.membershipTitle')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('clientCard.cancel')}
          </Button>
          <Button loading={sellMutation.isPending} disabled={!canSell} onClick={submit}>
            {t('sell.submit')}
          </Button>
        </>
      }
    >
      {sellable.length === 0 && typesQ.data ? (
        <EmptyState compact icon={<Gift aria-hidden />} title={t('sell.noMembershipTypesTitle')} description={t('sell.noMembershipTypesText')} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormField label={t('sell.typeLabel')}>
            <Select
              options={sellable.map((mt) => ({ value: mt.id, label: `${mt.name} · ${format.money(mt.price)}` }))}
              value={membershipTypeId}
              onValueChange={setMembershipTypeId}
              placeholder={t('sell.typePlaceholder')}
            />
          </FormField>
          <FormField label={t('sell.clientLabel')}>
            <div>
              <div className="flex gap-2">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('sell.phonePlaceholder')} />
                <Button variant="outline" leftIcon={<Search aria-hidden />} loading={searching} onClick={searchClient}>
                  {t('sell.find')}
                </Button>
              </div>
              {clientName && <p className="mt-1 text-sm text-success">{clientName}</p>}
            </div>
          </FormField>
          <FormField label={t('sell.codeLabel')} hint={type?.allowNoCode ? t('sell.codeOptionalHint') : t('sell.codeRequiredHint')}>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('sell.codePlaceholder')} />
              <Button
                variant="outline"
                leftIcon={<RefreshCw aria-hidden />}
                onClick={() => setCode(`${Math.floor(100000 + Math.random() * 900000)}`)}
              >
                {t('sell.generate')}
              </Button>
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('sell.priceLabel')}>
              <MoneyInput value={price} onValueChange={setPrice} />
            </FormField>
            <FormField label={t('sell.discountLabel')}>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPercent ?? ''}
                onChange={(e) => setDiscountPercent(Number(e.target.value) || undefined)}
              />
            </FormField>
          </div>
          <FormField label={t('sell.sellerLabel')}>
            <Select
              options={(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              value={sellerId}
              onValueChange={setSellerId}
              placeholder={t('sell.sellerPlaceholder')}
            />
          </FormField>
          <SalePaymentField businessId={businessId} value={methodKey} onChange={setMethodKey} enabled={open} />
        </div>
      )}
    </Modal>
  );
}

export function MembershipsScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId, activeLocationIds } = useCurrent();

  const [status, setStatus] = useState('');
  const [typeId, setTypeId] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [minVisitsLeft, setMinVisitsLeft] = useState('');
  // F-06-133: «заканчивается» — сегмент клиентов с истекающими абонементами (мало визитов уже покрыт
  // minVisitsLeft; тут — по сроку). Пороги 7/30 дней — выбор сборщика, в ТЗ они не заданы (❓ assumed).
  const [expiringWithin, setExpiringWithin] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const saleLocationId = (activeLocationIds[0] ?? businessId) as Id;

  const typesQ = useApiQuery(['loyalty', 'membershipTypes', businessId], () => listMembershipTypes(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const expiresBefore = expiringWithin ? dayjs().add(Number(expiringWithin), 'day').format('YYYY-MM-DD') : undefined;
  const q = useApiQuery(
    ['loyalty', 'memberships', businessId, status, typeId, minVisitsLeft, expiresBefore],
    () =>
      listMemberships(businessId!, {
        status: (status as MembershipStatus) || undefined,
        membershipTypeId: typeId || undefined,
        minVisitsLeft: minVisitsLeft ? Number(minVisitsLeft) : undefined,
        expiresBefore,
      }),
    { enabled: ready && Boolean(businessId) },
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('memberships.filters.allStatuses') },
      ...MEMBERSHIP_STATUSES.map((s) => ({
        value: s,
        label: t(`memberships.status.${s}`),
      })),
    ],
    [t],
  );
  const typeOptions = useMemo(
    () => [{ value: '', label: t('memberships.filters.allTypes') }, ...(typesQ.data ?? []).map((tp) => ({ value: tp.id, label: tp.name }))],
    [typesQ.data, t],
  );

  const columns: TableColumn<NonNullable<typeof q.data>[number]>[] = [
    { id: 'typeName', header: t('memberships.columns.type'), cell: (r) => <span className="block max-w-[14rem] truncate">{r.typeName}</span>, mobile: 'title', width: '16rem', skeletonWidth: '16ch' },
    {
      // F-06-123/F-06-124: код продажи — как у сертификата, иначе не видно, чем оплатить/подарить
      id: 'code',
      header: t('memberships.columns.code'),
      cell: (r) => r.code || '—',
      mobile: 'meta',
      width: '8rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'status',
      header: t('memberships.columns.status'),
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`memberships.status.${r.status}`)}</Badge>,
      mobile: 'badge',
      width: '10rem',
      skeleton: <BadgeSkeleton width="8ch" />,
    },
    {
      id: 'balanceVisits',
      header: t('memberships.columns.visitsLeft'),
      cell: (r) => `${r.balanceVisits} / ${r.totalVisits}`,
      align: 'right',
      sortable: true,
      sortValue: (r) => r.balanceVisits,
      mobile: 'aside',
      width: '9rem',
      skeletonWidth: '5ch',
    },
    {
      id: 'expiresAt',
      header: t('memberships.columns.expiresAt'),
      cell: (r) => format.date(r.expiresAt),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.expiresAt,
      mobile: 'meta',
      width: '10rem',
      skeletonWidth: '10ch',
    },
    {
      id: 'clientPhone',
      header: t('memberships.columns.client'),
      cell: (r) => (
        <a
          href={`/biz/clients/${r.clientId}`}
          className="inline-flex min-h-10 max-w-full items-center md:max-w-[20rem] text-primary-text underline decoration-border-strong underline-offset-2"
        >
          <span className="truncate">{r.clientName ? `${r.clientName} · ${format.phone(r.clientPhone)}` : format.phone(r.clientPhone)}</span>
        </a>
      ),
      mobile: 'subtitle',
      width: '22rem',
      // Ссылка на клиента высотой 40 px — скелетон той же высоты
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="24ch" />
        </span>
      ),
    },
  ];

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const rows = q.data ?? [];
  const totalSum = rows.reduce((sum, r) => sum + r.price, 0);
  const availableVisits = rows.reduce((sum, r) => sum + r.balanceVisits, 0);
  const exportExcel = () => {
    const csv = toCsv(
      rows.map((r) => [
        r.typeName,
        r.code || '',
        t(`memberships.status.${r.status}`),
        String(r.balanceVisits),
        format.date(r.expiresAt),
        r.clientName ? `${r.clientName} · ${format.phone(r.clientPhone)}` : format.phone(r.clientPhone),
      ]),
      [
        t('memberships.columns.type'),
        t('memberships.columns.code'),
        t('memberships.columns.status'),
        t('memberships.columns.visitsLeft'),
        t('memberships.columns.expiresAt'),
        t('memberships.columns.client'),
      ],
    );
    downloadCsv('memberships.csv', csv);
    toast.success(t('memberships.exported'));
  };
  // F-06-130: импорт абонементов из Excel — телефон клиента, название типа, код (пусто — без кода)
  // F-06-130: проверка строки БЕЗ записи — читает клиента/тип, но ничего не меняет
  const checkMembershipsRow = async (cells: string[]) => {
    const [rawPhone, typeName] = cells;
    if (!rawPhone?.trim()) throw new Error(t('memberships.import.rowNoPhone'));
    const client = await findClientByPhone(businessId!, rawPhone.trim());
    if (!client) throw new Error(t('memberships.import.clientNotFound'));
    const type = (typesQ.data ?? []).find((ty) => ty.name.trim().toLowerCase() === (typeName ?? '').trim().toLowerCase());
    if (!type) throw new Error(t('memberships.import.typeNotFound'));
    return { client, type };
  };
  const importMemberships = async (cells: string[]): Promise<string> => {
    const [, , code] = cells;
    const { client, type } = await checkMembershipsRow(cells);
    await sellMembership(businessId!, {
      membershipTypeId: type.id,
      clientId: client.id,
      code: code?.trim() || undefined,
      locationId: activeLocationIds[0] ?? businessId!,
    });
    return t('memberships.import.rowOk', { name: client.name });
  };
  const hasFilters = Boolean(status) || Boolean(typeId) || Boolean(minVisitsLeft) || Boolean(expiringWithin);
  const reset = () => {
    setStatus('');
    setTypeId('');
    setMinVisitsLeft('');
    setExpiringWithin('');
  };
  const expiringOptions = [
    { value: '', label: t('memberships.filters.expiringOptionAny') },
    { value: '7', label: t('memberships.filters.expiringOptionSoon') },
    { value: '30', label: t('memberships.filters.expiringOptionMonth') },
  ];

  const hasTypes = (typesQ.data?.length ?? 0) > 0;

  return (
    <div data-f="F-06-129 F-06-194 F-06-122 F-06-197 F-06-130 F-06-133 F-00-197 F-08-078 F-04-220" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('memberships.title')}
        description={t('memberships.subtitle')}
        actions={
          <>
            <Button variant="outline" leftIcon={<Upload aria-hidden />} onClick={() => setImportOpen(true)}>
              {t('memberships.import.button')}
            </Button>
            <Button variant="outline" leftIcon={<Download aria-hidden />} onClick={exportExcel}>
              {t('memberships.export')}
            </Button>
            <Button onClick={() => setSellOpen(true)}>{t('sell.membershipButton')}</Button>
          </>
        }
      />

      {!hasTypes && !typesQ.isLoading && (
        <EmptyState
          icon={<Gift aria-hidden />}
          title={t('sell.noMembershipTypesTitle')}
          description={t('sell.noMembershipTypesText')}
          action={<Button onClick={() => router.push('/biz/loyalty/memberships/types/new')}>{t('sell.createMembershipType')}</Button>}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('memberships.stats.sold')} value={format.number(rows.length)} loading={q.isLoading} />
        <StatCard label={t('memberships.stats.sum')} value={format.money(totalSum)} loading={q.isLoading} />
        <StatCard label={t('memberships.stats.available')} value={format.number(availableVisits)} loading={q.isLoading} />
      </div>

      <FilterBar
        filters={[
          { id: 'status', label: t('memberships.filters.status'), node: <Select options={statusOptions} value={status} onValueChange={setStatus} /> },
          { id: 'type', label: t('memberships.filters.type'), node: <Select options={typeOptions} value={typeId} onValueChange={setTypeId} /> },
          {
            id: 'minVisits',
            label: t('memberships.filters.minVisitsLeft'),
            node: <Input inputMode="numeric" value={minVisitsLeft} onChange={(e) => setMinVisitsLeft(e.target.value.replace(/\D/g, ''))} />,
          },
          {
            id: 'expiring',
            label: t('memberships.filters.expiring'),
            node: <Select options={expiringOptions} value={expiringWithin} onValueChange={setExpiringWithin} />,
          },
        ]}
        activeCount={hasFilters ? 1 : 0}
        onReset={reset}
      />

      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        loadingRows={5}
        rowHref={(r) => `/biz/loyalty/memberships/${r.id}`}
        label={t('memberships.title')}
        empty={
          <EmptyState
            icon={<Gift aria-hidden />}
            kind={hasFilters ? 'search' : 'default'}
            title={hasFilters ? undefined : t('memberships.emptyTitle')}
            onReset={hasFilters ? reset : undefined}
          />
        }
      />

      <SellMembershipDialog
        open={sellOpen}
        onOpenChange={setSellOpen}
        businessId={businessId!}
        locationId={saleLocationId}
        onSold={() => {
          q.refetch();
          typesQ.refetch();
        }}
      />

      <BulkImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        title={t('memberships.import.title')}
        hint={t('memberships.import.hint')}
        templateHeader={t('memberships.import.template')}
        columns={[
          { key: 'phone', label: t('memberships.import.colPhone') },
          { key: 'type', label: t('memberships.import.colType') },
          { key: 'code', label: t('memberships.import.colCode') },
        ]}
        onImportRow={importMemberships}
        onValidateRow={checkMembershipsRow}
        onDone={() => q.refetch()}
      />
    </div>
  );
}
