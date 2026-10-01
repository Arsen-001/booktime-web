/**
 * Типы раздела «platform» — наша панель: проверка, подключение салона на визите, визиты, промокоды,
 * поддержка, спрос, реклама и места сторис, бизнесы и выгрузка, план запуска, идеи, заявки на сферы.
 * Разбиты по подсистемам; на сущности ядра ссылаемся по id (src/domain/core.ts).
 */
export type * from '@/domain/platform/types/team';
export type * from '@/domain/platform/types/moderation';
export type * from '@/domain/platform/types/connect';
export type * from '@/domain/platform/types/visits';
export type * from '@/domain/platform/types/promo';
export type * from '@/domain/platform/types/support';
export type * from '@/domain/platform/types/demand';
export type * from '@/domain/platform/types/ads';
export type * from '@/domain/platform/types/backups';
export type * from '@/domain/platform/types/plan';
export type * from '@/domain/platform/types/ideas';
export type * from '@/domain/platform/types/sphereRequests';
export type * from '@/domain/platform/types/dto';
