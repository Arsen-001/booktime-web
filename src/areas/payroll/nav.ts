import type { SubNav } from "@/config/nav-types";

/**
 * Подпункты меню раздела «payroll». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/payroll.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  payroll: [
    { id: "schemes", href: "/biz/payroll", labelKey: "payroll.nav.schemes" },
    {
      id: "settings",
      href: "/biz/payroll/settings",
      labelKey: "payroll.nav.settings",
    },
    { id: "daily", href: "/biz/payroll/daily", labelKey: "payroll.nav.daily" },
    {
      id: "period",
      href: "/biz/payroll/period",
      labelKey: "payroll.nav.period",
      // Ведомость сотрудника за период (и «Новый расчёт») своего пункта не имеет — открывается из расчёта за период
      also: ["/biz/payroll/statement"],
    },
    // F-09-001: «Взаиморасчёты» — тот же экран, что и в «Финансах» (src/areas/finance/SettlementsScreen.tsx,
    // F-07-159…167), но по адресу раздела: меню не перескакивает в «Финансы» (зарплата-ревью З21).
    {
      id: "settlements",
      href: "/biz/payroll/settlements",
      labelKey: "payroll.nav.settlements",
    },
    {
      id: "bonuses",
      href: "/biz/payroll/bonuses",
      labelKey: "payroll.nav.bonuses",
    },
    // F-09-049…056: классическая модель — на моках всегда доступна, но экраны сами прячутся/предупреждают,
    // когда «Основные настройки» переключены на упрощённую (F-09-002); подпункт остаётся в меню всегда,
    // чтобы владелец мог включить классику отсюда же.
    // Правила, критерии, схемы, фонд и быстрая настройка — только с payroll.manage (сервер их без него не отдаёт)
    { id: "rules", href: "/biz/payroll/rules", labelKey: "payroll.nav.rules", permission: "payroll.manage" },
    {
      id: "criteria",
      href: "/biz/payroll/criteria",
      labelKey: "payroll.nav.criteria",
      permission: "payroll.manage",
    },
    {
      id: "charts",
      href: "/biz/payroll/charts",
      labelKey: "payroll.nav.charts",
      permission: "payroll.manage",
    },
    {
      id: "analytics",
      href: "/biz/payroll/analytics",
      labelKey: "payroll.nav.analytics",
      permission: "payroll.manage",
    },
    { id: "setup", href: "/biz/payroll/setup", labelKey: "payroll.nav.setup", permission: "payroll.manage" },
    { id: "me", href: "/biz/payroll/me", labelKey: "payroll.nav.me" },
  ],
};
