"use client";

/**
 * F-01-060 · Товар в визите. F-01-211 · абонемент/сертификат внутри визита — то же тело, но
 * количество заблокировано и есть поле «Код» с генерацией.
 */
import { RefreshCw, Trash2 } from "lucide-react";
import type { Staff } from "@/domain/core";
import { useCan } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { newId } from "@/lib/id";
import type { UiGoodsLine } from "@/areas/journal/lib/lineTotals";
import { goodsLineTotal } from "@/areas/journal/lib/lineTotals";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { MoneyInput } from "@/ui/MoneyInput";
import { Select } from "@/ui/Select";

export interface GoodsLineRowProps {
  line: UiGoodsLine;
  staffOptions: Staff[];
  requiresCode: boolean;
  onChange: (patch: Partial<UiGoodsLine>) => void;
  onRemove: () => void;
}

export function GoodsLineRow({
  line,
  staffOptions,
  requiresCode,
  onChange,
  onRemove,
}: GoodsLineRowProps) {
  const t = useT("journal");
  const canEditPrice = useCan("journal.edit");
  const total = goodsLineTotal(line);

  return (
    // @container: колонки считаются от ширины окна записи, а не экрана (как в ServiceLineRow)
    <div className="@container flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-medium text-fg">{line.name}</p>
        <IconButton
          data-f="F-01-213"
          icon={<Trash2 aria-hidden />}
          label={t("window.goodsLine.remove")}
          size="sm"
          onClick={onRemove}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 @md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.qty")}
          </span>
          <Input
            type="number"
            min={1}
            value={line.qty}
            disabled={line.qtyLocked}
            title={line.qtyLocked ? t("window.goodsLine.qtyLocked") : undefined}
            onChange={(e) =>
              onChange({ qty: Math.max(1, Number(e.target.value)) })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.price")}
          </span>
          <MoneyInput
            min={0}
            value={line.unitPrice}
            disabled={!canEditPrice}
            onValueChange={(v) => onChange({ unitPrice: Math.max(0, v ?? 0) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.discount")}
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            value={line.discountPct}
            disabled={!canEditPrice}
            onChange={(e) =>
              onChange({
                discountPct: Math.min(100, Math.max(0, Number(e.target.value))),
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.serviceLine.total")}
          </span>
          <MoneyInput value={total} disabled readOnly />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.goodsLine.seller")}
          </span>
          <Select
            value={line.sellerId}
            onValueChange={(v) => onChange({ sellerId: v })}
            options={staffOptions.map((s) => ({ value: s.id, label: s.name }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("window.goodsLine.warehouse")}
          </span>
          <Input
            value={t("window.goodsLine.warehouseDefault")}
            disabled
            readOnly
          />
        </label>
      </div>

      {requiresCode && (
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-muted">
              {t("window.goodsLine.code")}
            </span>
            <Input
              value={line.code ?? ""}
              placeholder={t("window.goodsLine.codePlaceholder")}
              onChange={(e) => onChange({ code: e.target.value })}
            />
          </label>
          <IconButton
            icon={<RefreshCw aria-hidden />}
            label={t("window.goodsLine.codeGenerate")}
            variant="outline"
            onClick={() =>
              onChange({ code: newId("code").slice(-6).toUpperCase() })
            }
          />
        </div>
      )}
    </div>
  );
}
