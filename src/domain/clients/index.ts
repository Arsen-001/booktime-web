/**
 * Раздел «clients»: типы и чистые правила. Импорт — `@/domain/clients`.
 *   types    — профиль, права, колонки, фильтры, строка списка, запрос/ответ списка
 *   program  — программа лояльности, импорт/выгрузка, категории, визиты, файлы, сводка
 *   filters  — подборки, поиск, конструктор фильтров, сортировка (их вызывает api `listClients`)
 *   money    — «Продано / Оплачено / Баланс» одним правилом для всех экранов
 */
export * from '@/domain/clients/types';
export * from '@/domain/clients/program';
export * from '@/domain/clients/filters';
export * from '@/domain/clients/money';
