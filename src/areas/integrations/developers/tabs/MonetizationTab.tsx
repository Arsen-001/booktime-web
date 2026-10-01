'use client';

/**
 * F-13-037: «Монетизация» — бесплатно/платно, цена в месяц, валюта, пробный период → плитка «Цена» и
 * плашка в карточке приложения. F-13-038: «Загрузить сетку тарифов» — демо-разбор Excel-файла в 3 тарифа
 * (раздел только интерфейс, настоящего парсинга нет), они ложатся во вкладку «Тарифы» карточки.
 */
import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { updateDevAppMonetization, uploadDevAppTariffSheet } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { DevApp, DevAppMonetization } from '@/domain/integrations';
import { isDevAppMonetizationValid } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function MonetizationTab({ app, onChanged }: { app: DevApp; onChanged: () => void }) {
  const t = useT('integrations');
  const toast = useToast();
  const { money } = useFormat();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<DevAppMonetization>(app.monetization);
  const mutation = useApiMutation((patch: Partial<DevAppMonetization>) => updateDevAppMonetization(app.id, patch));
  const upload = useApiMutation((fileName: string) => uploadDevAppTariffSheet(app.id, fileName));

  const save = async () => {
    try {
      await mutation.mutate(form);
      toast.success(t('developers.monetization.saved'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await upload.mutate(file.name);
      toast.success(t('developers.monetization.sheetUploaded'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-037 F-13-038" className="flex flex-col gap-4">
      <SectionCard title={t('developers.monetization.title')} description={t('developers.monetization.hint')}>
        <div className="flex flex-col gap-4">
          <Switch
            checked={form.isPaid}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isPaid: v }))}
            label={t('developers.monetization.isPaid')}
            description={t('developers.monetization.isPaidHint')}
          />
          {form.isPaid && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label={t('developers.monetization.priceLabel')} required>
                  <Input
                    type="number"
                    min={0}
                    value={form.priceAmount ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, priceAmount: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </FormField>
                <FormField label={t('developers.monetization.currencyLabel')} required>
                  <Select
                    value={form.currency ?? 'AMD'}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v as DevAppMonetization['currency'] }))}
                    options={[
                      { value: 'AMD', label: 'AMD' },
                      { value: 'USD', label: 'USD' },
                      { value: 'EUR', label: 'EUR' },
                    ]}
                  />
                </FormField>
              </div>
              <FormField label={t('developers.monetization.trialDaysLabel')} optional hint={t('developers.monetization.trialDaysHint')}>
                <Input
                  type="number"
                  min={0}
                  value={form.trialDays ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </FormField>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('developers.monetization.sheetTitle')} description={t('developers.monetization.sheetHint')}>
        <div className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            variant="secondary"
            leftIcon={<Upload aria-hidden />}
            loading={upload.isPending}
            onClick={() => fileRef.current?.click()}
            className="self-start"
          >
            {t('developers.monetization.uploadCta')}
          </Button>
          {app.monetization.tariffSheetFileName && (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
              {app.monetization.tariffSheetFileName}
            </p>
          )}
          {app.monetization.tariffPlans && app.monetization.tariffPlans.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {app.monetization.tariffPlans.map((plan) => (
                <Card key={plan.name} padding="sm" className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-fg">{plan.name}</p>
                  <p className="text-sm text-muted">{plan.currency === 'AMD' ? money(plan.price) : `${plan.price} ${plan.currency}`}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <Button loading={mutation.isPending} onClick={save} disabled={!isDevAppMonetizationValid(form)} className="self-start">
        {t('developers.monetization.save')}
      </Button>
    </div>
  );
}
