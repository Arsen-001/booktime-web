"use client";

/**
 * Плитка «Расширенные поля» (F-01-049): комментарий (F-01-050), категории записи (F-01-051),
 * цвет записи (F-01-052), свои дополнительные поля (F-01-053). Каждое поле можно закрепить
 * скрепкой в левую зону (F-01-048).
 */
import { useState } from "react";
import { Pin, Plus, X } from "lucide-react";
import type {
  BookingCategoryDef,
  CustomFieldDef,
  CustomFieldValue,
} from "@/domain/journal";
import { useT } from "@/i18n/useT";
import { bookingCategoryLabel } from "@/areas/journal/lib/bookingCategoryLabel";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { ColorPicker } from "@/ui/ColorPicker";
import { DatePicker } from "@/ui/DatePicker";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { Textarea } from "@/ui/Textarea";
import { TimePicker } from "@/ui/TimePicker";

export interface ExpandedFieldsPanelProps {
  title?: string;
  onHide?: () => void;
  comment: string;
  onCommentChange: (value: string) => void;
  commentEditable: boolean;
  categories: BookingCategoryDef[];
  selectedCategoryIds: string[];
  onToggleCategory: (id: string) => void;
  onAddCategory: (name: string, colorIndex: number) => void;
  colorIndex: number | undefined;
  onColorChange: (colorIndex: number) => void;
  customFieldDefs: CustomFieldDef[];
  customFieldValues: Record<string, CustomFieldValue>;
  onCustomFieldChange: (key: string, value: CustomFieldValue) => void;
  invalidCustomFieldKeys?: string[];
  pinnedFields: string[];
  onTogglePin: (fieldKey: string) => void;
}

function PinButton({
  fieldKey,
  pinned,
  onTogglePin,
  label,
}: {
  fieldKey: string;
  pinned: boolean;
  onTogglePin: (k: string) => void;
  label: string;
}) {
  return (
    <IconButton
      icon={<Pin aria-hidden className={cn(pinned && "fill-current")} />}
      label={label}
      size="sm"
      variant="ghost"
      onClick={() => onTogglePin(fieldKey)}
      className={pinned ? "text-danger" : "text-muted"}
    />
  );
}

