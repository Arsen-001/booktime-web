import type { SubNav } from "@/config/nav-types";

/**
 * Подпункты меню раздела «staff». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/staff.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  staff: [
    { id: "list", href: "/biz/staff", labelKey: "staff.nav.list" },
    {
      id: "positions",
      href: "/biz/staff/positions",
      labelKey: "staff.nav.positions",
    },
    { id: "roles", href: "/biz/staff/roles", labelKey: "staff.nav.roles" },
    // Журнал открывается с settings.manage (изменения, входы) или clients.export (только выгрузки); без settings.manage
    // пункт скрыт, чтобы администратор по умолчанию не упирался в «Доступ запрещён» (QA 30.09)
    { id: "log", href: "/biz/staff/log", labelKey: "staff.nav.log", permission: "settings.manage" },
  ],
};
