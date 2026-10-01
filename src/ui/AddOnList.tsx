"use client";

import type { ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { SkeletonText } from "@/ui/Skeleton";

export interface AddOnItem {
  id: string;
  /** «Дизайн» */
  title: ReactNode;
  /** «15 мин · 3 000 ֏» или «Товар · 4 500 ֏» */
  meta: ReactNode;
  selected: boolean;
  /** Взять нельзя (закончился, не помещается) — строка видна приглушённой с причиной в meta */
  disabled?: boolean;
  icon?: ReactNode;
}

export interface AddOnListProps {
  items: AddOnItem[];
  onToggle: (id: string) => void;
  /** Строки-скелетоны на месте списка, пока предложения считаются */
  loading?: boolean;
  loadingRows?: number;
  /** Плотный вид (окно записи администратора): строки 44 px, кнопка-иконка «+», название в две строки */
  compact?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * ⭐ Допродажа (01.10.2026): короткий список «добавить к визиту» — строка «+ Дизайн · 15 мин · 3 000 ֏» и кнопка
 * в одно касание. Повторное касание снимает. Выбранное видно формой (галочка и слово), а не только цветом.
 */
export function AddOnList({
  items,
  onToggle,
  loading = false,
  loadingRows = 2,
  compact = false,
  className,
  ...rest
}: AddOnListProps) {
  const t = useT("ui");
  if (loading) {
    return (
      <ul
        className={cn("flex flex-col", className)}
        aria-busy="true"
        aria-label={rest["aria-label"]}
      >
        {Array.from({ length: loadingRows }, (_, i) => (
          <li
            key={i}
            className={cn(
              "flex items-center gap-3 border-b border-border last:border-b-0",
              compact ? "min-h-11 py-1.5" : "min-h-16 py-2.5",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium">
                <SkeletonText width="12ch" />
              </p>
              <p className="text-xs">
                <SkeletonText width="16ch" />
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled
              leftIcon={<Plus aria-hidden />}
            >
              {t("addOn.add")}
            </Button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul
      className={cn("flex flex-col", className)}
      aria-label={rest["aria-label"]}
    >
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex items-center gap-3 border-b border-border last:border-b-0",
            compact ? "min-h-11 py-1.5" : "min-h-16 py-2.5",
            item.disabled && "opacity-60",
          )}
        >
          {item.icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted [&_svg]:size-4">
              {item.icon}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <p
              className={cn(
                "text-sm font-medium text-fg",
                compact ? "line-clamp-2" : "truncate",
              )}
            >
              {item.title}
            </p>
            <p className="text-xs text-muted tabular-nums">
              {item.meta}
            </p>
          </div>
          {compact ? (
            <IconButton
              variant="secondary"
              icon={
                item.selected ? <Check aria-hidden /> : <Plus aria-hidden />
              }
              label={`${item.selected ? t("addOn.added") : t("addOn.add")}: ${typeof item.title === "string" ? item.title : ""}`}
              aria-pressed={item.selected}
              disabled={item.disabled && !item.selected}
              onClick={() => onToggle(item.id)}
            />
          ) : (
            <Button
              size="sm"
              variant={item.selected ? "outline" : "secondary"}
              disabled={item.disabled && !item.selected}
              aria-pressed={item.selected}
              className={cn(
                "shrink-0",
                item.selected &&
                  "border-primary bg-primary-soft text-primary-text hover:bg-primary-soft",
              )}
              leftIcon={
                item.selected ? <Check aria-hidden /> : <Plus aria-hidden />
              }
              onClick={() => onToggle(item.id)}
            >
              {item.selected ? t("addOn.added") : t("addOn.add")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
