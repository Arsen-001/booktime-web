import type { SubNav } from "@/config/nav-types";

/**
 * Подпункты меню раздела «network»: кабинет сети (F-11-003). Файл принадлежит разделу.
 * «Переключатель» (/biz/network/switch) и «Создание сети» (/biz/network/new) открываются из шапки, а не отсюда.
 * Лояльность и Счета клиентов сети живут в разделе loyalty (/biz/loyalty/**) — там же и подпункты.
 */
export const subnav: SubNav = {
  network: [
    { id: "overview", href: "/biz/network", labelKey: "network.nav.overview" },
    {
      id: "analytics",
      href: "/biz/network/analytics",
      labelKey: "network.nav.analytics",
      permission: "network.manage",
    },
    {
      id: "clients",
      href: "/biz/network/clients",
      labelKey: "network.nav.clients",
      permission: "network.manage",
    },
    {
      id: "records",
      href: "/biz/network/records",
      labelKey: "network.nav.records",
      permission: "network.manage",
    },
    {
      id: "staff",
      href: "/biz/network/staff",
      labelKey: "network.nav.staff",
      permission: "network.manage",
    },
    {
      id: "services",
      href: "/biz/network/services",
      labelKey: "network.nav.services",
      permission: "network.manage",
    },
    {
      id: "servicesSubdivisions",
      href: "/biz/network/services/subdivisions",
      labelKey: "network.nav.servicesSubdivisions",
      permission: "network.manage",
    },
    {
      id: "servicesMigration",
      href: "/biz/network/services/migration",
      labelKey: "network.nav.servicesMigration",
      permission: "network.manage",
    },
    {
      id: "goods",
      href: "/biz/network/goods",
      labelKey: "network.nav.goods",
      permission: "network.manage",
    },
    {
      id: "loyaltyInfo",
      href: "/biz/network/loyalty",
      labelKey: "network.nav.loyaltyInfo",
      permission: "network.manage",
    },
    {
      id: "telephony",
      href: "/biz/network/telephony",
      labelKey: "network.nav.telephony",
      permission: "network.manage",
    },
    {
      id: "settings",
      href: "/biz/network/settings",
      labelKey: "network.nav.settings",
      permission: "network.manage",
    },
    {
      id: "settingsUsers",
      href: "/biz/network/settings/users",
      labelKey: "network.nav.settingsUsers",
      permission: "network.manage",
    },
    {
      id: "settingsPlans",
      href: "/biz/network/settings/plans",
      labelKey: "network.nav.settingsPlans",
      permission: "network.manage",
    },
    {
      id: "settingsFields",
      href: "/biz/network/settings/fields",
      labelKey: "network.nav.settingsFields",
      permission: "network.manage",
    },
  ],
};
