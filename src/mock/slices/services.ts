import { defineSlice } from '@/mock/slice';
import type { Id } from '@/domain/core';
import type {
  CategoryExtra,
  PhotoServiceLinks,
  ServiceExtra,
  StaffDocument,
  StaffServiceTerm,
  SterilizationInfo,
} from '@/domain/services';

/**
 * Срез моковой базы раздела «services». Принадлежит разделу.
 * Ключи — id сущностей ядра (Service.id / ServiceCategory.id / Staff.id). Меняете форму — поднимите version.
 */
export interface ServicesState {
  serviceExtra: Record<Id, ServiceExtra>;
  categoryExtra: Record<Id, CategoryExtra>;
  staffTerms: StaffServiceTerm[];
  /** Купленные места сверх 6 (F-00-086), ключ — Staff.id */
  photoExtraSlots: Record<Id, number>;
  /** Привязка фото работы к услуге, ключ — сама картинка из Staff.photos (F-00-085) */
  photoServiceLinks: PhotoServiceLinks;
  /** Дипломы и сертификаты мастеров (F-00-088) */
  documents: StaffDocument[];
  /** Стерилизация, ключ — Staff.id (F-00-090) */
  sterilization: Record<Id, SterilizationInfo>;
}

export const servicesSlice = defineSlice<ServicesState>({
  // 3 — ServiceExtra.onlineWindow (F-02-067) и армянские названия (hy) в формах услуги и категории
  version: 3,
  seed: (): ServicesState => ({
    serviceExtra: {},
    categoryExtra: {},
    staffTerms: [],
    photoExtraSlots: {},
    photoServiceLinks: {},
    documents: [],
    sterilization: {},
  }),
});
