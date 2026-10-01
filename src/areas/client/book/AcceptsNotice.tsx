'use client';

import { useState } from 'react';
import { UsersRound } from 'lucide-react';
import type { AcceptsWhom, Gender, SphereId } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

/**
 * «Этот мастер принимает только женщин / мужчин» (F-00-069, решено): окно при входе в запись — как в записи по ссылке,
 * с выходом к похожим мастерам. Закрыли — больше не мешает в этой записи.
 */
export function AcceptsNotice({
  accepts,
  sphereId,
  staffName,
  viewerGender,
}: {
  accepts: AcceptsWhom;
  sphereId?: SphereId;
  staffName: string;
  /** Пол вошедшего клиента: подходит мастеру — окно не показываем (женщине у мастера «только женщин» — лишнее, qa 30.09) */
  viewerGender?: Gender;
}) {
  const t = useT('client');
  const fits = (accepts === 'women' && viewerGender === 'female') || (accepts === 'men' && viewerGender === 'male');
  const [open, setOpen] = useState(accepts !== 'all');
  if (accepts === 'all' || fits) return null;
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={t('book.accepts.title')}
      footer={
        <>
          <LinkButton href={`/search${sphereId ? `?sphere=${sphereId}` : ''}`} variant="secondary">
            {t('book.accepts.similar')}
          </LinkButton>
          <Button onClick={() => setOpen(false)}>{t('book.accepts.continue')}</Button>
        </>
      }
    >
      <div data-f="F-00-069" className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <UsersRound className="size-5" />
        </span>
        <p className="text-fg">{t('book.accepts.text', { name: staffName, who: t(`book.accepts.who.${accepts}`) })}</p>
      </div>
    </Modal>
  );
}
