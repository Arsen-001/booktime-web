'use client';

/** Дерево категорий (F-08-010) — переиспользуется в боковой панели (десктоп) и в шторке (телефон). */
import { Pencil, Plus } from 'lucide-react';
import type { CategoryNode } from '@/api/stock';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';

function Row({
  node,
  depth,
  selectedId,
  onSelect,
  onEdit,
  onAddChild,
}: {
  node: CategoryNode;
  depth: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onEdit: (node: CategoryNode) => void;
  onAddChild: (parentId: string) => void;
}) {
  const active = selectedId === node.id;
  return (
    <div>
      <div
        className={cn(
          'group flex min-h-11 items-center gap-1 rounded-lg pr-1 text-sm',
          active ? 'bg-primary-soft text-primary-text' : 'text-fg hover:bg-surface-2',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button type="button" onClick={() => onSelect(node.id)} className="min-h-11 flex-1 truncate py-2 text-left">
          {node.name}
          {node.goodsCount > 0 && <span className="ml-1.5 text-xs text-muted">({node.goodsCount})</span>}
        </button>
        <IconButton
          icon={<Plus aria-hidden />}
          size="sm"
          variant="ghost"
          label={`Добавить категорию в «${node.name}»`}
          onClick={() => onAddChild(node.id)}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
        <IconButton icon={<Pencil aria-hidden />} size="sm" variant="ghost" label={`Изменить «${node.name}»`} onClick={() => onEdit(node)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
      </div>
      {node.children.map((child) => (
        <Row key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

export function CategoryTree({
  tree,
  selectedId,
  onSelect,
  onEdit,
  onAddChild,
  allGoodsCount,
}: {
  tree: CategoryNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  onEdit: (node: CategoryNode) => void;
  onAddChild: (parentId?: string) => void;
  allGoodsCount: number;
}) {
  const t = useT('stock');
  return (
    <div data-f="F-08-010" className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={cn(
          'flex min-h-11 items-center rounded-lg px-2 text-left text-sm font-medium',
          selectedId === 'all' ? 'bg-primary-soft text-primary-text' : 'text-fg hover:bg-surface-2',
        )}
      >
        {t('catalog.allGoods')}
        <span className="ml-1.5 text-xs text-muted">({allGoodsCount})</span>
      </button>
      {tree.map((node) => (
        <Row key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onAddChild={onAddChild} />
      ))}
      <button
        type="button"
        onClick={() => onAddChild(undefined)}
        className="mt-2 flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-left text-sm text-primary-text hover:bg-primary-soft"
      >
        <Plus aria-hidden className="size-4" />
        {t('catalog.addCategory')}
      </button>
    </div>
  );
}

/** Скелетон дерева — та же разметка: «Все товары (N)», строки категорий (с отступом вложенности), «Добавить категорию» */
export function CategoryTreeSkeleton({ depths = [0, 1, 1] }: { depths?: number[] }) {
  const t = useT('stock');
  return (
    <div aria-hidden className="flex flex-col gap-0.5">
      <span className="flex min-h-11 items-center rounded-lg bg-primary-soft px-2 text-left text-sm font-medium text-primary-text">
        {t('catalog.allGoods')}
        <span className="ml-1.5 text-xs text-muted">
          <SkeletonText width="3ch" />
        </span>
      </span>
      {depths.map((depth, i) => (
        <div key={i} className="flex min-h-11 items-center gap-1 rounded-lg pr-1 text-sm text-fg" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          <span className="min-h-11 flex-1 truncate py-2 text-left">
            <SkeletonText width={i % 2 ? '10ch' : '14ch'} />
          </span>
        </div>
      ))}
      <span className="mt-2 flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-left text-sm text-primary-text">
        <Plus aria-hidden className="size-4" />
        {t('catalog.addCategory')}
      </span>
    </div>
  );
}
