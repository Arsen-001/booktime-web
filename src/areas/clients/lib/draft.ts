/**
 * Черновик формы клиента ↔ вход api. Одно место для «Добавить» и «Изменить», чтобы поля не расходились.
 */
import type { ClientFormFields } from '@/api/clients';
import type { ClientDraft } from '@/areas/clients/components/ClientFormFields';
import type { ClientRow } from '@/domain/clients';

export function draftToInput(draft: ClientDraft): ClientFormFields {
  return {
    name: draft.name,
    lastName: draft.lastName,
    middleName: draft.middleName,
    phone: draft.phone,
    additionalPhone: draft.additionalPhone || undefined,
    email: draft.email || undefined,
    birthday: draft.birthday || undefined,
    gender: draft.gender === 'unset' ? undefined : draft.gender,
    importanceClass: draft.importanceClass === 'none' ? undefined : draft.importanceClass,
    cardNumber: draft.cardNumber || undefined,
    discountPercent: draft.discountPercent,
    blocked: draft.blocked,
    note: draft.note,
    tags: draft.tags,
    paidAmount: draft.paidAmount,
    importedSold: draft.importedSold,
    customFieldValues: draft.customFieldValues,
    nationalId: draft.nationalId || undefined,
    birthdayGreetingOptOut: draft.birthdayGreetingOptOut,
    locale: draft.locale === 'unset' ? undefined : draft.locale,
    preferredContact: draft.preferredContact,
  };
}

export function rowToDraft(row: ClientRow, customFieldValues: Record<string, string>): ClientDraft {
  return {
    name: row.name,
    lastName: row.lastName ?? '',
    middleName: row.middleName ?? '',
    phone: row.phone,
    additionalPhone: row.additionalPhone ?? '',
    email: row.email ?? '',
    birthday: row.birthday ?? '',
    gender: row.gender === 'unknown' ? 'unset' : row.gender,
    importanceClass: row.importanceClass ?? 'none',
    cardNumber: row.cardNumber ?? '',
    discountPercent: row.discount,
    blocked: Boolean(row.blocked),
    note: row.note ?? '',
    tags: row.tags,
    paidAmount: row.paid,
    importedSold: undefined,
    customFieldValues,
    nationalId: row.nationalId ?? '',
    birthdayGreetingOptOut: Boolean(row.birthdayGreetingOptOut),
    locale: row.locale ?? 'unset',
    preferredContact: row.preferredContact ?? 'call',
  };
}
