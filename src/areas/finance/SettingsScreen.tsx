'use client';

/**
 * /biz/finance/settings — «Настройки финансов»: нефискальный чек (F-07-147/158), онлайн-кассы (F-07-151,
 * 🔒 недоступно — как у Altegio для не подключённых стран), права раздела «Финансы» по сотруднику
 * (F-07-166…168, ⭐ демо-набор — полный редактор ролей появится в staff, см. qa/requests/finance.md).
 */
import { useState } from 'react';
import Link from 'next/link';
import { Bell, Building2, FileCheck2, Landmark, Receipt, ShieldCheck } from 'lucide-react';
import {
  getFinanceRights,
  getPaymentNotificationsSettings,
  getReceiptSettings,
  listFinanceRightsByStaff,
  savePaymentNotificationsSettings,
  saveFinanceRights,
  saveReceiptSettings,
} from '@/api/finance';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { FinanceDepth, OrgLegalType, OrgRequisiteValues, ReceiptFormat, ReceiptSettings } from '@/domain/finance';
import { DEFAULT_ORG_REQUISITES, DEFAULT_PAYMENT_NOTIFICATIONS, DEFAULT_RECEIPT_REQUISITES, isArmenianRequisite } from '@/domain/finance';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/**
 * Форма чека на время загрузки — те же поля с умолчаниями (как у нового бизнеса), выключенная: скелетон формы — сама
 * форма, данные просто встают в поля, ничего не сдвигается.
 */
const LOADING_RECEIPT: ReceiptSettings = {
  businessId: '',
  format: 'thermal58',
  clientName: true,
  clientPhone: true,
  clientEmail: false,
  requisites: { ...DEFAULT_RECEIPT_REQUISITES },
  orgType: 'legal',
  orgRequisites: { ...DEFAULT_ORG_REQUISITES },
  taxPerLine: false,
  extraInfoEnabled: false,
  extraInfoText: '',
  showComment: true,
  vatIncludedEnabled: false,
  vatIncludedPct: 20,
  updatedAt: '',
};

const DEPTH_OPTIONS: FinanceDepth[] = ['unlimited', 'today', 'd15', 'm1', 'm2', 'm3', 'm6', 'none'];

