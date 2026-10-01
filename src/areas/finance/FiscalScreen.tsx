'use client';

/**
 * /biz/finance/fiscal — «Фискализация». Армянский вариант (fin-review Ф4, 27.09): фискальный чек ՀԴՄ (e-HDM) —
 * интеграция в плане, пока напоминание кассиру и номер аппарата. Образцы чужих стран Altegio (Украина РРО F-07-152…154,
 * Венгрия F-07-157, Бразилия F-07-156) заменены им: те же функции «фискальный чек страны» — для нашей страны.
 */
import { useState } from 'react';
import { FileCheck2, Receipt } from 'lucide-react';
import { getFiscalSettings, saveFiscalSettings, type FiscalSettingsPatch } from '@/api/finance';
import type { FiscalSettings } from '@/domain/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function FiscalScreen() {
  const t = useT('finance');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');

  const settingsQ = useApiQuery(['finance', 'fiscalSettings', businessId], () => getFiscalSettings(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const saveM = useApiMutation((patch: FiscalSettingsPatch) => saveFiscalSettings(businessId!, patch));

  if (settingsQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('fiscal.title')} />
        <ErrorState onRetry={() => settingsQ.refetch()} />
      </div>
    );
  }

  if (settingsQ.isLoading || !settingsQ.data) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
        <PageHeader title={t('fiscal.title')} description={t('fiscal.subtitle')} />
        <Skeleton lines={6} />
      </div>
    );
  }

  return (
    <FiscalForm
      key={settingsQ.data.updatedAt}
      initial={settingsQ.data}
      canEdit={canEdit}
      onSave={saveM.mutate}
      pending={saveM.isPending}
      onSaved={() => {
        settingsQ.refetch();
        toast.success(t('online.save'));
      }}
      onFail={() => toast.error(t('online.saveFailed'))}
    />
  );
}

function FiscalForm({
  initial,
  canEdit,
  onSave,
  pending,
  onSaved,
  onFail,
}: {
  initial: FiscalSettings;
  canEdit: boolean;
  onSave: (patch: FiscalSettingsPatch) => Promise<FiscalSettings>;
  pending: boolean;
  onSaved: () => void;
  onFail: () => void;
}) {
  const t = useT('finance');
  const [draft, setDraft] = useState(initial);

  const armenia = draft.armenia ?? { remindToPrint: false, hdmRegNumber: '' };

  const handleSave = async () => {
    try {
      await onSave({ armenia });
      onSaved();
    } catch {
      onFail();
    }
  };

  // fin-review Ф4: армянский вариант вместо чужих стран (Украина/Венгрия/Бразилия — образцы Altegio, нам не нужны).
  // Интеграции с ՀԴՄ (e-HDM) нет — это план; закон не проверяли, поэтому формулировки нейтральные.
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-6">
      <PageHeader title={t('fiscal.title')} description={t('fiscal.subtitle')} />

      <div data-f="F-07-152 F-07-153 F-07-154 F-07-156 F-07-157 F-13-207">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Receipt aria-hidden className="size-5 text-muted" />
              {t('fiscal.armenia.title')}
            </span>
          }
          description={t('fiscal.armenia.description')}
          actions={<Badge tone="info">{t('fiscal.armenia.planned')}</Badge>}
        >
          <div className="flex flex-col gap-4">
            <Switch
              label={t('fiscal.armenia.remind')}
              description={t('fiscal.armenia.remindHint')}
              checked={armenia.remindToPrint}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, armenia: { ...armenia, remindToPrint: v } }))}
              disabled={!canEdit}
            />
            <label className="flex max-w-sm flex-col gap-1.5">
              <span className="text-sm font-medium">{t('fiscal.armenia.regNumber')}</span>
              <Input
                value={armenia.hdmRegNumber}
                onChange={(e) => setDraft((d) => ({ ...d, armenia: { ...armenia, hdmRegNumber: e.target.value } }))}
                disabled={!canEdit}
                placeholder={t('fiscal.armenia.regNumberPlaceholder')}
              />
            </label>
          </div>
        </SectionCard>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
        <FileCheck2 aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>{t('fiscal.armeniaHint')}</p>
      </div>

      {canEdit && (
        // Не sticky: страница коротка (3 карточки-образца), sticky-нижний бар на такой высоте контента
        // рендерится "прилипшим" к низу вьюпорта уже при scrollTop=0 (проверено getBoundingClientRect) и
        // перекрывает текст карточки «Бразилия» — тот самый дефект раунда 0/1 (b04-m1, F-07-156). pb-24
        // не помогал, т.к. это хвостовой отступ ПОСЛЕ бара, а не отступ перед ним. Обычная кнопка в потоке
        // не может перекрыть предыдущий контент ни при каком скролле.
        <div className="flex justify-end pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <Button size="lg" loading={pending} onClick={handleSave}>
            {t('online.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
