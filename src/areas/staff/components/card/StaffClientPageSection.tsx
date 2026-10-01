"use client";

/**
 * «График и запись» → «Страница мастера для клиента» (С18 обзора «Сотрудники», 27.09.2026): показывать ли рейтинг,
 * фото работ этого мастера (до 6) и откуда берётся описание («О себе» на трёх языках на «Информации»).
 * Мгновенные настройки, как всё на этой вкладке: сохраняются сами, у строки — тихое «Сохранено ✓» (С2).
 */
import { setStaffPhotos } from "@/api/services";
import { getStaffCardSettings, setStaffCardSettings, type StaffCardData } from "@/api/staff";
import { optimistic, useApiMutation, useApiQuery } from "@/api/request";
import { SavedInline, useSavedFlash } from "@/areas/staff/components/card/cardForm";
import type { StaffCardSettings } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { FormField } from "@/ui/FormField";
import { ImageUpload } from "@/ui/ImageUpload";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";

export interface StaffClientPageSectionProps {
  card: StaffCardData;
  canEdit: boolean;
  onOpenInfo: () => void;
}

export function StaffClientPageSection({ card, canEdit, onOpenInfo }: StaffClientPageSectionProps) {
  const t = useT("staff");
  const toast = useToast();
  const { staff } = card;
  const settingsQ = useApiQuery(["staff", "cardSettings", staff.id], () => getStaffCardSettings(staff.id));
  const [ratingSaved, flashRating] = useSavedFlash();
  const [photosSaved, flashPhotos] = useSavedFlash();
  const ratingM = useApiMutation((a: { staffId: string; value: boolean }) => setStaffCardSettings(a.staffId, { showRating: a.value }), {
    optimistic: optimistic<StaffCardSettings, { staffId: string; value: boolean }>(
      (a) => ["staff", "cardSettings", a.staffId],
      (old, a) => ({ ...old, showRating: a.value }),
    ),
  });
  const photosM = useApiMutation((a: { staffId: string; businessId: string; photos: string[] }) => setStaffPhotos(a.staffId, a.businessId, a.photos), {
    optimistic: optimistic<StaffCardData, { staffId: string; photos: string[] }>(
      (a) => ["staff", "card", a.staffId],
      (old, a) => ({ ...old, staff: { ...old.staff, photos: a.photos } }),
    ),
  });

  return (
    <div data-f="F-00-085 F-10-028">
      <SectionCard title={t("cardView.clientPage.title")} description={t("cardView.clientPage.hint")}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            {t("cardView.clientPage.bioNote")}{" "}
            <button type="button" onClick={onOpenInfo} className="font-medium text-primary-text hover:underline">
              {t("cardView.clientPage.openInfo")}
            </button>
          </p>
          <div className="flex min-h-11 items-center justify-between gap-3">
            {settingsQ.data ? (
              <Switch
                checked={settingsQ.data.showRating ?? true}
                disabled={!canEdit}
                onCheckedChange={(value) =>
                  void ratingM.mutate({ staffId: staff.id, value }).then(flashRating, () => toast.error(t("cardView.saveFailed")))
                }
                label={t("cardView.clientPage.showRating")}
                description={t("cardView.clientPage.showRatingHint")}
              />
            ) : (
              <span data-skeleton className="flex items-center gap-3">
                <Skeleton variant="rect" className="h-6 w-11 rounded-full" />
                <Skeleton className="h-4 w-56" />
              </span>
            )}
            <SavedInline show={ratingSaved} />
          </div>
          <FormField label={<span className="flex items-center gap-2">{t("cardView.clientPage.photos")} <SavedInline show={photosSaved} /></span>} hint={t("cardView.clientPage.photosHint")}>
            <ImageUpload
              value={staff.photos}
              onValueChange={(photos) =>
                void photosM
                  .mutate({ staffId: staff.id, businessId: staff.businessId, photos })
                  .then(flashPhotos, () => toast.error(t("cardView.saveFailed")))
              }
              max={6}
              aspect="square"
              disabled={!canEdit}
            />
          </FormField>
        </div>
      </SectionCard>
    </div>
  );
}
