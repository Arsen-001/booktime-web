/**
 * ПРАВИЛА ЯДРА — единый источник правды для всех разделов (arch-a1 №2–5, №8).
 * Чистые функции без React, стора и 'use client': те же файлы переедут на сервер.
 * Список функций и что чем заменить — CONVENTIONS.md «Правила — только из ядра».
 *
 *   import { isCancelled, checkSlot, freeSlots, effectiveBookingRules, clientCancelOutcome } from '@/domain/rules';
 *
 * Тесты: node --import ./src/domain/rules/tests/register.mjs --test src/domain/rules/tests/*.test.ts
 */
export * from '@/domain/rules/booking-status';
export * from '@/domain/rules/busy';
export * from '@/domain/rules/slots';
export * from '@/domain/rules/pricing';
export * from '@/domain/rules/booking-policy';
export * from '@/domain/rules/visibility';
export * from '@/domain/rules/public';
export * from '@/domain/rules/permissions';
export * from '@/domain/rules/booking-flow';
export * from '@/domain/rules/referral';
