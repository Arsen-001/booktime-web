'use client';

/**
 * Тело формы клиента (F-04-044…061) — одно для «Добавить клиента» и «Изменить» (обе в одной шторке, ux-r2 №6).
 *
 * «Добавить»: видны только имя и телефон — клиента можно завести за 5 секунд; остальное свёрнуто в «Ещё о клиенте»
 * (ux-r2 улучшение 3, ux-best-c1 №4). «Изменить»: те же поля секциями «Контакты / О клиенте / Скидка и уровень / Оплаты /
 * Свои поля». Сетки считаются от ширины шторки (@container в Sheet), поэтому телефон на десктопе виден целиком
 * (ux-r2 №3, ux-r5 №6); подписи «(необязательно)» нет — обязательные два поля отмечены звёздочкой.
 */
import type { ReactNode } from 'react';
import type { LocaleCode, Gender } from '@/domain/core';
import type { CustomFieldDef, ImportanceClass, PreferredContact } from '@/domain/clients';
import { AboutFields } from '@/areas/clients/components/form/AboutFields';
import { ContactsFields } from '@/areas/clients/components/form/ContactsFields';
import { CustomFields, type NewCustomFieldInput } from '@/areas/clients/components/form/CustomFields';
import { DiscountFields } from '@/areas/clients/components/form/DiscountFields';
import { PaymentsFields } from '@/areas/clients/components/form/PaymentsFields';
import { FormSection as Section } from '@/areas/clients/components/form/FormSection';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';

export interface ClientDraft {
  name: string;
  lastName: string;
  middleName: string;
  phone: string;
  additionalPhone: string;
  email: string;
  birthday: string;
  gender: Gender | 'unset';
  importanceClass: ImportanceClass | 'none';
  cardNumber: string;
  discountPercent: number | undefined;
  blocked: boolean;
  note: string;
  tags: string[];
  /** Всё оплаченное клиентом (как на карточке), не только внесённое сверх визитов */
  paidAmount: number | undefined;
  /** F-07-056: «Продано» при переносе истории из другой программы — только в форме «Добавить клиента» */
  importedSold: number | undefined;
  customFieldValues: Record<string, string>;
  /** F-04-192 */
  nationalId: string;
  /** F-04-213 */
  birthdayGreetingOptOut: boolean;
  /** F-04-228: только у клиента без приложения */
  locale: LocaleCode | 'unset';
  /** F-04-066: как клиент просит связываться — этот канал первым среди кнопок и в липкой полосе */
  preferredContact: PreferredContact;
}

export function emptyClientDraft(name = ''): ClientDraft {
  const digits = name.replace(/\D/g, '');
  // Из пустого поиска «Добавить «…»»: цифры — это телефон, буквы — имя (ux-r1 №18)
  const isPhone = digits.length >= 6 && digits.length >= name.replace(/\s/g, '').length - 1;
  return {
    name: isPhone ? '' : name,
    lastName: '',
    middleName: '',
    phone: isPhone ? `+374${digits.slice(-8)}` : '',
    additionalPhone: '',
    email: '',
    birthday: '',
    gender: 'unset',
    importanceClass: 'none',
    cardNumber: '',
    discountPercent: undefined,
    blocked: false,
    note: '',
    tags: [],
    paidAmount: undefined,
    importedSold: undefined,
    customFieldValues: {},
    nationalId: '',
    birthdayGreetingOptOut: false,
    locale: 'unset',
    preferredContact: 'call',
  };
}