export function ExpandedFieldsPanel({
  title,
  onHide,
  comment,
  onCommentChange,
  commentEditable,
  categories,
  selectedCategoryIds,
  onToggleCategory,
  onAddCategory,
  colorIndex,
  onColorChange,
  customFieldDefs,
  customFieldValues,
  onCustomFieldChange,
  invalidCustomFieldKeys = [],
  pinnedFields,
  onTogglePin,
}: ExpandedFieldsPanelProps) {
  const t = useT("journal");
  const tc = useT("common");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const isPinned = (key: string) => pinnedFields.includes(key);
  // Поле, закреплённое скрепкой, уже нарисовано выше — в левой зоне (F-01-047…049): его редактор
  // не дублируется здесь, иначе пользователь видит и правит один и тот же комментарий/категории/цвет
  // в двух местах окна одновременно.
  const visibleCustomFieldDefs = customFieldDefs.filter(
    (def) => !isPinned(`custom:${def.key}`),
  );
  const allFieldsPinned =
    isPinned("comment") &&
    isPinned("categories") &&
    isPinned("color") &&
    customFieldDefs.every((def) => isPinned(`custom:${def.key}`));

  return (
    <div data-f="F-01-049" className="flex flex-col gap-5">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-fg">{title}</h3>
          {onHide && (
            <Button type="button" variant="ghost" size="sm" onClick={onHide}>
              {t("window.left.expandedTileHide")}
            </Button>
          )}
        </div>
      )}

      {allFieldsPinned && (
        <p className="text-sm text-muted">{t("window.expanded.allPinned")}</p>
      )}

      {!isPinned("comment") && (
        <div data-f="F-01-050" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fg">
              {t("window.comment")}
            </span>
            <PinButton
              fieldKey="comment"
              pinned={isPinned("comment")}
              onTogglePin={onTogglePin}
              label={
                isPinned("comment")
                  ? t("window.left.unpin")
                  : t("window.left.pin")
              }
            />
          </div>
          <Textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows={2}
            readOnly={!commentEditable}
          />
        </div>
      )}

      {!isPinned("categories") && (
        <div data-f="F-01-051" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fg">
              {t("window.expanded.categories")}
            </span>
            <PinButton
              fieldKey="categories"
              pinned={isPinned("categories")}
              onTogglePin={onTogglePin}
              label={
                isPinned("categories")
                  ? t("window.left.unpin")
                  : t("window.left.pin")
              }
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Chip
                key={c.id}
                selected={selectedCategoryIds.includes(c.id)}
                onClick={() => onToggleCategory(c.id)}
              >
                {bookingCategoryLabel(t, c)}
              </Chip>
            ))}
            {addingCategory ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("window.expanded.categoryNamePlaceholder")}
                  className="!min-h-10 w-40"
                />
                <IconButton
                  icon={<Plus aria-hidden />}
                  label={tc("actions.add")}
                  size="sm"
                  variant="secondary"
                  disabled={!newCategoryName.trim()}
                  onClick={() => {
                    onAddCategory(newCategoryName.trim(), 6);
                    setNewCategoryName("");
                    setAddingCategory(false);
                  }}
                />
                <IconButton
                  icon={<X aria-hidden />}
                  label={tc("actions.cancel")}
                  size="sm"
                  onClick={() => setAddingCategory(false)}
                />
              </div>
            ) : (
              <Chip
                icon={<Plus aria-hidden className="size-3.5" />}
                onClick={() => setAddingCategory(true)}
              >
                {t("window.expanded.categoriesAddNew")}
              </Chip>
            )}
          </div>
        </div>
      )}

      {!isPinned("color") && (
        <div data-f="F-01-052" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-fg">
              {t("window.expanded.color")}
            </span>
            <PinButton
              fieldKey="color"
              pinned={isPinned("color")}
              onTogglePin={onTogglePin}
              label={
                isPinned("color")
                  ? t("window.left.unpin")
                  : t("window.left.pin")
              }
            />
          </div>
          <ColorPicker value={colorIndex} onValueChange={onColorChange} />
        </div>
      )}

      {visibleCustomFieldDefs.length > 0 && (
        <div data-f="F-01-053" className="flex flex-col gap-4">
          <span className="text-sm font-medium text-fg">
            {t("window.expanded.customFields")}
          </span>
          {visibleCustomFieldDefs.map((def) => {
            const key = `custom:${def.key}`;
            const value = customFieldValues[def.key] ?? "";
            const invalid = invalidCustomFieldKeys.includes(def.key);
            return (
              <div key={def.id} data-custom-field={def.key} className="flex scroll-mt-4 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-fg">
                    {def.label}
                    {(def.requiredOnCreate || def.requiredOnArrived) && (
                      <span className="ml-1 text-danger">*</span>
                    )}
                  </span>
                  {def.editableByUser && (
                    <PinButton
                      fieldKey={key}
                      pinned={isPinned(key)}
                      onTogglePin={onTogglePin}
                      label={
                        isPinned(key)
                          ? t("window.left.unpin")
                          : t("window.left.pin")
                      }
                    />
                  )}
                </div>
                {def.type === "text" && (
                  <Input
                    value={String(value)}
                    disabled={!def.editableByUser}
                    invalid={invalid}
                    onChange={(e) =>
                      onCustomFieldChange(def.key, e.target.value)
                    }
                  />
                )}
                {def.type === "number" && (
                  <Input
                    type="number"
                    value={value === "" ? "" : Number(value)}
                    disabled={!def.editableByUser}
                    invalid={invalid}
                    onChange={(e) =>
                      onCustomFieldChange(
                        def.key,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                )}
                {def.type === "select" && (
                  <Select
                    value={String(value)}
                    onValueChange={(v) => onCustomFieldChange(def.key, v)}
                    placeholder={t(
                      "window.expanded.customFieldSelectPlaceholder",
                    )}
                    invalid={invalid}
                    options={(def.options ?? []).map((o) => ({
                      value: o,
                      label: o,
                    }))}
                  />
                )}
                {def.type === "date" && (
                  <DatePicker
                    value={value ? String(value) : null}
                    onValueChange={(d) => onCustomFieldChange(def.key, d)}
                    invalid={invalid}
                    clearable
                  />
                )}
                {def.type === "datetime" && (
                  <div className="flex gap-2">
                    <DatePicker
                      value={value ? String(value).slice(0, 10) : null}
                      onValueChange={(d) =>
                        onCustomFieldChange(
                          def.key,
                          d
                            ? `${d}T${String(value).slice(11, 16) || "00:00"}`
                            : null,
                        )
                      }
                      invalid={invalid}
                      clearable
                    />
                    <TimePicker
                      value={value ? String(value).slice(11, 16) : ""}
                      onValueChange={(time) =>
                        onCustomFieldChange(
                          def.key,
                          `${String(value).slice(0, 10) || ""}T${time}`,
                        )
                      }
                    />
                  </div>
                )}
                {invalid && (
                  <span className="text-xs text-danger">
                    {t("window.expanded.customFieldRequired")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
