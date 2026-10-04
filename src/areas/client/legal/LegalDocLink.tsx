'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useNativeApp } from '@/lib/native/useNativeApp';

type DocKind = 'terms' | 'privacy';

/**
 * Ссылка на пользовательское соглашение (/terms) или политику конфиденциальности (/privacy) из строки согласия.
 * В браузере — в новой вкладке, чтобы не потерять заполненную форму; в нашем приложении — в том же окне
 * (новая вкладка WebView там не открывается), назад — кнопкой «Назад».
 */
export function LegalDocLink({ kind, children }: { kind: DocKind; children: ReactNode }) {
  const localize = useLocalizedHref();
  const native = useNativeApp();
  return (
    <Link
      href={localize(`/${kind}`)}
      target={native ? undefined : '_blank'}
      rel={native ? undefined : 'noopener noreferrer'}
      className="font-medium text-accent underline underline-offset-2 hover:no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

/** Теги для t.rich: «… <terms>соглашение</terms> и <privacy>обработку данных</privacy>» */
export const legalLinkTags = {
  terms: (chunks: ReactNode) => <LegalDocLink kind="terms">{chunks}</LegalDocLink>,
  privacy: (chunks: ReactNode) => <LegalDocLink kind="privacy">{chunks}</LegalDocLink>,
};
