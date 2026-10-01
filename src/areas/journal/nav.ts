import type { SubNav } from "@/config/nav-types";

/**
 * Подпункты меню раздела «journal». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/journal.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  journal: [
    { id: "day", href: "/biz/journal", labelKey: "journal.nav.day" },
    {
      id: "settings",
      href: "/biz/journal/settings",
      labelKey: "journal.nav.settings",
      permission: "settings.manage",
    },
  ],
};
