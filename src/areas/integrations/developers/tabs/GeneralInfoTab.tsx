"use client";

/** F-13-033: две короткие ссылки — на приложение и на запрос отзыва. F-13-046: проверка черновика на своей
 * локации. F-13-045: «Отключить проверку» шлёт вебхук «отключено» — событие видно в «Публикации». */
import {
  testInstallDevAppAtOwnLocation,
  testUninstallDevAppAtOwnLocation,
} from "@/api/integrations";
import { useApiMutation } from "@/api/request";
import { CopyRow } from "@/areas/integrations/components/CopyRow";
import { useOrigin } from "@/areas/integrations/hooks/useOrigin";
import { useCurrent } from "@/demo/hooks";
import type { DevApp } from "@/domain/integrations";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { SectionCard } from "@/ui/SectionCard";
import { useToast } from "@/ui/Toast";

export function GeneralInfoTab({
  app,
  onChanged,
}: {
  app: DevApp;
  onChanged: () => void;
}) {
  const t = useT("integrations");
  const toast = useToast();
  const { date } = useFormat();
  const { activeLocationIds } = useCurrent();
  const testInstall = useApiMutation((locationId: string) =>
    testInstallDevAppAtOwnLocation(app.id, locationId),
  );
  const testUninstall = useApiMutation(() =>
    testUninstallDevAppAtOwnLocation(app.id),
  );
  const origin = useOrigin();

  const appLink = `${origin}/biz/integrations/e/${app.appCode}`;
  const reviewLink = `${origin}/biz/integrations/apps/${app.appCode}?review=1`;

  const runTest = async () => {
    const locationId = activeLocationIds[0];
    if (!locationId) return;
    try {
      await testInstall.mutate(locationId);
      toast.success(t("developers.general.testConnected"));
      onChanged();
    } catch {
      toast.error(t("errors.actionFailed"));
    }
  };

  const runUninstall = async () => {
    try {
      await testUninstall.mutate(undefined);
      toast.success(t("developers.general.testDisconnectedToast"));
      onChanged();
    } catch {
      toast.error(t("errors.actionFailed"));
    }
  };

  return (
    <div data-f="F-13-033 F-13-046" className="flex flex-col gap-4">
      <SectionCard
        title={t("developers.general.linksTitle")}
        // QA 01.10: у черновика ссылка на отзыв ещё не работает — подпись говорит только о ссылке на приложение
        description={
          app.status === "published"
            ? t("developers.general.linksHint")
            : t("developers.general.linksHintDraft")
        }
      >
        <div className="flex flex-col gap-3">
          <CopyRow
            label={t("developers.general.appLink")}
            value={appLink}
            mono={false}
          />
          {/* Решение владельца 01.10: у черновика отзыв оставить негде — ссылку не даём копировать, только подсказка */}
          {app.status === "published" ? (
            <CopyRow
              label={t("developers.general.reviewLink")}
              value={reviewLink}
              mono={false}
            />
          ) : (
            <div className="flex flex-col gap-0.5 rounded-lg border border-dashed border-border px-3 py-2.5">
              <p className="text-xs text-muted">
                {t("developers.general.reviewLink")}
              </p>
              <p className="text-sm text-muted">
                {t("developers.general.reviewLinkAfterPublish")}
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={t("developers.general.testTitle")}
        description={t("developers.general.testHint")}
      >
        <div className="flex flex-col gap-3">
          {app.testInstalledAt ? (
            <p className="text-sm text-success">
              {t("developers.general.testDone", {
                date: date(app.testInstalledAt),
              })}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {t("developers.general.testPending")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={testInstall.isPending}
              onClick={runTest}
              disabled={!activeLocationIds.length}
              className="self-start"
            >
              {t("developers.general.testCta")}
            </Button>
            {app.testInstalledAt && (
              <Button
                variant="ghost"
                data-f="F-13-045"
                loading={testUninstall.isPending}
                onClick={runUninstall}
                className="self-start"
              >
                {t("developers.general.testDisconnectCta")}
              </Button>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
