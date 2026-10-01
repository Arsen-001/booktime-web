/**
 * API раздела «clients». Импорт — `@/api/clients` (экраны не знают, из какого файла функция).
 *   list — список и колонки; card — карточка; settings — настройки и права; catalog — справочники;
 *   visits — визиты и сводка; bulk — массовые действия; loyalty — программа лояльности; importExport — Excel.
 * shared — внутреннее для этих файлов, наружу отдаются только ошибка дубля и типы формы.
 */
export * from '@/api/clients/list';
export * from '@/api/clients/card';
export * from '@/api/clients/extras';
export * from '@/api/clients/settings';
export * from '@/api/clients/catalog';
export * from '@/api/clients/visits';
export * from '@/api/clients/bulk';
export * from '@/api/clients/loyalty';
export * from '@/api/clients/importExport';
export { DuplicatePhoneError, validateNationalId } from '@/api/clients/shared';
export type { ClientFormFields, CreateClientInput } from '@/api/clients/shared';
