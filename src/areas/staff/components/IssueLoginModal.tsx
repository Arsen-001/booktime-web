"use client";

/**
 * Окно «Логин и пароль для …» / «Новый пароль для …» (F-00-034, F-00-038): владелец задаёт логин и временный пароль
 * (или придумывает его кнопкой), после выдачи то же окно один раз показывает логин и пароль с копированием.
 */
import { useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { StaffLoginError, setStaffLogin } from "@/api/staff";
import { useApiMutation } from "@/api/request";
import { CredentialRow } from "@/areas/staff/components/CredentialRow";
import { STAFF_LOGIN_RE, isWeakStaffPassword, normalizeStaffLogin } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { copyText } from "@/lib/clipboard";
import { translit } from "@/lib/translit";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { useToast } from "@/ui/Toast";

export type IssueLoginMode = "issue" | "reset";
type LoginErrorCode = "login_invalid" | "login_taken" | "weak_password";

/** Без похожих знаков (0/O, 1/l/I): пароль диктуют и переписывают с экрана */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Случайный пароль «k7mq-p4xz-9tnb» — только из обработчика нажатия (не в рендере) */
function generatePassword(): string {
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}

/** Подсказка логина из имени: «Лилит Мкртчян» → «lilit.mkrtchyan» */
function suggestLogin(name: string): string {
  const latin = translit(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return STAFF_LOGIN_RE.test(latin) ? latin : "";
}

export function IssueLoginModal({
  mode,
  staffId,
  staffName,
  currentLogin,
  onClose,
}: {
  mode: IssueLoginMode;
  staffId: string;
  staffName: string;
  currentLogin: string;
  onClose: () => void;
}) {
  const t = useT("staff");
  const tc = useT("common");
  const toast = useToast();
  const [login, setLogin] = useState(() => currentLogin || suggestLogin(staffName));
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ login?: LoginErrorCode; password?: LoginErrorCode }>({});
  // Выдано — то же окно показывает логин и пароль один раз
  const [issued, setIssued] = useState<{ login: string; password: string } | null>(null);
  const save = useApiMutation((input: { login: string; password: string }) => setStaffLogin(staffId, input));

  const submit = async () => {
    const clean = normalizeStaffLogin(login);
    const next: typeof errors = {};
    if (!STAFF_LOGIN_RE.test(clean)) next.login = "login_invalid";
    if (isWeakStaffPassword(password, clean)) next.password = "weak_password";
    setErrors(next);
    if (next.login || next.password) return;
    try {
      await save.mutate({ login: clean, password });
      setIssued({ login: clean, password });
      toast.success(t(mode === "reset" ? "passwordLogin.resetDone" : "passwordLogin.issued"));
    } catch (e) {
      if (e instanceof StaffLoginError) setErrors({ [e.field]: e.code as LoginErrorCode });
      else toast.error(t("toast.actionFailed"));
    }
  };

  const copy = async (text: string) => {
    if (await copyText(text)) toast.success(t("passwordLogin.copied"));
    else toast.error(t("toast.actionFailed"));
  };

  if (issued) {
    const all = t("passwordLogin.copyText", {
      url: `${window.location.origin}/login?next=/biz`,
      login: issued.login,
      password: issued.password,
    });
    return (
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        title={t("passwordLogin.doneTitle")}
        description={t("passwordLogin.doneHint")}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              {t("passwordLogin.done")}
            </Button>
            <Button leftIcon={<Copy aria-hidden />} onClick={() => void copy(all)}>
              {t("passwordLogin.copyAll")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <CredentialRow label={t("passwordLogin.login")} value={issued.login} copyLabel={t("passwordLogin.copyLogin")} onCopy={copy} />
          <CredentialRow label={t("passwordLogin.password")} value={issued.password} copyLabel={t("passwordLogin.copyPassword")} onCopy={copy} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(mode === "reset" ? "passwordLogin.resetTitle" : "passwordLogin.issueTitle", { name: staffName })}
      description={mode === "reset" || currentLogin ? t("passwordLogin.resetHint") : undefined}
      size="sm"
      dismissible={!save.isPending}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {tc("actions.cancel")}
          </Button>
          <Button type="submit" form="issue-login-form" loading={save.isPending}>
            {t(mode === "reset" ? "passwordLogin.submitReset" : "passwordLogin.submitIssue")}
          </Button>
        </div>
      }
    >
      <form
        id="issue-login-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField
          label={t("passwordLogin.login")}
          hint={t("passwordLogin.loginHint")}
          error={errors.login ? t(`passwordLogin.errors.${errors.login}`) : undefined}
        >
          <Input
            value={login}
            onChange={(e) => {
              setLogin(e.target.value);
              setErrors((p) => ({ ...p, login: undefined }));
            }}
            readOnly={mode === "reset"}
            disabled={mode === "reset"}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            invalid={Boolean(errors.login)}
          />
        </FormField>
        <FormField
          label={t("passwordLogin.password")}
          hint={t("passwordLogin.passwordHint")}
          error={errors.password ? t(`passwordLogin.errors.${errors.password}`) : undefined}
        >
          <Input
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((p) => ({ ...p, password: undefined }));
            }}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            invalid={Boolean(errors.password)}
            classNames={{ input: "font-mono" }}
          />
        </FormField>
        <Button
          type="button"
          variant="ghost"
          className="-mt-2 self-start"
          leftIcon={<Sparkles aria-hidden />}
          onClick={() => {
            setPassword(generatePassword());
            setErrors((p) => ({ ...p, password: undefined }));
          }}
        >
          {t("passwordLogin.generate")}
        </Button>
      </form>
    </Modal>
  );
}