export function SettingsScreen() {
  const t = useT('finance');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');

  const receiptQ = useApiQuery(['finance', 'receiptSettings', businessId], () => getReceiptSettings(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const [localDraft, setLocalDraft] = useState<ReceiptSettings | null>(null);
  const draft = localDraft ?? receiptQ.data ?? null;
  const receiptLoading = receiptQ.isLoading || !draft;
  const shown = draft ?? LOADING_RECEIPT;
  const setDraft = (updater: (d: ReceiptSettings | null) => ReceiptSettings | null) => setLocalDraft(updater(draft));
  const saveReceiptM = useApiMutation((patch: ReceiptSettings) => saveReceiptSettings(businessId!, patch));

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const rightsMapQ = useApiQuery(['finance', 'rightsMap', businessId], () => listFinanceRightsByStaff(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const [rightsStaffId, setRightsStaffId] = useState<string | undefined>(undefined);
  const rightsQ = useApiQuery(['finance', 'rights', businessId, rightsStaffId], () => getFinanceRights(businessId!, rightsStaffId!), {
    enabled: ready && Boolean(businessId) && Boolean(rightsStaffId),
  });
  const saveRightsM = useApiMutation((args: { staffId: string; patch: Partial<NonNullable<typeof rightsQ.data>> }) =>
    saveFinanceRights(businessId!, args.staffId, args.patch),
  );

  const handleSaveReceipt = async () => {
    if (!draft) return;
    try {
      const saved = await saveReceiptM.mutate(draft);
      setDraft(() => saved);
      toast.success(t('settingsPage.receiptSaved'));
    } catch {
      toast.error(t('settingsPage.saveFailed'));
    }
  };

  const patchRight = async (key: keyof NonNullable<typeof rightsQ.data>, value: unknown) => {
    if (!rightsStaffId) return;
    try {
      await saveRightsM.mutate({ staffId: rightsStaffId, patch: { [key]: value } });
      rightsQ.refetch();
      rightsMapQ.refetch();
    } catch {
      toast.error(t('settingsPage.saveFailed'));
    }
  };

  if (receiptQ.isError) return <ErrorState onRetry={receiptQ.refetch} />;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('nav.settings')} description={t('settingsPage.subtitle')} />

      {/* F-07-147/158 — настройки нефискального чека и НДС ОАЭ */}
      <div data-f="F-07-147 F-07-158 F-13-208">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Receipt aria-hidden className="size-4 text-muted" />
              {t('settingsPage.receiptTitle')}
            </span>
          }
          description={t('settingsPage.receiptDescription')}
        >
          <fieldset disabled={receiptLoading} aria-busy={receiptLoading || undefined} className="contents">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('settingsPage.format')}</span>
                <ChoiceGroup
                  options={[
                    { value: 'a4', title: t('settingsPage.formatA4') },
                    { value: 'thermal80', title: t('settingsPage.format80') },
                    { value: 'thermal58', title: t('settingsPage.format58') },
                  ]}
                  value={shown.format}
                  onValueChange={(v) => setDraft((d) => (d ? { ...d, format: v as ReceiptFormat } : d))}
                />
              </div>

              <div data-f="F-04-229" className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('settingsPage.clientInfo')}</span>
                <Checkbox
                  checked={shown.clientName}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, clientName: v } : d))}
                  label={t('settingsPage.clientName')}
                />
                <Checkbox
                  checked={shown.clientPhone}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, clientPhone: v } : d))}
                  label={t('settingsPage.clientPhone')}
                />
                <Checkbox
                  checked={shown.clientEmail}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, clientEmail: v } : d))}
                  label={t('settingsPage.clientEmail')}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('settingsPage.requisites')}</span>
                {(Object.keys(shown.requisites) as (keyof ReceiptSettings['requisites'])[]).filter(isArmenianRequisite).map((key) => (
                  <Checkbox
                    key={key}
                    checked={shown.requisites[key]}
                    onCheckedChange={(v) => setDraft((d) => (d ? { ...d, requisites: { ...d.requisites, [key]: v } } : d))}
                    label={t(`settingsPage.requisite.${key}`)}
                  />
                ))}
              </div>

              <Checkbox
                checked={shown.taxPerLine}
                onCheckedChange={(v) => setDraft((d) => (d ? { ...d, taxPerLine: v } : d))}
                label={t('settingsPage.taxPerLine')}
              />
              <Checkbox
                checked={shown.showComment}
                onCheckedChange={(v) => setDraft((d) => (d ? { ...d, showComment: v } : d))}
                label={t('settingsPage.showComment')}
              />

              <div className="flex flex-col gap-2">
                <Switch
                  checked={shown.extraInfoEnabled}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, extraInfoEnabled: v } : d))}
                  label={t('settingsPage.extraInfo')}
                />
                {shown.extraInfoEnabled && (
                  <Textarea
                    value={shown.extraInfoText}
                    onChange={(e) => setDraft((d) => (d ? { ...d, extraInfoText: e.target.value } : d))}
                    rows={2}
                    placeholder={t('settingsPage.extraInfoPlaceholder')}
                  />
                )}
              </div>

              <div data-f="F-07-158" className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <Switch
                  checked={shown.vatIncludedEnabled}
                  onCheckedChange={(v) => setDraft((d) => (d ? { ...d, vatIncludedEnabled: v } : d))}
                  label={t('settingsPage.vatIncluded')}
                  description={t('settingsPage.vatIncludedHint')}
                />
                {shown.vatIncludedEnabled && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('settingsPage.vatPct')}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      value={shown.vatIncludedPct}
                      onChange={(e) => setDraft((d) => (d ? { ...d, vatIncludedPct: Number(e.target.value) || 0 } : d))}
                    />
                  </label>
                )}
              </div>

              {canEdit && (
                <Button className="self-end" loading={saveReceiptM.isPending} onClick={handleSaveReceipt}>
                  {t('settingsPage.save')}
                </Button>
              )}
            </div>
          </fieldset>
        </SectionCard>
      </div>

      {/* F-07-150 — реквизиты организации: значения попадают в нефискальный чек по флагам «requisites» выше */}
      <div data-f="F-07-150">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Building2 aria-hidden className="size-4 text-muted" />
              {t('settingsPage.orgRequisitesTitle')}
            </span>
          }
          description={t('settingsPage.orgRequisitesDescription')}
        >
          <fieldset disabled={receiptLoading} aria-busy={receiptLoading || undefined} className="contents">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('settingsPage.orgType')}</span>
                <Select
                  value={shown.orgType}
                  onValueChange={(v) => setDraft((d) => (d ? { ...d, orgType: v as OrgLegalType } : d))}
                  disabled={!canEdit}
                  options={[
                    { value: 'legal', label: t('settingsPage.orgTypeLegal') },
                    { value: 'individual', label: t('settingsPage.orgTypeIndividual') },
                  ]}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(Object.keys(shown.orgRequisites) as (keyof OrgRequisiteValues)[]).filter(isArmenianRequisite).map((key) => (
                  <label key={key} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t(`settingsPage.requisite.${key}`)}</span>
                    <Input
                      value={shown.orgRequisites[key]}
                      onChange={(e) => setDraft((d) => (d ? { ...d, orgRequisites: { ...d.orgRequisites, [key]: e.target.value } } : d))}
                      disabled={!canEdit}
                    />
                  </label>
                ))}
              </div>
              {canEdit && (
                <Button className="self-end" loading={saveReceiptM.isPending} onClick={handleSaveReceipt}>
                  {t('settingsPage.save')}
                </Button>
              )}
            </div>
          </fieldset>
        </SectionCard>
      </div>

      {/* F-07-151 — онлайн-кассы (ККМ), не подключены */}
      <div data-f="F-07-151 F-08-141">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Landmark aria-hidden className="size-4 text-muted" />
              {t('settingsPage.kkmTitle')}
            </span>
          }
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{t('settingsPage.kkmHint')}</p>
            <Badge tone="neutral">{t('settingsPage.kkmSoon')}</Badge>
          </div>
        </SectionCard>
      </div>

      {/* F-07-084 (тип 85) / F-07-085 (тип 65) / F-07-086 — уведомления, завязанные на деньги; полный редактор
          шаблонов уведомлений — раздел «notify» (не наш путь), здесь только вкл/выкл и текст-предпросмотр */}
      <PaymentNotificationsCard businessId={businessId} ready={ready} canEdit={canEdit} />

      {/* F-07-152/154/157 — фискализация стран-образцов (Украина/Венгрия/Бразилия) — на отдельной странице */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <FileCheck2 aria-hidden className="size-4 text-muted" />
            {t('settingsPage.fiscalTitle')}
          </span>
        }
        description={t('settingsPage.fiscalDescription')}
      >
        <Link
          href="/biz/finance/fiscal"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary-text underline decoration-border-strong underline-offset-2"
        >
          {t('settingsPage.fiscalOpen')}
        </Link>
      </SectionCard>

      {/* F-07-166…168 — права раздела «Финансы» по сотруднику (⭐ демо-набор) */}
      <div data-f="F-07-166 F-07-167 F-07-168">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 text-muted" />
              {t('settingsPage.rightsTitle')}
            </span>
          }
          description={t('settingsPage.rightsDescription')}
        >
          <div className="flex flex-col gap-4">
            <Select
              value={rightsStaffId}
              onValueChange={setRightsStaffId}
              placeholder={t('settingsPage.rightsPickStaff')}
              options={(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              searchable
            />
            {!rightsStaffId ? (
              <p className="text-sm text-muted">{t('settingsPage.rightsPickStaffHint')}</p>
            ) : rightsQ.isLoading || !rightsQ.data ? (
              <Skeleton lines={5} />
            ) : (
              <div className="flex flex-col gap-3">
                <Switch
                  checked={rightsQ.data.allAccounts}
                  onCheckedChange={(v) => patchRight('allAccounts', v)}
                  label={t('settingsPage.right.allAccounts')}
                  disabled={!canEdit}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('settingsPage.right.viewDepth')}</span>
                    <Select
                      value={rightsQ.data.viewDepth}
                      onValueChange={(v) => patchRight('viewDepth', v as FinanceDepth)}
                      options={DEPTH_OPTIONS.map((d) => ({ value: d, label: t(`settingsPage.depth.${d}`) }))}
                      disabled={!canEdit}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t('settingsPage.right.createDepth')}</span>
                    <Select
                      value={rightsQ.data.createDepth}
                      onValueChange={(v) => patchRight('createDepth', v as FinanceDepth)}
                      options={DEPTH_OPTIONS.map((d) => ({ value: d, label: t(`settingsPage.depth.${d}`) }))}
                      disabled={!canEdit}
                    />
                  </label>
                </div>
                <Switch
                  checked={rightsQ.data.canEdit}
                  onCheckedChange={(v) => patchRight('canEdit', v)}
                  label={t('settingsPage.right.canEdit')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canDelete}
                  onCheckedChange={(v) => patchRight('canDelete', v)}
                  label={t('settingsPage.right.canDelete')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canExport}
                  onCheckedChange={(v) => patchRight('canExport', v)}
                  label={t('settingsPage.right.canExport')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canViewBalance}
                  onCheckedChange={(v) => patchRight('canViewBalance', v)}
                  label={t('settingsPage.right.canViewBalance')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canManageCounterparties}
                  onCheckedChange={(v) => patchRight('canManageCounterparties', v)}
                  label={t('settingsPage.right.canManageCounterparties')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canManageItems}
                  onCheckedChange={(v) => patchRight('canManageItems', v)}
                  label={t('settingsPage.right.canManageItems')}
                  disabled={!canEdit}
                />
                <div className="my-1 h-px bg-border" />
                <p className="text-xs font-medium text-muted">{t('settingsPage.rightsGroupBooking')}</p>
                <Switch
                  checked={rightsQ.data.canPay}
                  onCheckedChange={(v) => patchRight('canPay', v)}
                  label={t('settingsPage.right.canPay')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canPayFromAccount}
                  onCheckedChange={(v) => patchRight('canPayFromAccount', v)}
                  label={t('settingsPage.right.canPayFromAccount')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canEditServicePrice}
                  onCheckedChange={(v) => patchRight('canEditServicePrice', v)}
                  label={t('settingsPage.right.canEditServicePrice')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canDeletePaidBooking}
                  onCheckedChange={(v) => patchRight('canDeletePaidBooking', v)}
                  label={t('settingsPage.right.canDeletePaidBooking')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canSeeJournalStats}
                  onCheckedChange={(v) => patchRight('canSeeJournalStats', v)}
                  label={t('settingsPage.right.canSeeJournalStats')}
                  disabled={!canEdit}
                />
                <div className="my-1 h-px bg-border" />
                <p className="text-xs font-medium text-muted">{t('settingsPage.rightsGroupClient')}</p>
                <Switch
                  checked={rightsQ.data.canViewClientAccountHistory}
                  onCheckedChange={(v) => patchRight('canViewClientAccountHistory', v)}
                  label={t('settingsPage.right.canViewClientAccountHistory')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canApplyLoyaltyNoCode}
                  onCheckedChange={(v) => patchRight('canApplyLoyaltyNoCode', v)}
                  label={t('settingsPage.right.canApplyLoyaltyNoCode')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canWaivePolicyPenalty}
                  onCheckedChange={(v) => patchRight('canWaivePolicyPenalty', v)}
                  label={t('settingsPage.right.canWaivePolicyPenalty')}
                  disabled={!canEdit}
                />
                <div className="my-1 h-px bg-border" />
                <Switch
                  checked={rightsQ.data.payrollOwnStaffOnly}
                  onCheckedChange={(v) => patchRight('payrollOwnStaffOnly', v)}
                  label={t('settingsPage.right.payrollOwnStaffOnly')}
                  disabled={!canEdit}
                />
                <Switch
                  checked={rightsQ.data.canAccruePayroll}
                  onCheckedChange={(v) => patchRight('canAccruePayroll', v)}
                  label={t('settingsPage.right.canAccruePayroll')}
                  disabled={!canEdit}
                />
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/** F-07-084/085/086 — три уведомления, завязанных на деньги (ссылка на оплату, успешная онлайн-оплата,
 *  оплата по QR сотруднику). Полный редактор шаблонов принадлежит разделу «notify» — здесь только
 *  вкл/выкл каждого типа и текст-предпросмотр с подставленными переменными (F-07-084 «Готово, когда»). */
function PaymentNotificationsCard({ businessId, ready, canEdit }: { businessId?: string; ready: boolean; canEdit: boolean }) {
  const t = useT('finance');
  const toast = useToast();
  const settingsQ = useApiQuery(['finance', 'paymentNotifications', businessId], () => getPaymentNotificationsSettings(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const saveM = useApiMutation((patch: Parameters<typeof savePaymentNotificationsSettings>[1]) =>
    savePaymentNotificationsSettings(businessId!, patch),
  );

  const loading = settingsQ.isLoading || !settingsQ.data;
  const toggle = async (key: 'linkToPayEnabled' | 'successPaidEnabled' | 'staffQrPaidEnabled', value: boolean) => {
    try {
      await saveM.mutate({ [key]: value });
      settingsQ.refetch();
    } catch {
      toast.error(t('settingsPage.saveFailed'));
    }
  };

  return (
    <div data-f="F-07-084 F-07-085 F-07-086">
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Bell aria-hidden className="size-4 text-muted" />
            {t('settingsPage.paymentNotify.title')}
          </span>
        }
        description={t('settingsPage.paymentNotify.subtitle')}
      >
        {/* Загрузка — те же три переключателя (выключенные) с теми же подписями: данные только ставят галочки */}
        <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 border-b border-border pb-3">
              <Switch
                checked={(settingsQ.data ?? DEFAULT_PAYMENT_NOTIFICATIONS).linkToPayEnabled}
                onCheckedChange={(v) => toggle('linkToPayEnabled', v)}
                label={t('settingsPage.paymentNotify.linkToPay')}
                disabled={!canEdit || loading}
              />
              <p className="pl-11 text-xs text-muted">{t('settingsPage.paymentNotify.linkToPayPreview', { link: 'booking.app/pay/AB12CD' })}</p>
            </div>
            <div className="flex flex-col gap-1.5 border-b border-border pb-3">
              <Switch
                checked={(settingsQ.data ?? DEFAULT_PAYMENT_NOTIFICATIONS).successPaidEnabled}
                onCheckedChange={(v) => toggle('successPaidEnabled', v)}
                label={t('settingsPage.paymentNotify.successPaid')}
                disabled={!canEdit || loading}
              />
              <p className="pl-11 text-xs text-muted">{t('settingsPage.paymentNotify.successPaidPreview')}</p>
              <p className="pl-11 text-xs text-muted">{t('settingsPage.paymentNotify.emailNotAllowed')}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Switch
                checked={(settingsQ.data ?? DEFAULT_PAYMENT_NOTIFICATIONS).staffQrPaidEnabled}
                onCheckedChange={(v) => toggle('staffQrPaidEnabled', v)}
                label={t('settingsPage.paymentNotify.staffQrPaid')}
                disabled={!canEdit || loading}
              />
              <p className="pl-11 text-xs text-muted">{t('settingsPage.paymentNotify.staffQrPaidHint')}</p>
            </div>
          </div>
        </fieldset>
      </SectionCard>
    </div>
  );
}
