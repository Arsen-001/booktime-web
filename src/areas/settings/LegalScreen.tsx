'use client';

/**
 * /biz/settings/legal — «Юридическая информация» (F-15-112): реквизиты компании; ՀՎՀՀ проверяется форматом
 * (F-15-085 — 8 цифр). Подставляются в счёт на подписку (/biz/billing/checkout) и в чек клиенту.
 */
import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { LegalEntityType, PayerTaxInfo } from '@/domain/settings';
import { isValidTaxId, saveLegalInfoFull, useLegalInfo } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { useSettingsDraft } from '@/areas/settings/useSettingsDraft';

const EMPTY_PAYER_TAX: PayerTaxInfo = { type: 'business' };

interface Draft {
  entityType: LegalEntityType;
  companyName: string;
  legalAddress: string;
  billingAddress: string;
  taxId: string;
  bankName: string;
  bankAccount: string;
  correspondentAccount: string;
  payerTax: PayerTaxInfo;
}

export function LegalScreen() {
  const t = useT('settings');
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = useLegalInfo(businessId, { enabled: ready });

  const form = useSettingsDraft<Draft>(
    q.data
      ? {
          entityType: q.data.entityType ?? 'soleProprietor',
          companyName: q.data.companyName ?? '',
          legalAddress: q.data.legalAddress ?? '',
          billingAddress: q.data.billingAddress ?? '',
          taxId: q.data.taxId ?? '',
          bankName: q.data.bankName ?? '',
          bankAccount: q.data.bankAccount ?? '',
          correspondentAccount: q.data.correspondentAccount ?? '',
          payerTax: q.data.payerTax ?? EMPTY_PAYER_TAX,
        }
      : undefined,
    ready ? businessId : undefined,
  );
  const { draft, dirty, setDraft } = form;
  const loading = !ready || q.isLoading || !draft;
  const d: Draft = draft ?? { entityType: 'soleProprietor', companyName: '', legalAddress: '', billingAddress: '', taxId: '', bankName: '', bankAccount: '', correspondentAccount: '', payerTax: EMPTY_PAYER_TAX };
  const save = useApiMutation(saveLegalInfoFull);
  const [taxIdError, setTaxIdError] = useState(false);

  async function handleSave() {
    if (!draft || !businessId) return;
    if (draft.taxId && !isValidTaxId(draft.taxId)) {
      setTaxIdError(true);
      return;
    }
    setTaxIdError(false);
    try {
      await save.mutate({ businessId, staffId, ...draft });
      form.markSaved();
      toast.success(t('legal.saved'));
    } catch {
      toast.error(t('legal.saveFailed'));
    }
  }

  return (
    <div data-f="F-15-112 F-15-085 F-15-086" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('legal.title')}
        description={t('legal.description')}
        back={{ href: '/biz/settings' }}
      />

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !loading && !canManage ? (
        <EmptyState
          icon={<FileText aria-hidden />}
          title={t('legal.accessDenied')}
        />
      ) : (
        // До ответа — та же форма с пустыми выключенными полями (DESIGN.md «The skeleton IS the page»)
        <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
          <SectionCard title={t('legal.detailsTitle')}>
            <div className="flex flex-col gap-4">
              <FormField label={t('legal.typeLabel')}>
                <SegmentedControl
                  value={d.entityType}
                  onValueChange={(v) =>
                    setDraft({ ...d, entityType: v as LegalEntityType })
                  }
                  options={[
                    { value: 'legalEntity', label: t('legal.typeLegalEntity') },
                    {
                      value: 'soleProprietor',
                      label: t('legal.typeSoleProprietor'),
                    },
                  ]}
                />
              </FormField>
              <FormField label={t('legal.companyNameLabel')}>
                <Input
                  value={d.companyName}
                  onChange={(e) =>
                    setDraft({ ...d, companyName: e.target.value })
                  }
                />
              </FormField>
              <FormField
                label={t('legal.taxIdLabel')}
                hint={t('legal.taxIdHint')}
                error={taxIdError ? t('legal.taxIdInvalid') : undefined}
              >
                <Input
                  value={d.taxId}
                  onChange={(e) => {
                    setTaxIdError(false);
                    setDraft({
                      ...d,
                      taxId: e.target.value.replace(/[^0-9]/g, ''),
                    });
                  }}
                  placeholder="00000000"
                  maxLength={8}
                />
              </FormField>
              <FormField label={t('legal.legalAddressLabel')}>
                <Input
                  value={d.legalAddress}
                  onChange={(e) =>
                    setDraft({ ...d, legalAddress: e.target.value })
                  }
                />
              </FormField>
              <FormField
                label={t('legal.billingAddressLabel')}
                hint={t('legal.billingAddressHint')}
                optional
              >
                <Input
                  value={d.billingAddress}
                  onChange={(e) =>
                    setDraft({ ...d, billingAddress: e.target.value })
                  }
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title={t('legal.bankTitle')}
            description={t('legal.bankHint')}
          >
            <div className="flex flex-col gap-4">
              <FormField label={t('legal.bankNameLabel')} optional>
                <Input
                  value={d.bankName}
                  onChange={(e) =>
                    setDraft({ ...d, bankName: e.target.value })
                  }
                />
              </FormField>
              <FormField label={t('legal.bankAccountLabel')} optional>
                <Input
                  value={d.bankAccount}
                  onChange={(e) =>
                    setDraft({ ...d, bankAccount: e.target.value })
                  }
                />
              </FormField>
              <FormField label={t('legal.correspondentAccountLabel')} optional>
                <Input
                  value={d.correspondentAccount}
                  onChange={(e) =>
                    setDraft({ ...d, correspondentAccount: e.target.value })
                  }
                />
              </FormField>
            </div>
          </SectionCard>

          {/* F-07-179 (Nota Fiscal, Бразилия) у нас не показывается: рынок — Армения (F-00-002), плательщик —
              ՀՎՀՀ и название юрлица выше. Данные payerTax, если были, сохраняются как есть. */}
          <span hidden data-f="F-07-179" />

          <StickyActionBar>
            <Button
              onClick={handleSave}
              disabled={!dirty}
              loading={save.isPending}
            >
              {t('legal.save')}
            </Button>
          </StickyActionBar>
        </fieldset>
      )}
    </div>
  );
}