export interface ClientFormFieldsProps {
  mode: 'add' | 'edit';
  draft: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  errors?: Partial<Record<'name' | 'phone', string>>;
  showFullName: boolean;
  categoryOptions: string[];
  customFieldDefs: CustomFieldDef[];
  onAddCustomFieldDef: (input: NewCustomFieldInput) => void;
  /** F-04-144: без обработчика (например, форма «Добавить клиента») удалить поле из формы нельзя */
  onDeleteCustomFieldDef?: (fieldId: string) => void | Promise<void>;
  /** «Продано» — обычно только показ (F-00-126, F-04-165); в «Добавить» это поле редактируется — перенос
   *  истории «Продано / Оплачено» из другой программы (F-07-056) */
  sold?: number;
  /** Фото клиента (F-04-069) — первым полем в правке */
  photo?: ReactNode;
  /** F-04-228: язык клиента выбирает мастер только пока у клиента нет приложения */
  hasApp?: boolean;
  /** F-04-195: тонкие права поверх общего «Изменять клиента» */
  canEditFullName?: boolean;
  canEditNote?: boolean;
  canEditCustomFields?: boolean;
  canEditGeneral?: boolean;
  /** F-04-198: без права «Просмотр доп. полей» секция скрыта совсем */
  canViewCustomFields?: boolean;
}

export function ClientFormFields({
  mode,
  draft,
  onChange,
  errors,
  showFullName,
  categoryOptions,
  customFieldDefs,
  onAddCustomFieldDef,
  onDeleteCustomFieldDef,
  sold = 0,
  photo,
  hasApp = false,
  canEditFullName = true,
  canEditNote = true,
  canEditCustomFields = true,
  canEditGeneral = true,
  canViewCustomFields = true,
}: ClientFormFieldsProps) {
  const t = useT('clients');
  const compact = mode === 'add';

  const about = (
    <AboutFields
      draft={draft}
      onChange={onChange}
      categoryOptions={categoryOptions}
      hasApp={hasApp}
      canEditGeneral={canEditGeneral}
      canEditNote={canEditNote}
    />
  );
  const discount = <DiscountFields draft={draft} onChange={onChange} canEditGeneral={canEditGeneral} />;
  const importedPayments = (
    <PaymentsFields draft={draft} onChange={onChange} sold={sold} canEditGeneral={canEditGeneral} mode={mode} />
  );
  const custom = (
    <CustomFields
      draft={draft}
      onChange={onChange}
      defs={customFieldDefs}
      onAddDef={onAddCustomFieldDef}
      onDeleteDef={onDeleteCustomFieldDef}
      canEdit={canEditCustomFields}
      canView={canViewCustomFields}
    />
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-6">
        <ContactsFields draft={draft} onChange={onChange} errors={errors} showFullName={showFullName} part="main" canEditGeneral canEditFullName />
        <Accordion
          variant="plain"
          items={[
            {
              id: 'more',
              title: t('form.more'),
              content: (
                <div className="flex flex-col gap-6 pt-2">
                  <Section title={t('form.sections.contacts')}>
                    {/* имя и телефон уже выше — здесь ФИО, второй телефон и email */}
                    <ContactsFields draft={draft} onChange={onChange} showFullName={showFullName} part="extra" canEditGeneral canEditFullName />
                  </Section>
                  <Section title={t('form.sections.about')}>{about}</Section>
                  <Section title={t('form.sections.discount')}>{discount}</Section>
                  <Section title={t('form.sections.payments')}>{importedPayments}</Section>
                  <Section title={t('form.sections.custom')}>{custom}</Section>
                </div>
              ),
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div data-f="F-04-062" className="flex flex-col gap-8">
      {photo}
      <Section title={t('form.sections.contacts')}>
        <ContactsFields
          draft={draft}
          onChange={onChange}
          errors={errors}
          showFullName={showFullName}
          part="all"
          canEditGeneral={canEditGeneral}
          canEditFullName={canEditFullName}
        />
      </Section>
      <Section title={t('form.sections.about')}>{about}</Section>
      <Section title={t('form.sections.discount')}>{discount}</Section>
      <Section title={t('form.sections.payments')}>{importedPayments}</Section>
      <Section title={t('form.sections.custom')}>{custom}</Section>
    </div>
  );
}
