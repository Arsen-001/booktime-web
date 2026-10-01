"use client";

/** F-01-011: сводка дня (касса за день) — кнопка в шапке с суммой поступлений, попап с 7 строками. */
import type { Id, ISODate } from "@/domain/core";
import { getDaySummary } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { Button } from "@/ui/Button";
import { Popover } from "@/ui/Popover";
import { Skeleton } from "@/ui/Skeleton";
import { Tooltip } from "@/ui/Tooltip";
import { Info } from "lucide-react";

export interface DaySummaryButtonProps {
  businessId: Id;
  date: ISODate;
}

export function DaySummaryButton({ businessId, date }: DaySummaryButtonProps) {
  const t = useT("journal");
  const format = useFormat();
  const query = useApiQuery(
    ["journal", "day-summary", businessId, date],
    () => getDaySummary(businessId, date),
    {},
  );

  const rows: { key: string; value: number; hintKey: string }[] = query.data
    ? [
        { key: "cashIn", value: query.data.cashIn, hintKey: "cashInHint" },
        { key: "cash", value: query.data.cash, hintKey: "cashHint" },
        {
          key: "cashless",
          value: query.data.cashless,
          hintKey: "cashlessHint",
        },
        {
          key: "doneTotal",
          value: query.data.doneTotal,
          hintKey: "doneTotalHint",
        },
        {
          key: "bookedTotal",
          value: query.data.bookedTotal,
          hintKey: "bookedTotalHint",
        },
        {
          key: "loyaltyTotal",
          value: query.data.loyaltyTotal,
          hintKey: "loyaltyTotalHint",
        },
        {
          key: "goodsTotal",
          value: query.data.goodsTotal,
          hintKey: "goodsTotalHint",
        },
      ]
    : [];

  return (
    <Popover
      align="end"
      label={t("header.daySummary.title")}
      trigger={(p) => (
        <Button
          {...p}
          type="button"
          variant="outline"
          size="sm"
          data-f="F-01-011"
        >
          {query.data ? format.money(query.data.cashIn) : "…"}
        </Button>
      )}
    >
      <div className="flex w-72 flex-col gap-2.5 p-2">
        {/* F-06-075: строка «loyaltyTotal» ниже — fids.mjs не разбирает тернарник в data-f по key, статичная метка рядом */}
        <span hidden data-f="F-06-075" />
        <p className="px-1 text-sm font-semibold text-fg">
          {format.date(date, "long")} · {query.data?.clientsCount ?? 0}{" "}
          {t("header.daySummary.clientsSuffix")}
        </p>
        {query.isLoading ? (
          <Skeleton lines={5} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <li
                key={row.key}
                data-f={row.key === "loyaltyTotal" ? "F-06-075" : undefined}
                className="flex items-center justify-between gap-2 px-1 text-sm"
              >
                <span className="flex items-center gap-1 text-muted">
                  {t(`header.daySummary.rows.${row.key}` as never)}
                  <Tooltip
                    content={t(
                      `header.daySummary.hints.${row.hintKey}` as never,
                    )}
                  >
                    <Info aria-hidden className="size-3.5" />
                  </Tooltip>
                </span>
                <span className="font-medium text-fg">
                  {format.money(row.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Popover>
  );
}
