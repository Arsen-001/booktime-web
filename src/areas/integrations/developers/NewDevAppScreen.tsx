"use client";

/**
 * /biz/integrations/developers/apps/new — F-13-030 создать приложение (название → латинский ID, категория),
 * F-13-031 «Непубличное приложение». ID можно поправить только сейчас — после создания он больше не меняется.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDevApp, suggestDevAppCode } from "@/api/integrations";
import { ApiError, useApiMutation } from "@/api/request";
import {
  ALL_CATEGORY_IDS,
  type IntegrationCategoryId,
} from "@/domain/integrations";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { PermissionGate } from "@/ui/PermissionGate";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { useToast } from "@/ui/Toast";

export function NewDevAppScreen() {
  const t = useT("integrations");
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [categoryId, setCategoryId] = useState<IntegrationCategoryId>("other");
  const [isPrivate, setIsPrivate] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  // QA 30.09: пустой ID (название из одних знаков «!!!») и занятый ID — ошибка под полем, а не молчание
  const [codeError, setCodeError] = useState<string | undefined>();
  const mutation = useApiMutation(createDevApp);

  const onNameChange = (value: string) => {
    setName(value);
    setCodeError(undefined);
    if (!codeTouched) setCode(suggestDevAppCode(value));
  };

  const submit = async () => {
    const trimmed = name.trim();
    setNameError(trimmed ? undefined : t("developers.newApp.nameRequired"));
    setCodeError(code.trim() ? undefined : t("developers.newApp.codeRequired"));
    if (!trimmed || !code.trim()) return;
    try {
      const app = await mutation.mutate({
        name: trimmed,
        appCode: code.trim(),
        categoryId,
        isPrivate,
      });
      toast.success(t("developers.newApp.created"));
      router.push(`/biz/integrations/developers/apps/${app.id}`);
    } catch (e) {
      if (
        (e instanceof ApiError
          ? e.code
          : e instanceof Error
            ? e.message
            : "") === "code_taken"
      )
        setCodeError(t("developers.newApp.codeTaken"));
      else toast.error(t("errors.actionFailed"));
    }
  };

  // QA 30.09: как и кабинет разработчика (DeveloperHubScreen) — без права integrations.manage форма не показывается
  return (
    <PermissionGate permission="integrations.manage" fallback="message">
      <div
        data-f="F-13-030 F-13-031"
        className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
      >
        <PageHeader
          title={t("developers.newApp.title")}
          description={t("developers.newApp.subtitle")}
          back={{ href: "/biz/integrations/developers" }}
        />

        <SectionCard title={t("developers.newApp.sectionTitle")}>
          <div className="flex flex-col gap-4">
            <FormField
              label={t("developers.newApp.nameLabel")}
              required
              error={nameError}
            >
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                autoFocus
                placeholder={t("developers.newApp.namePlaceholder")}
              />
            </FormField>

            <FormField
              label={t("developers.newApp.codeLabel")}
              hint={t("developers.newApp.codeHint")}
              required
              error={codeError}
            >
              <Input
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(suggestDevAppCode(e.target.value));
                  setCodeError(undefined);
                }}
                className="font-mono"
              />
            </FormField>

            <FormField label={t("developers.newApp.categoryLabel")}>
              <Select
                options={ALL_CATEGORY_IDS.map((id) => ({
                  value: id,
                  label: t(`category.${id}.title` as never),
                }))}
                value={categoryId}
                onValueChange={(v) => setCategoryId(v as IntegrationCategoryId)}
              />
            </FormField>

            <Checkbox
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              label={t("developers.newApp.privateLabel")}
              description={t("developers.newApp.privateHint")}
            />
          </div>
        </SectionCard>

        <Button
          loading={mutation.isPending}
          onClick={submit}
          className="self-start"
        >
          {t("developers.newApp.submit")}
        </Button>
      </div>
    </PermissionGate>
  );
}
