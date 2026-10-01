'use client';

/** /biz/stock/warehouses — список складов (F-08-005). Форма — /biz/stock/warehouses/new, /[warehouseId] (F-08-007/008). */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeftRight, GripVertical, Warehouse as WarehouseIcon } from 'lucide-react';
import { listWarehouses, reorderWarehouses } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { Warehouse } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { warehouseLabel } from '@/areas/stock/warehouse.utils';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';
import { MoveGoodsModal } from '@/areas/stock/MoveGoodsModal';

type WarehouseRow = Warehouse & { goodsCount: number };

/** F-08-006: строка склада, перетаскиваемая за ручку слева от названия */
function SortableWarehouseRow({ w, onOpen, onMove, canMove }: { w: WarehouseRow; onOpen: () => void; onMove: () => void; canMove: boolean }) {
  const t = useT('stock');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-2 py-3">
      <button type="button" {...attributes} {...listeners} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted" aria-label={t('warehouses.dragHandle')}>
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onOpen} className="flex min-h-10 min-w-0 flex-1 flex-col gap-1 py-1 text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-fg">{warehouseLabel(w, t)}</span>
          <Badge tone={w.type === 'sale' ? 'accent' : 'neutral'} size="sm" className="shrink-0">
            {w.type === 'sale' ? t('warehouseForm.typeSaleShort') : t('warehouseForm.typeWriteoffShort')}
          </Badge>
        </span>
        {w.comment && <span className="block truncate text-xs text-muted">{w.comment}</span>}
        <span className="block text-xs text-muted">{t('warehouses.goodsCount', { count: w.goodsCount })}</span>
      </button>
      {canMove && <IconButton icon={<ArrowLeftRight aria-hidden />} label={t('warehouses.moveGoodsFrom', { name: w.name })} variant="outline" onClick={onMove} />}
    </li>
  );
}

/** Скелетон строки склада — та же разметка: ручка, название с меткой типа, комментарий, число товаров, кнопка перемещения */
function WarehouseRowSkeleton({ i }: { i: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-2 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
        <GripVertical className="size-4" aria-hidden />
      </span>
      <span className="flex min-h-10 min-w-0 flex-1 flex-col gap-1 py-1 text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-fg">
            <SkeletonText width={i % 2 ? '7ch' : '10ch'} />
          </span>
          {/* Ширина метки — как у типичных «Расходники» / «Продажа» */}
          <Badge tone="neutral" size="sm" className="shrink-0">
            <SkeletonText width={i % 2 ? '8.4ch' : '11ch'} />
          </Badge>
        </span>
        <span className="block truncate text-xs text-muted">
          <SkeletonText width="26ch" />
        </span>
        <span className="block text-xs text-muted">
          <SkeletonText width="8ch" />
        </span>
      </span>
      <IconButton icon={<ArrowLeftRight aria-hidden />} label="" variant="outline" disabled />
    </li>
  );
}

export function WarehousesScreen() {
  const t = useT('stock');
  const router = useRouter();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);
  const q = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), { enabled });
  const [moveFrom, setMoveFrom] = useState<Id | undefined>();
  const [moveOpen, setMoveOpen] = useState(false);
  const [order, setOrder] = useState<WarehouseRow[] | null>(null);
  const [seenData, setSeenData] = useState<WarehouseRow[] | undefined>(undefined);
  const reorderMutation = useApiMutation((ids: Id[]) => reorderWarehouses(businessId!, locationId!, ids));
  const skeletonRows = useSkeletonCount('warehouses', { loading: q.isLoading, count: q.data?.length, fallback: 2, max: 8 });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Подхватываем свежий список складов без useEffect (react-hooks/set-state-in-effect) — правка состояния
  // во время рендера при смене данных запроса, официальный паттерн React «adjusting state during render».
  if (q.data && q.data !== seenData) {
    setSeenData(q.data);
    setOrder(q.data);
  }

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const items = order ?? q.data ?? [];

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !order) return;
    const from = order.findIndex((w) => w.id === active.id);
    const to = order.findIndex((w) => w.id === over.id);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    void reorderMutation.mutate(next.map((w) => w.id));
  };

  const openMove = (from?: Id) => {
    setMoveFrom(from);
    setMoveOpen(true);
  };

  return (
    <div data-f="F-08-004 F-08-005 F-08-006 F-08-143" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('warehouses.title')}
        description={t('warehouses.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <HelpArticleButton titleKey="help.warehouses.title" bodyKey="help.warehouses.body" />
            {/* При загрузке кнопка уже на месте (неактивна) — не появляется из пустоты */}
            {(q.isLoading || items.length > 1) && (
              <Button variant="secondary" leftIcon={<ArrowLeftRight aria-hidden />} onClick={() => openMove()} disabled={q.isLoading}>
                {t('warehouses.moveGoods')}
              </Button>
            )}
            <LinkButton href="/biz/stock/warehouses/new">{t('warehouses.add')}</LinkButton>
          </div>
        }
      />

      {q.isLoading ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <WarehouseRowSkeleton key={i} i={i} />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<WarehouseIcon aria-hidden />}
          title={t('warehouses.emptyTitle')}
          description={t('warehouses.emptyText')}
          action={<LinkButton href="/biz/stock/warehouses/new">{t('warehouses.add')}</LinkButton>}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {items.map((w) => (
                <SortableWarehouseRow
                  key={w.id}
                  w={w}
                  onOpen={() => router.push(`/biz/stock/warehouses/${w.id}`)}
                  onMove={() => openMove(w.id)}
                  canMove={items.length > 1}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {businessId && locationId && items.length > 1 && (
        <MoveGoodsModal
          open={moveOpen}
          onOpenChange={setMoveOpen}
          businessId={businessId}
          locationId={locationId}
          warehouses={items}
          defaultFromWarehouseId={moveFrom}
        />
      )}
    </div>
  );
}
