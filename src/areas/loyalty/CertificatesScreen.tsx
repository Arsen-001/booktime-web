'use client';

/**
 * /biz/loyalty/certificates — сертификаты сети (F-06-100): все проданные сертификаты с остатками,
 * фильтры по статусу/коду/телефону (F-06-195), выгрузка в Excel, ссылки на страницу сертификата.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, Search, Ticket, Upload } from 'lucide-react';
import { findClientByPhone } from '@/api/core';
import { listCertificates, listCertificateTypes, sellCertificate } from '@/api/loyalty';
import { downloadCsv, toCsv } from '@/lib/csv';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { listStaffBrief } from '@/api/client';
import { BulkImportModal } from '@/areas/loyalty/components/BulkImportModal';
import { BadgeSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { CertificateStatus } from '@/domain/loyalty';
import { dayjs, today } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { SalePaymentField } from '@/areas/loyalty/components/SalePaymentField';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

/** F-06-095/F-06-197: продажа сертификата — выбор типа, клиент по телефону, код (или без — у именного типа), цена/скидка/продавец */
function SellCertificateDialog({ open, onOpenChange, businessId, locationId, onSold }: { open: boolean; onOpenChange: (open: boolean) => void; businessId: Id; locationId: Id; onSold: () => void }) {
  const t = useT('loyalty');
  const toast = useToast();
  const typesQ = useApiQuery(['loyalty', 'certificateTypes', businessId], () => listCertificateTypes(businessId), { enabled: open });
  const staffQ = useApiQuery(['staff', 'brief', businessId], () => listStaffBrief(businessId), { enabled: open });

  const [typeId, setTypeId] = useState('');
  const [phone, setPhone] = useState('');
  const [clientId, setClientId] = useState<Id | undefined>(undefined);
  const [clientName, setClientName] = useState('');
  const [searching, setSearching] = useState(false);
  const [code, setCode] = useState('');
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [discountPercent, setDiscountPercent] = useState<number | undefined>(undefined);
  const [sellerId, setSellerId] = useState('');
  const [methodKey, setMethodKey] = useState('');

  const type = typesQ.data?.find((ct) => ct.id === typeId);

  const reset = () => {
    setTypeId('');
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
    sellCertificate(businessId, {
      certTypeId: typeId,
      clientId,
      code: code.trim() || undefined,
      locationId,
      sellerId: sellerId || undefined,
      price,
      discountPercent,
      payment: methodKey ? { methodKey } : undefined,
    }),
  );

  const canSell = Boolean(type) && (Boolean(code.trim()) || (type?.allowNoCode && Boolean(clientId))) && Boolean(methodKey);

  const submit = async () => {
    try {
      await sellMutation.mutate(undefined);
      toast.success(t('sell.certificateSold'));
      reset();
      onOpenChange(false);
      onSold();
    } catch (err) {
      if (err instanceof ApiError && ['payment_setup_incomplete', 'method_not_found', 'invalid_amount', 'forbidden'].includes(err.code)) toast.error(t('sell.paymentFailed'));
      else toast.error(t('sell.needCodeOrNamed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={t('sell.certificateTitle')}
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
      {typesQ.data?.length === 0 ? (
        <EmptyState compact icon={<Ticket aria-hidden />} title={t('sell.noCertTypesTitle')} description={t('sell.noCertTypesText')} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormField label={t('sell.typeLabel')}>
            <Select
              options={(typesQ.data ?? []).map((ct) => ({
                value: ct.id,
                label: `${ct.name} · ${ct.nominal} ֏`,
              }))}
              value={typeId}
              onValueChange={setTypeId}
              placeholder={t('sell.typePlaceholder')}
            />
          </FormField>
          <FormField label={t('sell.clientLabel')} hint={type?.allowNoCode ? t('sell.clientRequiredForNamed') : undefined}>
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
              <Button variant="outline" leftIcon={<RefreshCw aria-hidden />} onClick={() => setCode(`CERT-${Math.floor(100000 + Math.random() * 900000)}`)}>
                {t('sell.generate')}
              </Button>
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('sell.priceLabel')}>
              <MoneyInput value={price} onValueChange={setPrice} />
            </FormField>
            <FormField label={t('sell.discountLabel')}>
              <Input type="number" min={0} max={100} value={discountPercent ?? ''} onChange={(e) => setDiscountPercent(Number(e.target.value) || undefined)} />
            </FormField>
          </div>
          <FormField label={t('sell.sellerLabel')}>
            <Select
              options={(staffQ.data ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
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

const STATUS_TONE: Record<CertificateStatus, BadgeTone> = {
  active: 'success',
  used: 'neutral',
  expired: 'danger',
};

export function CertificatesScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId, activeLocationIds } = useCurrent();

  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const q = useApiQuery(
    ['loyalty', 'certificates', businessId, status, code, phone],
    () =>
      listCertificates(businessId!, {
        status: (status as CertificateStatus) || undefined,
        code: code || undefined,
        phone: phone || undefined,
      }),
    { enabled: ready && Boolean(businessId) },
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('certificates.filters.allStatuses') },
      { value: 'active', label: t('certificates.status.active') },
      { value: 'used', label: t('certificates.status.used') },
      { value: 'expired', label: t('certificates.status.expired') },
    ],
    [t],
  );

  const columns: TableColumn<NonNullable<typeof q.data>[number]>[] = [
    {
      id: 'code',
      header: t('certificates.columns.code'),
      cell: (r) => r.code,
      mobile: 'title',
      width: '8rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'typeName',
      header: t('certificates.columns.type'),
      cell: (r) => <span className="block max-w-[14rem] truncate">{r.typeName}</span>,
      mobile: 'meta',
      width: '16rem',
      skeletonWidth: '22ch',
    },
    {
      id: 'status',
      header: t('certificates.columns.status'),
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`certificates.status.${r.status}`)}</Badge>,
      mobile: 'badge',
      width: '10rem',
      skeleton: <BadgeSkeleton width="8ch" />,
    },
    {
      id: 'balance',
      header: t('certificates.columns.balance'),
      cell: (r) => `${format.money(r.balance)} / ${format.money(r.nominal)}`,
      align: 'right',
      mobile: 'aside',
      width: '13rem',
      skeletonWidth: '16ch',
      className: 'whitespace-nowrap',
    },
    {
      id: 'clientPhone',
      header: t('certificates.columns.client'),
      cell: (r) =>
        r.clientId ? (
          <Link href={`/biz/clients/${r.clientId}`} className="inline-flex min-h-10 max-w-[16rem] items-center text-primary-text underline decoration-border-strong underline-offset-2">
            <span className="truncate">{r.clientName ? `${r.clientName} · ${format.phone(r.clientPhone)}` : format.phone(r.clientPhone)}</span>
          </Link>
        ) : (
          '—'
        ),
      mobile: 'subtitle',
      width: '18rem',
      // Ссылка на клиента высотой 40 px — скелетон той же высоты
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="20ch" />
        </span>
      ),

    },
    {
      id: 'expiresAt',
      header: t('certificates.columns.expiresAt'),
      cell: (r) => {
        if (!r.expiresAt || r.status !== 'active') return '—';
        const days = dayjs(r.expiresAt).diff(dayjs(today()), 'day');
        return (
          <span className={days <= 14 ? 'font-medium text-warning' : undefined}>
            {format.date(r.expiresAt)}
            {days >= 0 ? ` · ${t('certificates.daysLeft', { n: days })}` : ''}
          </span>
        );
      },
      align: 'right',
      sortable: true,
      sortValue: (r) => r.expiresAt ?? '',
      mobile: 'meta',
      // «12.09.2027 · осталось 347 дн.» в одну строку — колонка шире текста, скелетон той же ширины
      width: '18rem',
      skeletonWidth: '24ch',
      className: 'whitespace-nowrap',
    },
    {
      id: 'soldAt',
      header: t('certificates.columns.soldAt'),
      cell: (r) => format.date(r.soldAt),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.soldAt,
      mobile: 'hidden',
      width: '10rem',
      skeletonWidth: '8ch',
    },
    {
      id: 'locationName',
      header: t('certificates.columns.soldLocation'),
      cell: (r) => <span className="block max-w-[10rem] truncate">{r.locationName}</span>,
      mobile: 'hidden',
      width: '12rem',
      skeletonWidth: '12ch',
    },
    {
      id: 'usedLocationNames',
      header: t('certificates.columns.usedLocation'),
      cell: (r) => (
        <span className="block max-w-[14rem] truncate">
          {r.usedLocationNames.length === 0
            ? '—'
            : r.usedLocationNames.length === 1
              ? r.usedLocationNames[0]
              : t('certificates.usedLocationsMore', { name: r.usedLocationNames[0], n: r.usedLocationNames.length - 1 })}
        </span>
      ),
      mobile: 'hidden',
      width: '16rem',
      skeletonWidth: '10ch',
    },
  ];

  const typesQ = useApiQuery(['loyalty', 'certificateTypes', businessId], () => listCertificateTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const [sellOpen, setSellOpen] = useState(false);
  const saleLocationId = (activeLocationIds[0] ?? businessId) as Id;

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const exportExcel = () => {
    const rows = q.data ?? [];
    const csv = toCsv(
      rows.map((r) => [
        r.code,
        r.typeName,
        t(`certificates.status.${r.status}`),
        `${format.money(r.balance)} / ${format.money(r.nominal)}`,
        r.clientId ? format.phone(r.clientPhone) : '',
        format.date(r.soldAt),
        r.locationName,
        r.usedLocationNames.join(', '),
      ]),
      [
        t('certificates.columns.code'),
        t('certificates.columns.type'),
        t('certificates.columns.status'),
        t('certificates.columns.balance'),
        t('certificates.columns.client'),
        t('certificates.columns.soldAt'),
        t('certificates.columns.soldLocation'),
        t('certificates.columns.usedLocation'),
      ],
    );
    downloadCsv('certificates.csv', csv);
    toast.success(t('certificates.exported'));
  };
  // F-06-191: загрузка сертификатов и номеров из таблицы — код, название типа, телефон клиента (пусто для типов без кода — тогда клиент обязателен)
  // F-06-130: проверка строки БЕЗ записи — читает тип/клиента, но ничего не меняет
  const checkCertificatesRow = async (cells: string[]) => {
    const [rawCode, typeName, rawPhone] = cells;
    const type = (typesQ.data ?? []).find((ty) => ty.name.trim().toLowerCase() === (typeName ?? '').trim().toLowerCase());
    if (!type) throw new Error(t('certificates.import.typeNotFound'));
    let clientId: Id | undefined;
    if (rawPhone?.trim()) {
      const client = await findClientByPhone(businessId!, rawPhone.trim());
      if (!client) throw new Error(t('certificates.import.clientNotFound'));
      clientId = client.id;
    }
    if (!rawCode?.trim() && !clientId) throw new Error(t('certificates.import.needCodeOrClient'));
    return { type, clientId };
  };
  const importCertificates = async (cells: string[]): Promise<string> => {
    const [rawCode] = cells;
    const { type, clientId } = await checkCertificatesRow(cells);
    await sellCertificate(businessId!, {
      certTypeId: type.id,
      code: rawCode?.trim() || undefined,
      clientId,
      locationId: activeLocationIds[0] ?? businessId!,
    });
    return t('certificates.import.rowOk', { code: rawCode?.trim() || '—' });
  };
  const hasFilters = Boolean(status) || Boolean(code) || Boolean(phone);
  const reset = () => {
    setStatus('');
    setCode('');
    setPhone('');
  };
  const hasTypes = (typesQ.data?.length ?? 0) > 0;

  return (
    <div data-f="F-06-100 F-06-195 F-06-095 F-06-197 F-06-191 F-00-196" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('certificates.title')}
        description={t('certificates.subtitle')}
        actions={
          <>
            <Button variant="outline" leftIcon={<Upload aria-hidden />} onClick={() => setImportOpen(true)}>
              {t('certificates.import.button')}
            </Button>
            <Button variant="outline" leftIcon={<Download aria-hidden />} onClick={exportExcel}>
              {t('certificates.export')}
            </Button>
            <Button onClick={() => setSellOpen(true)}>{t('sell.certificateButton')}</Button>
          </>
        }
      />

      {!hasTypes && !typesQ.isLoading && <EmptyState icon={<Ticket aria-hidden />} title={t('sell.noCertTypesTitle')} description={t('sell.noCertTypesText')} action={<Button onClick={() => router.push('/biz/loyalty/certificates/types/new')}>{t('sell.createType')}</Button>} />}

      <FilterBar
        search={{
          value: code,
          onValueChange: setCode,
          placeholder: t('certificates.filters.codePlaceholder'),
        }}
        filters={[
          {
            id: 'status',
            label: t('certificates.filters.status'),
            node: <Select options={statusOptions} value={status} onValueChange={setStatus} />,
          },
          {
            id: 'phone',
            label: t('certificates.filters.phone'),
            node: <Input placeholder={t('certificates.filters.phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} />,
          },
        ]}
        activeCount={hasFilters ? 1 : 0}
        onReset={reset}
      />

      <Table columns={columns} rows={q.data ?? []} rowKey={(r) => r.id} loading={q.isLoading} loadingRows={6} rowHref={(r) => `/biz/loyalty/certificates/${r.id}`} label={t('certificates.title')} empty={<EmptyState icon={<Ticket aria-hidden />} kind={hasFilters ? 'search' : 'default'} title={hasFilters ? undefined : t('certificates.emptyTitle')} onReset={hasFilters ? reset : undefined} />} />

      <SellCertificateDialog
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
        title={t('certificates.import.title')}
        hint={t('certificates.import.hint')}
        templateHeader={t('certificates.import.template')}
        columns={[
          { key: 'code', label: t('certificates.import.colCode') },
          { key: 'type', label: t('certificates.import.colType') },
          { key: 'phone', label: t('certificates.import.colPhone') },
        ]}
        onImportRow={importCertificates}
        onValidateRow={checkCertificatesRow}
        onDone={() => q.refetch()}
      />
    </div>
  );
}
