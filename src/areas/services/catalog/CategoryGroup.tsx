'use client';

/**
 * Категория в каталоге (У1, У10, У12): ⠿ — перетащить категорию, галочка — выбрать все её услуги, имя сворачивает,
 * «+ Добавить услугу» ведёт в форму с этой категорией (У19), «⋯» — переименовать прямо здесь, другое название для
 * онлайн-записи (страница категории), удалить. Пустая категория видна с приглашением добавить услугу.
 */
import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, Globe, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { listPriceLockedServiceIds } from '@/api/network';
import { useApiQuery } from '@/api/request';
import type { ServiceRow } from '@/api/services';
import type { ServiceCategory, Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import { SortableRow } from '@/areas/services/catalog/SortableRow';
import type { CatalogActions } from '@/areas/services/catalog/useCatalogActions';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Collapse } from '@/ui/Collapse';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';

export interface CategoryGroupProps {
  category: ServiceCategory;
  rows: ServiceRow[];
  staffList: Staff[];
  selected: Set<string>;
  onSelect: (id: string, on: boolean) => void;
  onSelectMany: (ids: string[], on: boolean) => void;
  canEdit: boolean;
  dragDisabled: boolean;
  table: boolean;
  actions: CatalogActions;
}

function CategoryGroupImpl({
  category,
  rows,
  staffList,
  selected,
  onSelect,
  onSelectMany,
  canEdit,
  dragDisabled,
  table,
  actions,
}: CategoryGroupProps) {
  const t = useT('services');
  const router = useRouter();
  const locale = useLocale() as 'ru' | 'en';
  const [open, setOpen] = useState(true);
  // Сеть4: цена сетевой услуги с запретом (F-11-082) в филиале не правится — один запрос на бизнес (общий ключ)
  const lockedQ = useApiQuery(['network', 'price-locked', category.businessId], () => listPriceLockedServiceIds(category.businessId));
  const lockedIds = lockedQ.data;
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const name = pickText(category.name, locale);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat:${category.id}`,
    disabled: dragDisabled || !canEdit,
  });
  // Список id для SortableContext — по содержимому, а не по новому массиву на каждый рендер: иначе контекст
  // dnd-kit меняется при любой правке и перерисовывает все строки, а не одну изменённую
  const idsKey = rows.map((r) => r.service.id).join(',');
  const ids = idsKey ? idsKey.split(',') : [];
  const picked = ids.filter((id) => selected.has(id)).length;

  const commitRename = () => {
    setRenaming(false);
    const text = draftName.trim();
    if (!text || text === name) return;
    void actions.renameCategory(category.id, {
      ...category.name,
      [locale]: text,
      ru: locale === 'ru' ? text : category.name.ru,
    });
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-category={category.id}
      aria-label={name}
      className={cn('overflow-hidden rounded-2xl border border-border bg-surface', isDragging && 'relative z-20 shadow-lg')}
    >
      <header className="flex min-h-14 items-center gap-1 bg-surface-2/60 py-1.5 pr-1.5 pl-1 sm:gap-2 sm:pl-2">
        {canEdit && !dragDisabled && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t('list.dragCategory', { name })}
            className="-mx-1.5 flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:text-fg sm:-mx-1 sm:w-10"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        )}
        {canEdit && ids.length > 0 && (
          <span className="flex size-10 shrink-0 items-center justify-center">
            <Checkbox
              checked={picked > 0 && picked === ids.length}
              indeterminate={picked > 0 && picked < ids.length}
              onCheckedChange={(on) => onSelectMany(ids, on)}
              aria-label={t('list.selectCategory', { name })}
            />
          </span>
        )}
        {renaming ? (
          <Input
            autoFocus
            size="sm"
            aria-label={t('list.renameCategory')}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            classNames={{ root: 'max-w-sm flex-1' }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left"
          >
            <ChevronDown
              aria-hidden
              className={cn('size-4 shrink-0 text-muted transition-transform duration-150', !open && '-rotate-90')}
            />
            <span className="truncate font-semibold text-fg">{name}</span>
            <Badge tone="neutral" size="sm">
              {rows.length}
            </Badge>
          </button>
        )}
        {canEdit && (
          <LinkButton
            href={`/biz/services/new?categoryId=${category.id}`}
            size="sm"
            variant="ghost"
            leftIcon={<Plus aria-hidden />}
            className="shrink-0 max-sm:min-w-10 max-sm:px-2"
            aria-label={t('list.addServiceTo', { name })}
          >
            <span className="max-sm:sr-only">{t('list.addService')}</span>
          </LinkButton>
        )}
        {canEdit && (
          <DropdownMenu
            label={t('list.categoryActions', { name })}
            trigger={(p) => (
              <IconButton
                {...p}
                size="sm"
                icon={<MoreHorizontal aria-hidden />}
                variant="ghost"
                label={t('list.categoryActions', { name })}
              />
            )}
            items={[
              {
                id: 'rename',
                label: t('list.renameCategory'),
                icon: <Pencil aria-hidden />,
                onSelect: () => {
                  setDraftName(name);
                  setRenaming(true);
                },
              },
              {
                id: 'online',
                label: t('categoryForm.onlineNameToggle'),
                icon: <Globe aria-hidden />,
                href: `/biz/services/categories/${category.id}`,
              },
              {
                id: 'open',
                label: t('list.openCategory'),
                icon: <Pencil aria-hidden />,
                href: `/biz/services/categories/${category.id}`,
              },
              { id: 'sep', separator: true },
              {
                id: 'delete',
                label: t('categoryForm.delete'),
                icon: <Trash2 aria-hidden />,
                danger: true,
                onSelect: () => void actions.deleteCategory(category, rows.length),
              },
            ]}
          />
        )}
      </header>
      <Collapse open={open}>
        {rows.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
            <span>{t('empty.categoryEmpty')}</span>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Plus aria-hidden />}
                onClick={() => router.push(`/biz/services/new?categoryId=${category.id}`)}
              >
                {t('list.addService')}
              </Button>
            )}
          </div>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={dragDisabled}>
            <ul data-f="F-16-028 F-01-193">
              {rows.map((row) => (
                <SortableRow
                  key={row.service.id}
                  id={row.service.id}
                  disabled={dragDisabled || !canEdit}
                  table={table}
                  selected={selected.has(row.service.id)}
                  handleLabel={t('list.dragService', {
                    name: pickText(row.service.name, locale),
                  })}
                  content={{
                    row,
                    staffList,
                    selected: selected.has(row.service.id),
                    onSelect,
                    canEdit,
                    actions,
                    priceLocked: lockedIds?.includes(row.service.id) ?? false,
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        )}
      </Collapse>
    </section>
  );
}

const sameIds = (a: ServiceRow[], b: ServiceRow[]) => a.length === b.length && a.every((r, i) => r === b[i]);

/**
 * memo: правка строки одной категории не перерисовывает остальные категории. Отметки сравниваются только по
 * своим строкам, мастера — по составу.
 */
export const CategoryGroup = memo(CategoryGroupImpl, (a, b) => {
  if (a.category !== b.category || a.canEdit !== b.canEdit || a.dragDisabled !== b.dragDisabled || a.table !== b.table) return false;
  if (a.actions !== b.actions || a.onSelect !== b.onSelect || a.onSelectMany !== b.onSelectMany) return false;
  if (!sameIds(a.rows, b.rows)) return false;
  if (a.staffList !== b.staffList && a.staffList.map((s) => s.id + s.name).join() !== b.staffList.map((s) => s.id + s.name).join())
    return false;
  return a.selected === b.selected || a.rows.every((r) => a.selected.has(r.service.id) === b.selected.has(r.service.id));
});
