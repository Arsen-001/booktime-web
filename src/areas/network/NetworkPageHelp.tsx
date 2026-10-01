"use client";

/**
 * «i» у заголовка страницы сети (F-11-004): открывает нашу модалку со статьёй справки именно этой страницы.
 * Рядом — «Связаться с нами»: тоже наше окно (форма обращения), не внешняя ссылка.
 */
import { useState, type ReactNode } from "react";
import { CircleHelp, LifeBuoy } from "lucide-react";
import { useT } from "@/i18n/useT";
import { IconButton } from "@/ui/IconButton";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";

type NetworkMessageKey = Parameters<ReturnType<typeof useT<"network">>>[0];

export function NetworkHelpButton({
  titleKey,
  bodyKey,
}: {
  titleKey: NetworkMessageKey;
  bodyKey: NetworkMessageKey;
}) {
  const t = useT("network");
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        icon={<CircleHelp aria-hidden />}
        variant="ghost"
        label={t("help.buttonLabel")}
        onClick={() => setOpen(true)}
      />
      <Modal open={open} onOpenChange={setOpen} title={t(titleKey)} size="sm">
        <p className="text-sm leading-relaxed whitespace-pre-line text-fg">
          {t(bodyKey)}
        </p>
      </Modal>
    </>
  );
}

export function NetworkContactSupportButton() {
  const t = useT("network");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  const send = async () => {
    setPending(true);
    await new Promise((r) => setTimeout(r, 400));
    setPending(false);
    setOpen(false);
    setText("");
    toast.success(t("help.supportSent"));
  };

  return (
    <>
      {/* Иконка, не кнопка с текстом: с длинным заголовком (F-11-094, «Подразделения») три подписанные
          кнопки в шапке не помещались в max-w-2xl и давили на заголовок — текст обрезался под кнопкой */}
      <IconButton
        icon={<LifeBuoy aria-hidden />}
        variant="ghost"
        label={t("help.contactSupport")}
        onClick={() => setOpen(true)}
      />
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("help.contactSupport")}
        size="sm"
        footer={
          <Button
            loading={pending}
            disabled={!text.trim()}
            onClick={send}
            className="w-full"
          >
            {t("help.sendMessage")}
          </Button>
        }
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("help.supportPlaceholder")}
          rows={4}
          autoFocus
        />
      </Modal>
    </>
  );
}

export function NetworkPageActions({
  titleKey,
  bodyKey,
  extra,
}: {
  titleKey: NetworkMessageKey;
  bodyKey: NetworkMessageKey;
  extra?: ReactNode;
}) {
  return (
    // flex-wrap: на узкой шапке (длинный заголовок + 3 кнопки в max-w-2xl) кнопки переносятся строкой,
    // а не давят на заголовок — F-11-094, буква «я» пряталась под «Добавить подразделение» (desktop 1440×900)
    <div className="flex flex-wrap items-center justify-end gap-1">
      {extra}
      <NetworkContactSupportButton />
      <NetworkHelpButton titleKey={titleKey} bodyKey={bodyKey} />
    </div>
  );
}
