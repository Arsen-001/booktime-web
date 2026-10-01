'use client';

/**
 * F-06-196/F-06-176: право «Просмотр счетов», «Открыть счет», «Пополнить счет», «Просмотр истории операций
 * по счетам» — четыре тонких права (справка 1476), которые владелец выдаёт на карточке клиента (Сотрудники →
 * Доступ → Клиентская база → Счета). Раздел clients уже завёл их как F-04-200 (`viewAccounts`, `openAccount`,
 * `topUpAccount`, `viewAccountHistory` — src/domain/clients/types.ts), потому что счета живут во вкладке
 * «Лояльность» карточки клиента, которой владеет clients. Мы их читаем через уже готовый
 * getStaffFineRights/setStaffFineRights (src/api/clients), а не заводим вторую систему прав на те же 4
 * галочки (F-06-175/176/177 — экран «Доступ» с остальными 8+3 галочками лояльности пока не существует нигде
 * в коде; просьба завести его в разделе staff и связать со своими правами — qa/requests/loyalty.md).
 */
import { getStaffFineRights } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent, useDemo } from '@/demo/hooks';
import { allFineRights, defaultAdminFineRights, defaultMasterFineRights, type ClientsFineRights } from '@/domain/clients';

export interface AccountRights {
  viewAccounts: boolean;
  openAccount: boolean;
  /** F-06-176: «Пополнить счет» без права на оплату (здесь — journal.edit, проводит оплату записи) не даёт пополнить */
  topUpAccount: boolean;
  viewAccountHistory: boolean;
  ready: boolean;
}

function defaultsForPersona(persona: string): ClientsFineRights {
  if (persona === 'admin') return defaultAdminFineRights();
  if (persona === 'master') return defaultMasterFineRights();
  return allFineRights(true);
}

export function useAccountRights(): AccountRights {
  const { persona } = useDemo();
  const { staffId, ready: currentReady } = useCurrent();
  const canPay = useCan('journal.edit');

  const q = useApiQuery(['clients', 'staffRights', staffId], () => getStaffFineRights(staffId ?? ''), {
    enabled: currentReady && Boolean(staffId) && (persona === 'admin' || persona === 'master'),
  });

  const owner = persona === 'owner' || persona === 'network' || persona === 'individual';
  const base = defaultsForPersona(persona);
  const override = persona === 'admin' || persona === 'master' ? q.data : undefined;
  const merged: ClientsFineRights = owner ? allFineRights(true) : { ...base, ...override };

  return {
    viewAccounts: merged.viewAccounts,
    openAccount: merged.openAccount,
    topUpAccount: merged.topUpAccount && canPay,
    viewAccountHistory: merged.viewAccountHistory,
    ready: owner || (currentReady && !q.isLoading),
  };
}
