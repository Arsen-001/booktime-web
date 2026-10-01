"use client";

/**
 * Перетаскивание строки внутри её группы (С1 обзора «Сотрудники»): мышью и пальцем (pointer events), стрелками
 * ↑ ↓ с клавиатуры. Пока тянем — только transform у строк, прямо в DOM, без перерисовок React (DESIGN.md →
 * Performance). Отпустили — один вызов onMove(кого, к кому, до/после); порядок меняет вызывающий экран
 * (optimistic-правка кэша), строки встают на место уже в новом порядке.
 *
 * Разметка: у строки data-reorder-row={id} и data-reorder-group={ключ группы}; ручка — {...handleProps(id)}.
 * Скрытые строки (поиск, телефон/десктоп) не участвуют — берутся только видимые.
 */
import type { KeyboardEvent, PointerEvent } from "react";

export type MovePlace = "before" | "after";

export interface RowReorderOptions {
  enabled: boolean;
  onMove: (staffId: string, targetId: string, place: MovePlace) => void;
}

function rowOf(el: Element | null): HTMLElement | null {
  return el?.closest<HTMLElement>("[data-reorder-row]") ?? null;
}

function siblingsOf(row: HTMLElement): HTMLElement[] {
  const group = row.dataset.reorderGroup;
  const scope = row.parentElement;
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<HTMLElement>("[data-reorder-row]")).filter(
    (el) => el.dataset.reorderGroup === group && el.offsetParent !== null,
  );
}

export function useRowReorder({ enabled, onMove }: RowReorderOptions) {
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) return;
    const handle = event.currentTarget;
    const row = rowOf(handle);
    if (!row) return;
    const rows = siblingsOf(row);
    const from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const rects = rows.map((r) => r.getBoundingClientRect());
    const height = rects[from].height;
    const startY = event.clientY;
    let to = from;
    row.style.position = "relative";
    row.style.zIndex = "2";
    row.dataset.dragging = "";
    for (const r of rows) if (r !== row) r.style.transition = "transform 150ms cubic-bezier(0.2, 0.8, 0.2, 1)";

    const move = (e: globalThis.PointerEvent) => {
      const dy = e.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      const center = rects[from].top + height / 2 + dy;
      let next = from;
      for (let i = 0; i < rects.length; i++) {
        const mid = rects[i].top + rects[i].height / 2;
        if (i < from && center < mid) {
          next = i;
          break;
        }
        if (i > from && center > mid) next = i;
      }
      if (next === to) return;
      to = next;
      rows.forEach((r, i) => {
        if (r === row) return;
        const shift = from < to && i > from && i <= to ? -height : from > to && i >= to && i < from ? height : 0;
        r.style.transform = shift ? `translateY(${shift}px)` : "";
      });
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      for (const r of rows) {
        r.style.transform = "";
        r.style.transition = "";
      }
      row.style.position = "";
      row.style.zIndex = "";
      delete row.dataset.dragging;
      if (to !== from) {
        const target = rows[to].dataset.reorderRow;
        const id = row.dataset.reorderRow;
        if (target && id) onMove(id, target, to > from ? "after" : "before");
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!enabled || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    const row = rowOf(event.currentTarget);
    if (!row) return;
    const rows = siblingsOf(row);
    const i = rows.indexOf(row);
    const j = event.key === "ArrowUp" ? i - 1 : i + 1;
    event.preventDefault();
    if (i < 0 || j < 0 || j >= rows.length) return;
    const target = rows[j].dataset.reorderRow;
    const id = row.dataset.reorderRow;
    if (!target || !id) return;
    onMove(id, target, event.key === "ArrowUp" ? "before" : "after");
    // Фокус остаётся на ручке той же строки: React переставит узел, а не пересоздаст его
  };

  return { onPointerDown, onKeyDown };
}
