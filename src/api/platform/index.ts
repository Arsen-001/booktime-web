/**
 * API раздела «platform» — наша панель. Одна функция = один будущий эндпоинт = один request().
 * Разбито по подсистемам (arch-a1 №3); импорты экранов не меняются: `import { … } from '@/api/platform'`.
 * Функции, которые зовут другие разделы (submitForModeration, reportSearchDemand, getActiveAds, createIdea…),
 * доступны всем; функции панели проверяют право platform.access (PANEL).
 */
export * from '@/api/platform/moderation';
export * from '@/api/platform/connect';
export * from '@/api/platform/visits';
export * from '@/api/platform/prospects';
export * from '@/api/platform/promo';
export * from '@/api/platform/support';
export * from '@/api/platform/demand';
export * from '@/api/platform/ads';
export * from '@/api/platform/businesses';
export * from '@/api/platform/plan';
export * from '@/api/platform/ideas';
export * from '@/api/platform/sphereRequests';
export * from '@/api/platform/overview';
export * from '@/api/platform/team';
