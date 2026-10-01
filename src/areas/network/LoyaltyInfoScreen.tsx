"use client";

/**
 * /biz/network/loyalty — «Лояльность, счета клиентов и онлайн-продажи» сети (F-11-135, F-11-136): сводит в
 * одно место ссылки на страницы раздела loyalty/finance, настроенные на эту сеть, и объясняет то, что
 * относится именно к сети (F-11-137…F-11-145, F-11-125). Сами программы строит и хранит раздел loyalty —
 * здесь только навигация и правила (просьба о хосте карточки клиента сети — qa/requests/network.md).
 */
import {
  ArrowUpRight,
  Award,
  Banknote,
  Bell,
  CreditCard,
  Gift,
  Landmark,
  MapPinned,
  Percent,
  Repeat,
  ShoppingCart,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/useT";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";

const PAGES = [
  { key: "cardTypes", icon: CreditCard, href: "/biz/loyalty" },
  { key: "cards", icon: CreditCard, href: "/biz/loyalty" },
  { key: "promotions", icon: Percent, href: "/biz/loyalty/promotions" },
  { key: "transactions", icon: Repeat, href: "/biz/loyalty" },
  { key: "referral", icon: Users, href: "/biz/loyalty/referral" },
  { key: "certTypes", icon: Gift, href: "/biz/loyalty/certificates" },
  { key: "certs", icon: Gift, href: "/biz/loyalty/certificates" },
  { key: "membershipTypes", icon: Ticket, href: "/biz/loyalty/memberships" },
  { key: "memberships", icon: Ticket, href: "/biz/loyalty/memberships" },
  { key: "depositTypes", icon: Landmark, href: "/biz/loyalty/deposits" },
  { key: "deposits", icon: Landmark, href: "/biz/loyalty/deposits" },
  { key: "onlineSales", icon: ShoppingCart, href: "/biz/finance" },
] as const;

const INFO_CARDS = [
  { id: "F-11-137", icon: MapPinned, key: "locations" },
  { id: "F-11-138", icon: Repeat, key: "source" },
  { id: "F-11-139", icon: Ticket, key: "crossLocation" },
  { id: "F-11-140", icon: Award, key: "filters" },
  { id: "F-11-141 F-11-136", icon: Landmark, key: "accounts" },
  { id: "F-11-142 F-11-125", icon: ShoppingCart, key: "onlineSales" },
  { id: "F-11-125", icon: ShoppingCart, key: "saleButton" },
  { id: "F-11-143", icon: Banknote, key: "paymentAccount" },
  { id: "F-11-144", icon: ShoppingCart, key: "catalog" },
  { id: "F-11-145", icon: CreditCard, key: "legacy" },
  { id: "F-11-061", icon: Bell, key: "notifications" },
  { id: "F-11-096", icon: Sparkles, key: "networkOnly" },
] as const;

export function LoyaltyInfoScreen() {
  const t = useT("network");

  return (
    <div
      data-f="F-11-135 F-11-136 F-11-125 F-11-137 F-11-138 F-11-139 F-11-140 F-11-141 F-11-142 F-11-143 F-11-144 F-11-145 F-11-061 F-11-096"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("loyaltyInfo.title")}
        description={t("loyaltyInfo.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.overview.title"
            bodyKey="help.overview.body"
          />
        }
      />

      <SectionCard
        title={t("loyaltyInfo.pagesTitle")}
        description={t("loyaltyInfo.pagesSubtitle")}
      >
        <ul className="flex flex-col gap-2">
          {PAGES.map(({ key, icon: Icon, href }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-accent hover:bg-surface-2"
              >
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {t(`loyaltyInfo.pages.${key}` as const)}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {t(`loyaltyInfo.pages.${key}Desc` as const)}
                  </p>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      {INFO_CARDS.map(({ id, icon: Icon, key }) => (
        <div
          key={key}
          data-f={id}
          className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg"
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <div>
            <p className="font-medium">
              {t(`loyaltyInfo.${key}Title` as const)}
            </p>
            <p className="mt-1 text-muted">
              {t(`loyaltyInfo.${key}Body` as const)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
