"use client";

import { Copy } from "lucide-react";
import { IconButton } from "@/ui/IconButton";

/** Строка «Логин / Пароль» с копированием — окно выдачи пароля администратору (F-00-038) */
export function CredentialRow({ label, value, copyLabel, onCopy }: { label: string; value: string; copyLabel: string; onCopy: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-muted">{label}</span>
        <span className="break-all font-mono text-base text-fg">{value}</span>
      </div>
      <IconButton icon={<Copy aria-hidden />} label={copyLabel} onClick={() => onCopy(value)} />
    </div>
  );
}
