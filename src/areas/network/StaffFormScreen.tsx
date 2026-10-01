"use client";

/**
 * /biz/network/staff/new и /biz/network/staff/[staffId] — форма сетевого сотрудника (F-11-098, F-11-099, F-11-101).
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Undo2, UserX } from "lucide-react";
import {
  getNetworkStaffMember,
  listNetworkLocations,
  saveNetworkStaffMember,
  setNetworkStaffLifecycle,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { PhoneInput } from "@/ui/PhoneInput";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { Textarea } from "@/ui/Textarea";
import { useConfirm, useToast } from "@/ui/Toast";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function StaffFormScreen() {
  const t = useT("network");
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const params = useParams<{ staffId?: string }>();
  const isNew = !params.staffId || params.staffId === "new";
  const key = isNew ? undefined : decodeURIComponent(params.staffId!);
  const { ready, networkId, isError, refetch } = useNetwork();

  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const detailQ = useApiQuery(
    ["network", "staffMember", networkId, key],
    () => getNetworkStaffMember(networkId!, key!),
    { enabled: ready && Boolean(networkId) && !isNew },
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [bio, setBio] = useState("");
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [filled, setFilled] = useState(false);

  if (detailQ.data && !filled) {
    const s = detailQ.data.staff;
    setName(s.name);
    setPhone(s.phone);
    setEmail(s.email ?? "");
    setPosition(s.position?.ru ?? "");
    setBio(s.bio?.ru ?? "");
    setBusinessIds(detailQ.data.businessIds);
    setFilled(true);
  }

  const mutation = useApiMutation((_: void) =>
    saveNetworkStaffMember(networkId!, {
      key,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      position: position.trim() ? { ru: position.trim() } : undefined,
      bio: bio.trim() ? { ru: bio.trim() } : undefined,
      businessIds,
    }),
  );
  const lifecycleMutation = useApiMutation(
    (action: "fire" | "delete" | "restore" | "reinstate") =>
      setNetworkStaffLifecycle(networkId!, key!, action),
  );

  if (isError || detailQ.isError)
    return (
      <ErrorState onRetry={() => (isError ? refetch() : detailQ.refetch())} />
    );

  const loading = !ready || locationsQ.isLoading || (!isNew && detailQ.isLoading);
  const status = detailQ.data?.staff.status;

  const save = async () => {
    if (!name.trim()) {
      setError(t("staff.form.nameRequired"));
      return;
    }
    if (!phone.trim()) {
      setError(t("staff.form.phoneRequired"));
      return;
    }
    if (!businessIds.length) {
      setError(t("staff.form.locationsRequired"));
      return;
    }
    try {
      await mutation.mutate();
      toast.success(isNew ? t("staff.form.created") : t("staff.form.saved"));
      router.push("/biz/network/staff");
    } catch {
      toast.error(t("staff.form.saveFailed"));
    }
  };

  const doLifecycle = async (action: "fire" | "delete" | "restore" | "reinstate") => {
    if (action === "fire") {
      const ok = await confirm({
        title: t("staff.fireConfirmTitle"),
        description: t("staff.fireConfirmBody"),
        tone: "danger",
        confirmLabel: t("staff.menuFire"),
      });
      if (!ok) return;
    }
    if (action === "delete") {
      const ok = await confirm({
        title: t("staff.deleteConfirmTitle"),
        description: t("staff.deleteConfirmBody"),
        tone: "danger",
        confirmLabel: t("staff.menuDelete"),
      });
      if (!ok) return;
    }
    try {
      await lifecycleMutation.mutate(action);
      toast.success(
        action === "fire"
          ? t("staff.fireDone")
          : action === "delete"
            ? t("staff.deleteDone")
            : t("staff.restoreDone"),
      );
      detailQ.refetch();
    } catch {
      toast.error(t("staff.actionFailed"));
    }
  };

  return (
    <div
      data-f="F-11-098 F-11-099"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24"
    >
      <PageHeader
        title={isNew ? t("staff.form.newTitle") : t("staff.form.editTitle")}
        description={t("staff.form.subtitle")}
        actions={
          status === "fired" || status === "disabled" ? (
            <Badge tone={status === "disabled" ? "neutral" : "warning"} size="sm">
              {status === "disabled" ? t("staff.statusDeleted") : t("staff.firedFired")}
            </Badge>
          ) : undefined
        }
      />
      {loading ? (
        <Skeleton lines={8} />
      ) : (
        <>
          <SectionCard title={t("staff.form.mainTitle")}>
            <div className="flex flex-col gap-4">
              <FormField label={t("staff.form.nameLabel")} required error={error}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </FormField>
              <FormField label={t("staff.form.phoneLabel")} required>
                <PhoneInput value={phone} onValueChange={setPhone} />
              </FormField>
              <FormField label={t("staff.form.emailLabel")} optional>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </FormField>
              <FormField label={t("staff.form.positionLabel")} optional>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              </FormField>
              <FormField label={t("staff.form.bioLabel")} optional>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title={t("staff.form.locationsTitle")}
            description={t("staff.form.locationsHint")}
          >
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={businessIds}
              onChange={setBusinessIds}
            />
          </SectionCard>

          {!isNew && (
            <div data-f="F-11-101">
            <SectionCard title={t("staff.menuEdit")}>
              <div className="flex flex-wrap gap-2">
                {status !== "fired" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<UserX aria-hidden />}
                    onClick={() => doLifecycle("fire")}
                  >
                    {t("staff.menuFire")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Undo2 aria-hidden />}
                    onClick={() => doLifecycle("reinstate")}
                  >
                    {t("staff.menuReinstate")}
                  </Button>
                )}
                {status !== "disabled" ? (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 aria-hidden />}
                    onClick={() => doLifecycle("delete")}
                  >
                    {t("staff.menuDelete")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Undo2 aria-hidden />}
                    onClick={() => doLifecycle("restore")}
                  >
                    {t("staff.menuRestore")}
                  </Button>
                )}
              </div>
            </SectionCard>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              {t("staff.form.cancel")}
            </Button>
            <Button loading={mutation.isPending} onClick={save}>
              {t("staff.form.save")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
