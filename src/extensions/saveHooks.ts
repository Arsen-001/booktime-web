'use client';

/**
 * Договор сохранения окна записи (arch-a1 №9): вклады регистрируют шаги «до» и «после» сохранения,
 * хозяин (journal) вызывает их вокруг своей записи.
 *
 * Хозяин:
 *   const save = useSaveSteps();
 *   <ExtensionSlot props={{ …, registerBeforeSave: save.registerBeforeSave, registerAfterSave: save.registerAfterSave }} />
 *   async function onSave() {
 *     await save.runBefore(draft);                 // бросит — сохранение отменяется, тост хозяина
 *     const booking = await saveBooking.mutate(…); // одна мутация хозяина
 *     await save.runAfter(booking.id, draft);      // вклады пишут своё; ошибка вклада не откатывает запись
 *   }
 *
 * Вклад:
 *   useAfterSaveStep(props.registerAfterSave, async (bookingId) => { await savePayment.mutate({ bookingId, … }); });
 */
import { useEffect, useRef, useState } from 'react';
import type { AfterSaveStep, BeforeSaveStep, BookingDraft, ServiceAfterSaveStep } from '@/extensions/types';
import type { Id } from '@/domain/core';

export interface SaveSteps {
  registerBeforeSave: (step: BeforeSaveStep) => () => void;
  registerAfterSave: (step: AfterSaveStep) => () => void;
  /** Все шаги «до» по очереди; первая ошибка прерывает */
  runBefore: (draft: BookingDraft) => Promise<void>;
  /** Все шаги «после» параллельно; возвращает ошибки упавших (запись хозяина уже сохранена) */
  runAfter: (bookingId: Id, draft: BookingDraft) => Promise<unknown[]>;
}

function createSaveSteps(): SaveSteps {
  const before = new Set<BeforeSaveStep>();
  const after = new Set<AfterSaveStep>();
  return {
    registerBeforeSave: (step) => {
      before.add(step);
      return () => before.delete(step);
    },
    registerAfterSave: (step) => {
      after.add(step);
      return () => after.delete(step);
    },
    runBefore: async (draft) => {
      for (const step of [...before]) await step(draft);
    },
    runAfter: async (bookingId, draft) => {
      const results = await Promise.allSettled([...after].map((step) => step(bookingId, draft)));
      return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason);
    },
  };
}

/** Хозяину: реестр шагов на время жизни окна (стабильный объект) */
export function useSaveSteps(): SaveSteps {
  const [steps] = useState(createSaveSteps);
  return steps;
}

/** Вкладу: шаг «до сохранения», пока компонент смонтирован. register — props.registerBeforeSave (может не быть) */
export function useBeforeSaveStep(register: ((step: BeforeSaveStep) => () => void) | undefined, step: BeforeSaveStep): void {
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    if (!register) return;
    return register((draft) => latest.current(draft));
  }, [register]);
}

/** Вкладу: шаг «после сохранения» (есть bookingId). register — props.registerAfterSave (может не быть) */
export function useAfterSaveStep(register: ((step: AfterSaveStep) => () => void) | undefined, step: AfterSaveStep): void {
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    if (!register) return;
    return register((bookingId, draft) => latest.current(bookingId, draft));
  }, [register]);
}

// ─────────────────────────── Карточка услуги (хозяин services, 28.09) ───────────────────────────

export interface ServiceSaveSteps {
  registerAfterSave: (step: ServiceAfterSaveStep) => () => void;
  /** Все шаги «после» параллельно; возвращает ошибки упавших (услуга уже сохранена) */
  runAfter: (serviceId: Id) => Promise<unknown[]>;
}

function createServiceSaveSteps(): ServiceSaveSteps {
  const after = new Set<ServiceAfterSaveStep>();
  return {
    registerAfterSave: (step) => {
      after.add(step);
      return () => after.delete(step);
    },
    runAfter: async (serviceId) => {
      const results = await Promise.allSettled([...after].map((step) => step(serviceId)));
      return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason);
    },
  };
}

/** Хозяину карточки услуги: реестр шагов на время жизни формы (стабильный объект) */
export function useServiceSaveSteps(): ServiceSaveSteps {
  const [steps] = useState(createServiceSaveSteps);
  return steps;
}

/** Вкладу карточки услуги: шаг «после сохранения услуги». register — props.registerAfterSave (может не быть) */
export function useServiceAfterSaveStep(register: ((step: ServiceAfterSaveStep) => () => void) | undefined, step: ServiceAfterSaveStep): void {
  const latest = useRef(step);
  useEffect(() => {
    latest.current = step;
  });
  useEffect(() => {
    if (!register) return;
    return register((serviceId) => latest.current(serviceId));
  }, [register]);
}
