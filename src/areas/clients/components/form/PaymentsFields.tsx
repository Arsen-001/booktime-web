'use client';

/**
 * Форма клиента, «Оплаты» (F-04-059, F-04-165, F-04-166): «Продано» — текстом, не мёртвым полем (ux-r2 №14); «Оплачено» —
 * всё оплаченное, правка меняет только внесённое сверх визитов (правило — domain/clients/money).
 *
 * F-07-056 (перенос истории при переходе из другой программы): в форме «Добавить клиента» «Продано» и «Оплачено» —
 * оба редактируемые числа (нет визитов, значит «Продано» = введённое importedSold целиком); это не операции кассы —
 * остатки касс не меняются. При правке уже созданного клиента «Продано» снова только показывает сумму визитов.
 */
import type { ClientDraft } from '@/areas/clients/components/ClientFormFields';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { KeyValueList } from '@/ui/KeyValueList';
import { MoneyInput } from '@/ui/MoneyInput';

export interface PaymentsFieldsProps {
  draft: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  sold: number;
  canEditGeneral: boolean;
  mode: 'add' | 'edit';
}

export function PaymentsFields({ draft, onChange, sold, canEditGeneral, mode }: PaymentsFieldsProps) {
  const t = useT('clients');
  const fmt = useFormat();
  return (
    <div data-f="F-04-059 F-04-165 F-04-166 F-07-056" className="flex flex-col gap-4">
      {mode === 'add' ? (
        <FormField label={t('table.columns.sold')} hint={t('addClientForm.form.soldHint')}>
          <MoneyInput value={draft.importedSold} onValueChange={(importedSold) => onChange({ importedSold })} disabled={!canEditGeneral} />
        </FormField>
      ) : (
        <KeyValueList items={[{ label: t('table.columns.sold'), value: fmt.money(sold), hint: t('addClientForm.form.soldHint') }]} />
      )}
      <FormField label={t('addClientForm.form.paid')} hint={t('addClientForm.form.paidHint')}>
        <MoneyInput value={draft.paidAmount} onValueChange={(paidAmount) => onChange({ paidAmount })} disabled={!canEditGeneral} />
      </FormField>
    </div>
  );
}
