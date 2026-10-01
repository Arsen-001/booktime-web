import { useCurrent, usePermissions } from '@/demo/hooks';

/**
 * Доступ к разделу «Онлайн-запись» для персон admin/master.
 *
 * ⭐ Временная заплата (online-permissions, qa/build/online-g1-2-fix1.md): право `online.manage`
 * отсутствует в БАЗОВОМ наборе admin и master (`src/config/permissions.ts` — фундамент, сами не правим,
 * просьба записана в `qa/requests/online.md`). Пока просьба не выполнена — считаем доступ здесь, в своих
 * путях (CONVENTIONS §1 «обходитесь своими путями»):
 *
 *  - **full** (owner-like): весь раздел, все сотрудники — как и раньше у owner/network/individual
 *    (`online.manage` в базовом наборе), плюс **admin**. Код раздела и без того уже считает admin
 *    «как владельца» для видимости заявок и правил (см. `OWNER_LIKE` в SettingsScreen/RequestsScreen —
 *    admin видит всех сотрудников, а не только себя), так что предоставлять ему весь раздел — то же
 *    решение, продолженное до конца, а не новое.
 *  - **own** (свои записи/правила): весь **full**-доступ, плюс **master** — только свои правила
 *    (F-00-066) и свои заявки (F-03-127); экраны `SettingsScreen`/`RequestsScreen` уже фильтруют список
 *    сотрудников до одного (ownStaffOnly), эта функция лишь открывает сам экран.
 *
 * `usePermissions()` уже учитывает персональные права конкретного администратора, если владелец их менял
 * (`staffPermissions` в ядре) — эта заплата НИЧЕГО не переопределяет поверх настоящего `online.manage`,
 * она только достраивает персону admin/master, когда права взяты из базового набора персоны как есть
 * (сегодня экрана «права сотрудника» ещё нет ни у одного раздела, переопределить нечем).
 */
export function useOnlineAccess(): { full: boolean; own: boolean } {
  const permissions = usePermissions();
  const { persona } = useCurrent();
  const hasManage = permissions.has('online.manage');
  const full = hasManage || persona === 'admin';
  const own = full || persona === 'master';
  return { full, own };
}
