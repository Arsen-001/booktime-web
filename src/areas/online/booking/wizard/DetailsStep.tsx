'use client';

import type { ReactNode } from 'react';
import type { OnlineCodeChannel, PlanLegSlot } from '@/api/online';
import { getStaffRules } from '@/api/online-public';
import { useApiQuery } from '@/api/request';
import { CustomFieldInput } from '@/areas/online/booking/wizard/CustomFieldInput';
import { PhoneCodeBlock, type CodeState } from '@/areas/online/booking/wizard/PhoneCodeBlock';
import { PrepaymentNotice, type WizardPrepayment } from '@/areas/online/booking/wizard/PrepaymentNotice';
import { VisitSummary } from '@/areas/online/booking/wizard/VisitSummary';
import { sphereIdsShowPet } from '@/areas/online/booking/wizard/specialistTerms';
import type { BookingForWhom, Service, SphereId, Staff, Workplace } from '@/domain/core';
import type { ClientFieldsConfig, CustomClientField } from '@/domain/online';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { legalLinkTags } from '@/areas/client/legal/LegalDocLink';

/** О15: напоминание словами, а не минутами; «утром в день визита» и «за 2 дня» — как у Altegio */
export const REMINDER_VALUES = ['0', '60', '180', '1440', '2880', 'morning'] as const;
export type ReminderValue = (typeof REMINDER_VALUES)[number];

export interface DetailsForm {
  /** undefined — поле не трогали: показываем имя/номер, запомненные в этом браузере (О14) */
  name?: string;
  phone?: string;
  comment: string;
  consent: boolean;
  forWhom: BookingForWhom;
  email: string;
  lastName: string;
  patronymic: string;
  custom: Record<string, string>;
  reminder: ReminderValue;
  visitAddress: string;
  depositAgree: boolean;
  /** ⭐ «Оплатить всё сразу» вместо предоплаты мастера */
  payInFull: boolean;
}

export const EMPTY_DETAILS: DetailsForm = {
  comment: '',
  consent: false,
  forWhom: 'self',
  email: '',
  lastName: '',
  patronymic: '',
  custom: {},
  reminder: '60',
  visitAddress: '',
  depositAgree: false,
  payInFull: false,
};

export interface DetailsErrors {
  name?: string;
  phone?: string;
  consent?: string;
  code?: string;
  deposit?: string;
  fields?: string;
}

