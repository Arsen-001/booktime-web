/**
 * Общий текст одной строки журнала изменений клиента (F-04-137, ⭐): используется и в карточке клиента
 * (ChangeLogCard), и в общем бизнес-журнале (ChangeLogScreen).
 */
import type { ClientChangeLogEntry } from '@/domain/clients';
import type { useT } from '@/i18n/useT';

// Ключи t() проверяет компилятор — нужны буквальные строки, поэтому switch, а не таблица.
function fieldLabel(t: ReturnType<typeof useT<'clients'>>, field: string): string {
  switch (field) {
    case 'name':
      return t('addClientForm.form.name');
    case 'lastName':
      return t('addClientForm.form.lastName');
    case 'middleName':
      return t('addClientForm.form.middleName');
    case 'phone':
      return t('addClientForm.form.phone');
    case 'additionalPhone':
      return t('addClientForm.form.additionalPhone');
    case 'email':
      return t('addClientForm.form.email');
    case 'birthday':
      return t('addClientForm.form.birthday');
    case 'gender':
      return t('addClientForm.form.gender');
    case 'importanceClass':
      return t('addClientForm.form.importance');
    case 'cardNumber':
      return t('form.cardNumber');
    case 'discountPercent':
      return t('addClientForm.form.discount');
    case 'blocked':
      return t('form.blacklisted');
    case 'tags':
      return t('addClientForm.form.categories');
    case 'paidAmount':
      return t('addClientForm.form.paid');
    case 'avatar':
      return t('card.photo');
    case 'nationalId':
      return t('card.nationalId');
    case 'locale':
      return t('card.clientLocale');
    default:
      return t('form.note');
  }
}

export function describeClientChange(t: ReturnType<typeof useT<'clients'>>, e: ClientChangeLogEntry): string {
  if (e.action === 'created') return t('changeLog.created');
  if (e.action === 'deleted') return t('changeLog.deleted');
  if (e.action === 'purged') return t('changeLog.purged');
  if (e.action === 'merged') return t('changeLog.merged', { name: e.summary || e.clientName });
  const fields = e.summary
    .split(',')
    .filter(Boolean)
    .map((f) => fieldLabel(t, f))
    .join(', ');
  return fields ? t('changeLog.updated', { fields }) : t('changeLog.updatedGeneric');
}
