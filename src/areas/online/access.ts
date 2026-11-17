import { usePermissions } from '@/demo/hooks';

/**
 * Доступ к разделу «Онлайн-запись» — по правам, а не по персоне (проход 17.11.2026, «только просмотр»): раньше
 * администратор считался «как владелец» и без права `online.manage` — видел и менял ссылки, страницу, виджет и правила
 * всего салона, а сервер отвечал 403.
 *  - **full** — `online.manage`: весь раздел, все сотрудники (правила салона, ссылки, страница, виджет);
 *  - **own** — `online.own` (мастер, администратор без `online.manage`): только свои правила (F-00-066), свои заявки
 *    (F-03-127) и места работы — сервер так же пускает «сам себе» (PUT staff/:id/client-rules, PATCH своей карточки).
 */
export function useOnlineAccess(): { full: boolean; own: boolean } {
  const permissions = usePermissions();
  const full = permissions.has('online.manage');
  const own = full || permissions.has('online.own');
  return { full, own };
}
