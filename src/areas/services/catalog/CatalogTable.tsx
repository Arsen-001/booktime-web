'use client';

/**
 * Каталог по категориям (У5, У10): на широком экране — плотная таблица во всю ширину с правкой в строке, уже —
 * компактные строки. Перетаскивание категорий и услуг внутри категории (⠿) — только без поиска и фильтров, иначе
 * порядок «дырявого» списка было бы не с чем сравнить. Список — только CSS, без анимаций на строках (DESIGN.md).
 */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ServiceRow } from '@/api/services';
import type { ServiceCategory, Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { CategoryGroup } from '@/areas/services/catalog/CategoryGroup';
import { CATALOG_GRID } from '@/areas/services/catalog/grid';
import type { CatalogActions } from '@/areas/services/catalog/useCatalogActions';

export interface CatalogGroup {
  category: ServiceCategory;
  rows: ServiceRow[];
}

export interface CatalogTableProps {
  groups: CatalogGroup[];
  /** Все строки в текущем порядке — чтобы переложить порядок услуг целиком */
  allRows: ServiceRow[];
  staffList: Staff[];
  selected: Set<string>;
  onSelect: (id: string, on: boolean) => void;
  onSelectMany: (ids: string[], on: boolean) => void;
  canEdit: boolean;
  dragDisabled: boolean;
  table: boolean;
  actions: CatalogActions;
}

export function CatalogTable({
  groups,
  allRows,
  staffList,
  selected,
  onSelect,
  onSelectMany,
  canEdit,
  dragDisabled,
  table,
  actions,
}: CatalogTableProps) {
  const t = useT('services');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const catKey = groups.map((g) => `cat:${g.category.id}`).join(',');
  const catIds = catKey ? catKey.split(',') : [];

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    if (a.startsWith('cat:')) {
      // Отпустили над услугой — значит, над её категорией
      const target = o.startsWith('cat:') ? o : `cat:${groups.find((g) => g.rows.some((r) => r.service.id === o))?.category.id}`;
      const ids = groups.map((g) => `cat:${g.category.id}`);
      if (!ids.includes(target) || target === a) return;
      const next = arrayMove(ids, ids.indexOf(a), ids.indexOf(target));
      void actions.reorderCategories(next.map((x) => x.slice(4)));
      return;
    }
    const group = groups.find((g) => g.rows.some((r) => r.service.id === a));
    if (!group || !group.rows.some((r) => r.service.id === o)) return;
    const inCat = group.rows.map((r) => r.service.id);
    const moved = arrayMove(inCat, inCat.indexOf(a), inCat.indexOf(o));
    // Порядок всего каталога: услуги этой категории встают на свои же места в новом порядке
    let k = 0;
    const all = allRows.map((r) => (r.service.categoryId === group.category.id ? moved[k++] : r.service.id));
    void actions.reorderServices(all);
  };

  return (
    <div data-f="F-00-082 F-14-114" className="flex flex-col gap-3">
      {table && (
        <div role="presentation" className={cn(CATALOG_GRID, 'px-2.5 text-xs font-medium text-muted')}>
          <span />
          <span />
          <span>{t('list.colName')}</span>
          <span className="text-center">{t('list.colOnline')}</span>
          <span className="px-2 text-right">{t('list.colPrice')}</span>
          <span className="px-2 text-right">{t('list.colDuration')}</span>
          <span className="px-2">{t('list.colBreak')}</span>
          <span className="px-2">{t('list.colStaff')}</span>
          <span />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={catIds} strategy={verticalListSortingStrategy} disabled={dragDisabled}>
          {groups.map((g) => (
            <CategoryGroup
              key={g.category.id}
              category={g.category}
              rows={g.rows}
              staffList={staffList}
              selected={selected}
              onSelect={onSelect}
              onSelectMany={onSelectMany}
              canEdit={canEdit}
              dragDisabled={dragDisabled}
              table={table}
              actions={actions}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
