/**
 * В-03: срок ответа на заявку — правило ядра (domain/rules/booking-policy.confirmDeadlineOf), одно на журнал,
 * напоминания мастеру (api/journal-offers) и снятие без ответа (api/core releaseExpired).
 */
export { confirmDeadlineOf } from '@/domain/rules/booking-policy';
