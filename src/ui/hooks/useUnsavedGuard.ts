'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { useConfirm } from '@/ui/Toast';

export interface UnsavedGuardOptions {
  /**
   * Закрытие вкладки и перезагрузка. Браузер НЕ даёт показать там свой диалог — только собственное окно
   * «Покинуть сайт?». По умолчанию включено: лучше системный вопрос, чем молча потерянная форма. false — когда
   * черновик и так сохраняется (sessionStorage), и терять нечего.
   */
  beforeUnload?: boolean;
}

/**
 * Защита несохранённой формы НАШИМ диалогом (ConfirmDialog), а не системным:
 *
 *   const { confirmLeave } = useUnsavedGuard(form.formState.isDirty);
 *   // закрыть шторку с формой:  onOpenChange={async (o) => { if (!o && !(await confirmLeave())) return; setOpen(o); }}
 *
 * Что перехватывается: переходы по ссылкам внутри приложения (меню, «Назад», карточки — любые <a href>): пока
 * `dirty`, сначала вопрос «Уйти без сохранения?», по «Уйти» — переход. Кнопка «Назад» браузера не перехватывается
 * (Next.js не даёт её остановить надёжно) — для длинных форм держите черновик в sessionStorage.
 */
export function useUnsavedGuard(dirty: boolean, { beforeUnload = true }: UnsavedGuardOptions = {}) {
  const t = useT('ui');
  const confirm = useConfirm();
  const router = useRouter();
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const ask = () =>
    confirm({
      title: t('unsaved.title'),
      description: t('unsaved.text'),
      confirmLabel: t('unsaved.leave'),
      cancelLabel: t('unsaved.stay'),
      tone: 'danger',
    });

  /** Спросить перед закрытием формы (шторка, окно, «Отмена»). Нет изменений — сразу true */
  const confirmLeave = async (): Promise<boolean> => (dirtyRef.current ? ask() : true);

  // Ссылки внутри приложения: ловим клик раньше next/link (фаза захвата на document)
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Якорь на этой же странице — не уход
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      void ask().then((ok) => {
        if (!ok) return;
        dirtyRef.current = false;
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // ask/router стабильны по смыслу; подписка — только пока есть изменения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  // Закрытие вкладки / перезагрузка — только системный вопрос браузера (свой показать нельзя)
  useEffect(() => {
    if (!dirty || !beforeUnload) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, beforeUnload]);

  return { confirmLeave };
}