export function DetailsStep({
  legs,
  staff,
  services,
  travelFee,
  anySpecialist,
  form,
  name,
  phone,
  onPatch,
  errors,
  codeState,
  code,
  onCodeChange,
  phoneVerified,
  phoneRemembered,
  onSendCode,
  onVerifyCode,
  onForgetPhone,
  prepayment,
  noShowRule,
  consentText,
  widgetText,
  clientFields,
  networkFields,
  workplace,
  submitting,
  onSubmit,
  onEditTime,
  onEditServices,
  hourCycle,
  sphereIds,
  addOns,
  summaryExtras,
  extraMinutes,
}: {
  legs: PlanLegSlot[];
  staff: Staff[];
  services: Service[];
  travelFee: number;
  anySpecialist: boolean;
  form: DetailsForm;
  /** Показанные имя и номер (введённые или запомненные) */
  name: string;
  phone: string;
  onPatch: (patch: Partial<DetailsForm>) => void;
  errors: DetailsErrors;
  codeState: CodeState;
  code: string;
  onCodeChange: (v: string) => void;
  phoneVerified: boolean;
  phoneRemembered: boolean;
  onSendCode: (channel: OnlineCodeChannel) => void;
  onVerifyCode: (code: string) => void;
  onForgetPhone: () => void;
  /** О5: сумма и условия предоплаты — до записи */
  prepayment: WizardPrepayment | undefined;
  /** ⭐ Мастер берёт предоплату только с тех, кто не пришёл `count` раз за `months` месяцев — предупреждение до записи */
  noShowRule?: { count: number; months: number };
  consentText: string | undefined;
  widgetText: string | undefined;
  clientFields: ClientFieldsConfig;
  networkFields: CustomClientField[];
  workplace: Workplace;
  submitting: boolean;
  onSubmit: () => void;
  onEditTime: () => void;
  onEditServices: () => void;
  hourCycle?: '24' | '12';
  sphereIds?: SphereId[];
  /** ⭐ Допродажа: блок «Добавить к визиту» (рисует мастер записи) — сразу под итогом визита */
  addOns?: ReactNode;
  summaryExtras?: { id: string; name: string; min: number; max: number }[];
  extraMinutes?: number;
}) {
  const t = useT('online');
  const format = useFormat({ hourCycle });
  // F-03-095: депозит/гарантия картой — своя политика мастера (первой части визита)
  const firstStaffId = legs[0]?.staffId ?? '';
  const rulesQ = useApiQuery(['online-details-deposit-rules', firstStaffId], () => getStaffRules(firstStaffId), { enabled: Boolean(firstStaffId) });
  const rules = rulesQ.data;
  const hasDepositPolicy = Boolean(rules?.depositPolicyKind);

  return (
    <div className="flex flex-col gap-4" data-f="F-03-090 F-04-064 F-06-128">
      <VisitSummary
        legs={legs}
        staff={staff}
        services={services}
        travelFee={travelFee}
        anySpecialist={anySpecialist}
        onEditTime={onEditTime}
        onEditServices={onEditServices}
        hourCycle={hourCycle}
        sphereIds={sphereIds}
        visitAddress={workplace === 'visit' ? form.visitAddress : undefined}
        extras={summaryExtras}
        extraMinutes={extraMinutes}
      />
      {addOns}

      {/* ⭐ Запись на сдачу (05.10.2026): «для кого» у сдачи вещи не спрашиваем */}
      {!services.every((s) => s.kind === 'intake') && (
        <div className="flex flex-col gap-2" data-f="F-03-141">
          <p className="text-sm font-medium text-fg">{t('booking.details.forWhom')}</p>
          <SegmentedControl
            value={form.forWhom}
            onValueChange={(v) => onPatch({ forWhom: v as BookingForWhom })}
            size="sm"
            fullWidth
            options={[
              { value: 'self', label: t('booking.details.forWhomSelf') },
              { value: 'child', label: t('booking.details.forWhomChild') },
              // F-00-145: «Питомец» только у сфер, где принимают животных
              ...(sphereIdsShowPet(sphereIds) ? [{ value: 'pet', label: t('booking.details.forWhomPet') }] : []),
              { value: 'other', label: t('booking.details.forWhomOther') },
            ]}
          />
        </div>
      )}

      {workplace === 'visit' && (
        <div data-f="F-00-080">
          <FormField label={t('booking.workplaceStep.address')} optional>
            <Input value={form.visitAddress} onChange={(e) => onPatch({ visitAddress: e.target.value })} placeholder={t('booking.workplaceStep.addressPlaceholder')} />
          </FormField>
        </div>
      )}

      {widgetText && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-fg" data-f="F-03-075">
          {widgetText}
        </p>
      )}

      <div className="flex flex-col gap-3" data-f="F-03-091">
        <FormField label={t('booking.details.name')} required error={errors.name}>
          <Input value={name} onChange={(e) => onPatch({ name: e.target.value })} placeholder={t('booking.details.namePlaceholder')} autoComplete="name" />
        </FormField>
        {(clientFields.lastNameEnabled || clientFields.patronymicEnabled) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-f="F-03-072">
            {clientFields.lastNameEnabled && (
              <FormField label={t('booking.details.lastName')} required={clientFields.lastNameRequired} optional={!clientFields.lastNameRequired}>
                <Input value={form.lastName} onChange={(e) => onPatch({ lastName: e.target.value })} autoComplete="family-name" />
              </FormField>
            )}
            {clientFields.patronymicEnabled && (
              <FormField label={t('booking.details.patronymic')} required={clientFields.patronymicRequired} optional={!clientFields.patronymicRequired}>
                <Input value={form.patronymic} onChange={(e) => onPatch({ patronymic: e.target.value })} />
              </FormField>
            )}
          </div>
        )}
        <div data-f="F-03-125">
          <FormField label={t('booking.details.phone')} required error={errors.phone}>
            <PhoneInput value={phone} onValueChange={(v) => onPatch({ phone: v })} invalid={Boolean(errors.phone)} />
          </FormField>
        </div>

        <PhoneCodeBlock
          verified={phoneVerified}
          remembered={phoneRemembered}
          state={codeState}
          code={code}
          onCodeChange={onCodeChange}
          onSend={onSendCode}
          onVerify={onVerifyCode}
          onForget={onForgetPhone}
          error={errors.code}
        />

        <div data-f="F-03-092">
          <FormField label={t('booking.details.reminder')} hint={t('booking.details.reminderWhere')}>
            <Select
              value={form.reminder}
              onValueChange={(v) => onPatch({ reminder: v as ReminderValue })}
              options={REMINDER_VALUES.map((v) => ({ value: v, label: t(`booking.details.reminderOpt.${v}` as 'booking.details.reminderOpt.0') }))}
            />
          </FormField>
        </div>

        {!clientFields.emailHidden && (
          <div data-f="F-03-071">
            <FormField label={t('booking.details.email')} required={clientFields.emailRequired} optional={!clientFields.emailRequired}>
              <Input type="email" value={form.email} onChange={(e) => onPatch({ email: e.target.value })} autoComplete="email" />
            </FormField>
          </div>
        )}
        {!clientFields.commentHidden && (
          <div data-f="F-03-071">
            <FormField label={clientFields.commentLabel || t('booking.details.comment')} required={clientFields.commentRequired} optional={!clientFields.commentRequired}>
              <Textarea value={form.comment} onChange={(e) => onPatch({ comment: e.target.value.slice(0, 150) })} maxLength={150} rows={2} />
            </FormField>
            <p className="mt-1 text-right text-xs text-muted">{form.comment.length}/150</p>
          </div>
        )}
        {clientFields.customFields.length > 0 && (
          <div className="flex flex-col gap-3" data-f="F-03-073">
            {[...clientFields.customFields]
              .sort((a, b) => a.order - b.order)
              .map((f) => (
                <CustomFieldInput
                  key={f.id}
                  field={f}
                  value={form.custom[f.id] ?? ''}
                  onChange={(v) => onPatch({ custom: { ...form.custom, [f.id]: v } })}
                  datePlaceholder={t('booking.details.datePlaceholder')}
                />
              ))}
          </div>
        )}
        {/* F-03-074: поля сети — общие для всех локаций сети, отдельно от полей одного бизнеса выше */}
        {networkFields.length > 0 && (
          <div className="flex flex-col gap-3" data-f="F-03-074">
            {[...networkFields]
              .sort((a, b) => a.order - b.order)
              .map((f) => (
                <CustomFieldInput
                  key={f.id}
                  field={f}
                  value={form.custom[f.id] ?? ''}
                  onChange={(v) => onPatch({ custom: { ...form.custom, [f.id]: v } })}
                  datePlaceholder={t('booking.details.datePlaceholder')}
                />
              ))}
          </div>
        )}
        {errors.fields && <p className="text-sm text-danger">{errors.fields}</p>}

        {hasDepositPolicy && rules && (
          <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3" data-f="F-03-095 F-04-155">
            <p className="text-sm font-medium text-fg">
              {t(rules.depositPolicyKind === 'deposit' ? 'booking.details.depositPolicy.depositTitle' : 'booking.details.depositPolicy.guaranteeTitle')}
            </p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {rules.depositPolicyKind === 'deposit' && rules.depositAmount && (
                <li>{t('booking.details.depositPolicy.amount', { amount: format.money(rules.depositAmount) })}</li>
              )}
              <li>{t('booking.details.depositPolicy.freeWindow', { hours: rules.cancelWindowHours })}</li>
              {rules.noShowPenalty ? (
                <li>{t('booking.details.depositPolicy.noShowPenalty', { amount: format.money(rules.noShowPenalty) })}</li>
              ) : rules.depositPolicyKind === 'deposit' && rules.depositAmount ? (
                <li>{t('booking.details.depositPolicy.forfeit', { amount: format.money(rules.depositAmount) })}</li>
              ) : null}
            </ul>
            <Checkbox checked={form.depositAgree} onCheckedChange={(v) => onPatch({ depositAgree: v })} label={t('booking.details.depositPolicy.agree')} />
            {errors.deposit && <p className="text-sm text-danger">{errors.deposit}</p>}
          </div>
        )}

        <div data-f="F-03-079 F-03-080 F-14-162 F-04-151">
          <Checkbox checked={form.consent} onCheckedChange={(v) => onPatch({ consent: v })} label={t.rich('booking.details.consent', legalLinkTags)} description={consentText} />
        </div>
        {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}

        {noShowRule && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted" data-f="F-00-071 F-00-097">
            {t('booking.details.prepayNoShowsRule', { count: noShowRule.count, months: noShowRule.months })}
          </p>
        )}
        {prepayment && <PrepaymentNotice prepayment={prepayment} payInFull={form.payInFull} onPayInFullChange={(v) => onPatch({ payInFull: v })} />}
      </div>

      {/* Итог — в карточке визита выше; в панели только кнопка: длинная «Записаться и перейти к оплате» и сумма «от–до»
          на 390 px вдвоём не помещаются */}
      <StickyActionBar desktop="sticky">
        <Button loading={submitting} onClick={onSubmit} data-f="F-03-093">
          {prepayment ? t('booking.details.submitAndPay') : t('booking.details.submit')}
        </Button>
      </StickyActionBar>
    </div>
  );
}
