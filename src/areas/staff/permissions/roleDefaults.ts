/**
 * Грубый набор прав каждого из 8 шаблонов ролей (F-10-053…061) — нужен только здесь, чтобы «Сбросить
 * к шаблону» (F-10-066/067) и «Роли и права» (просмотр набора, /biz/staff/roles) знали, что входит в
 * роль. В фундаменте (PERSONA_PERMISSIONS) есть только 3 базовых уровня (owner/admin/master) — 6 из
 * 8 наших ролей это админ-уровень с разными галочками, поэтому набор — наше решение (assumed),
 * составлено по описанию роли в ТЗ Altegio.
 */
import type { Permission } from '@/config/permissions';
import type { StaffRoleTemplateId } from '@/domain/staff';

const JOURNAL_BASE: Permission[] = ['journal.view', 'journal.edit', 'journal.create', 'journal.reschedule'];
const CLIENTS_BASE: Permission[] = ['clients.view', 'clients.phones', 'clients.edit'];

export const ROLE_TEMPLATE_COARSE: Record<StaffRoleTemplateId, Permission[]> = {
  owner: [
    'journal.view', 'journal.edit', 'journal.create', 'journal.reschedule', 'journal.others', 'journal.stats',
    'clients.view', 'clients.phones', 'clients.edit', 'clients.export', 'clients.delete',
    'schedule.edit', 'services.view', 'services.edit', 'staff.view', 'staff.manage',
    'online.manage', 'online.own', 'notify.manage', 'notify.mailings', 'notify.log',
    'loyalty.manage', 'loyalty.rules', 'finance.view', 'finance.edit', 'stock.view', 'stock.edit',
    'payroll.view', 'payroll.manage', 'resources.manage', 'reports.view', 'network.manage',
    'integrations.manage', 'settings.manage', 'billing.manage',
  ],
  admin: [
    ...JOURNAL_BASE, 'journal.others', 'journal.stats', ...CLIENTS_BASE,
    'schedule.edit', 'services.view', 'staff.view', 'online.manage', 'online.own',
    'stock.view', 'resources.manage', 'notify.mailings',
    // Владелец, 01.10.2026: администратор ведёт склад (товары, приход, продажа, списание)
    'stock.edit',
    // Владелец, 01.10.2026: кассовую смену ведёт администратор
    'finance.shift',
  ],
  manager: [
    ...JOURNAL_BASE, 'journal.others', 'journal.stats', ...CLIENTS_BASE, 'clients.export',
    'schedule.edit', 'services.view', 'services.edit', 'staff.view', 'online.manage', 'online.own',
    'stock.view', 'stock.edit', 'finance.view', 'reports.view', 'loyalty.manage', 'resources.manage',
    'notify.mailings', 'notify.log',
  ],
  accountant: ['finance.view', 'finance.edit', 'payroll.view', 'payroll.manage', 'reports.view', 'stock.view', 'billing.manage'],
  callCenter: [...JOURNAL_BASE, 'clients.view', 'clients.phones', 'clients.edit', 'services.view', 'online.own', 'notify.mailings'],
  systemManager: ['staff.view', 'staff.manage', 'settings.manage', 'integrations.manage', 'network.manage', 'services.view', 'resources.manage'],
  viewer: ['journal.view', 'clients.view', 'services.view', 'reports.view', 'stock.view', 'finance.view'],
  // Владелец, 01.10.2026: мастер по умолчанию видит только свою зарплату — без payroll.view
  specialist: ['journal.view', 'journal.edit', 'journal.create', 'journal.reschedule', 'clients.view', 'schedule.edit', 'services.view', 'stock.view', 'online.own'],
};
