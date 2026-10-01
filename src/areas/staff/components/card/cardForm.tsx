"use client";

/**
 * Одна модель сохранения карточки сотрудника (С2 обзора «Сотрудники», 27.09.2026 — та же, что у раздела «Услуги»,
 * services/components/FormSaveBar): поля формы («Информация», «Дополнительно», «Юр. информация») ждут явного
 * «Сохранить» — полоса внизу показывает, есть ли несохранённое, а уход со страницы спрашивает «Уйти без сохранения?».
 * Мгновенные переключатели на других вкладках сохраняются сами и отвечают тихим «Сохранено ✓» у своей строки.
 *
 * Каждый блок формы сам держит свой черновик и сам себя сохраняет (useCardSection) — так блок грузит свои данные,
 * только когда его раскрыли (М1), и после сохранения перерисовывается только он (М6).
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CircleDot, Save } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { StickyActionBar } from "@/ui/StickyActionBar";

type Saver = () => Promise<void>;

interface CardForm {
  setDirty: (id: string, dirty: boolean) => void;
  savers: Map<string, Saver>;
}

const CardFormContext = createContext<CardForm | null>(null);

/** Хозяин карточки: dirty — есть ли несохранённое хоть в одном блоке; saveAll — сохранить все изменённые блоки */
export function useCardFormHost() {
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [form] = useState<CardForm>(() => ({
    setDirty: (id, dirty) =>
      setDirtyMap((m) => (Boolean(m[id]) === dirty ? m : { ...m, [id]: dirty })),
    savers: new Map<string, Saver>(),
  }));
  const dirty = Object.values(dirtyMap).some(Boolean);
  const saveAll = async () => {
    for (const [id, isDirty] of Object.entries(dirtyMap)) {
      if (!isDirty) continue;
      const save = form.savers.get(id);
      if (save) await save();
    }
  };
  return { form, dirty, saveAll };
}

export function CardFormProvider({ form, children }: { form: CardForm; children: ReactNode }) {
  return <CardFormContext.Provider value={form}>{children}</CardFormContext.Provider>;
}

/** Блок формы сообщает, изменён ли он, и как себя сохранить (бросает ошибку — «Сохранить» покажет, что не вышло) */
export function useCardSection(id: string, dirty: boolean, save: Saver): void {
  const form = useContext(CardFormContext);
  useEffect(() => {
    form?.setDirty(id, dirty);
  }, [form, id, dirty]);
  useEffect(() => {
    form?.savers.set(id, save);
  });
  useEffect(
    () => () => {
      form?.setDirty(id, false);
      form?.savers.delete(id);
    },
    [form, id],
  );
}

/** Полоса внизу карточки: слева — «Уволить»/«Вернуть», по центру — состояние, справа — «Сохранить» */
export function CardSaveBar({
  dirty,
  saving,
  onSave,
  secondary,
  canEdit,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  secondary?: ReactNode;
  canEdit: boolean;
}) {
  const t = useT("staff");
  return (
    <StickyActionBar
      desktop="sticky"
      aria-label={t("cardView.saveBar")}
      summary={
        <span className="flex items-center gap-3">
          {secondary}
          {dirty ? (
            <span data-dirty="" className="flex items-center gap-1.5 text-warning">
              <CircleDot aria-hidden className="size-4 shrink-0" />
              <span className="max-sm:sr-only">{t("cardView.unsaved")}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Check aria-hidden className="size-4 shrink-0 text-success" />
              <span className="max-sm:sr-only">{t("cardView.allSaved")}</span>
            </span>
          )}
        </span>
      }
    >
      {canEdit && (
        <SaveButton dirty={dirty} saving={saving} onSave={onSave} />
      )}
    </StickyActionBar>
  );
}

function SaveButton({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  const t = useT("staff");
  // Крутилка встаёт на место иконки — кнопка не меняет размер (DESIGN.md → Buttons keep their size)
  return (
    <Button leftIcon={<Save aria-hidden />} loading={saving} disabled={!dirty} onClick={onSave}>
      {t("cardView.save")}
    </Button>
  );
}

/** Тихое «Сохранено ✓» у строки мгновенного переключателя — видно 2 секунды */
export function SavedInline({ show }: { show: boolean }) {
  const t = useT("staff");
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-success transition-opacity duration-150",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <Check aria-hidden className="size-3.5" />
      {show ? t("cardView.savedInline") : ""}
    </span>
  );
}

/** Когда показать «Сохранено ✓»: flash() после удачной записи, гаснет само */
export function useSavedFlash(): [boolean, () => void] {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = () => {
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2000);
  };
  return [shown, flash];
}
