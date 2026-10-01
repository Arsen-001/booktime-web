'use client';

/**
 * F-04-133 (🔒 демо — телефонная книга существует только в мобильном приложении, не в вебе) и
 * F-04-107 (раскладка имени/фамилии из контакта): показывает список контактов телефона, галочками
 * выбираются нужные, номер, уже существующий в базе, не создаёт дубль.
 */
import { useMemo, useState } from 'react';
import { BookUser } from 'lucide-react';
import { createClient } from '@/api/clients';
import { useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

interface DemoContact {
  id: string;
  fullName: string;
  /** Раздельные поля — как в реальной телефонной книге (F-04-107) */
  givenName?: string;
  familyName?: string;
  phone: string;
}

const DEMO_CONTACTS: DemoContact[] = [
  {
    id: 'c1',
    givenName: 'Анна',
    familyName: 'Петросян',
    fullName: 'Анна Петросян',
    phone: '37493001122',
  },
  { id: 'c2', fullName: 'Гоар Хачатрян', phone: '37494002233' },
  {
    id: 'c3',
    givenName: 'Давид',
    familyName: 'Оганян',
    fullName: 'Давид Оганян',
    phone: '37495003344',
  },
  { id: 'c4', fullName: 'Тигран Мкртчян', phone: '37496004455' },
];

export function PhoneBookImportModal({
  open,
  onOpenChange,
  businessId,
  existingPhones,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  existingPhones: string[];
  onImported: () => void;
}) {
  const t = useT('clients');
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const create = useApiMutation((input: { businessId: Id; name: string; lastName?: string; phone: string }) => createClient(input));

  const existing = useMemo(() => new Set(existingPhones.map((p) => p.replace(/\D/g, '').slice(-8))), [existingPhones]);
  const isKnown = (phone: string) => existing.has(phone.replace(/\D/g, '').slice(-8));

  const allSelectable = DEMO_CONTACTS.filter((c) => !isKnown(c.phone)).map((c) => c.id);
  const allChecked = allSelectable.length > 0 && allSelectable.every((id) => selected.includes(id));

  const toggleAll = () => setSelected(allChecked ? [] : allSelectable);
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const doImport = async () => {
    let created = 0;
    for (const id of selected) {
      const c = DEMO_CONTACTS.find((x) => x.id === id);
      if (!c) continue;
      // F-04-107: раздельные поля контакта → «Имя» и «Фамилия» отдельно; одно общее поле → всё в «Имя»
      const name = c.givenName ?? c.fullName;
      const lastName = c.givenName ? c.familyName : undefined;
      try {
        await create.mutate({ businessId, name, lastName, phone: c.phone });
        created++;
      } catch {
        // дубль по номеру — пропускаем молча, это ожидаемое поведение (F-04-133)
      }
    }
    toast.success(t('importPage.phoneBook.imported', { count: created }));
    setSelected([]);
    onOpenChange(false);
    onImported();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('importPage.phoneBook.title')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('importPage.phoneBook.cancel')}
          </Button>
          <Button onClick={doImport} disabled={selected.length === 0} loading={create.isPending}>
            {t('importPage.phoneBook.importSelected', {
              count: selected.length,
            })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted">{t('importPage.phoneBook.demoNote')}</p>
        {allSelectable.length === 0 ? (
          <EmptyState icon={<BookUser aria-hidden />} title={t('importPage.phoneBook.emptyTitle')} description={t('importPage.phoneBook.emptyText')} />
        ) : (
          <>
            <label className="flex min-h-11 items-center gap-3 border-b border-border pb-2 text-sm text-fg">
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              {t('importPage.phoneBook.selectAll')}
            </label>
            <ul className="flex flex-col gap-1">
              {DEMO_CONTACTS.map((c) => {
                const known = isKnown(c.phone);
                return (
                  <li key={c.id}>
                    <label className={`flex min-h-11 items-center gap-3 rounded-lg px-1 ${known ? '' : 'cursor-pointer hover:bg-surface-2'}`}>
                      <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} disabled={known} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg">{c.fullName}</p>
                        <p className="text-xs text-muted">+{c.phone}</p>
                      </div>
                      {known && <span className="text-xs text-muted">{t('importPage.phoneBook.alreadyClient')}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
