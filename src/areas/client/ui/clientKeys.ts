import type { CatalogQuery } from '@/api/client';
import type { Id } from '@/domain/core';

/**
 * Ключи запросов приложения клиента — `['client', '<ресурс>', …параметры]` (CONVENTIONS §18 п.1, arch-a1 №9).
 * Один ключ = одна функция чтения во всём приложении: кэш общий, тот же ключ из другого экрана получит те же данные.
 */
export const clientKeys = {
  catalog: (q: CatalogQuery) => ['client', 'catalog', q] as const,
  masterCard: (staffId: Id, appUserId: Id | undefined, serviceId?: Id) => ['client', 'masterCard', staffId, appUserId ?? '', serviceId ?? ''] as const,
  placeCard: (businessId: Id) => ['client', 'placeCard', businessId] as const,
  bookingDays: (staffId: Id, serviceId: Id, workplace?: string) => ['client', 'bookingDays', staffId, serviceId, workplace ?? ''] as const,
  shade: (serviceId: Id) => ['client', 'shade', serviceId] as const,
  membershipOption: (appUserId: Id, businessId: Id, serviceId: Id) => ['client', 'membershipOption', appUserId, businessId, serviceId] as const,
  myBookings: (appUserId: Id) => ['client', 'myBookings', appUserId] as const,
  upcoming: (appUserId: Id) => ['client', 'upcoming', appUserId] as const,
  booking: (bookingId: Id, appUserId: Id | undefined) => ['client', 'booking', bookingId, appUserId ?? ''] as const,
  waitlist: (appUserId: Id) => ['client', 'waitlist', appUserId] as const,
  bookedMasters: (appUserId: Id) => ['client', 'bookedMasters', appUserId] as const,
  notifications: (appUserId: Id) => ['client', 'notifications', appUserId] as const,
  profile: (appUserId: Id) => ['client', 'profile', appUserId] as const,
  cashback: (businessId: Id, appUserId: Id | undefined) => ['client', 'cashback', businessId, appUserId ?? ''] as const,
  membershipReminders: (appUserId: Id) => ['client', 'membershipReminders', appUserId] as const,
  homeStories: (appUserId: Id | undefined) => ['client', 'homeStories', appUserId ?? ''] as const,
  myBookingsInBusiness: (appUserId: Id, businessId: Id) => ['client', 'myBookingsInBusiness', appUserId, businessId] as const,
  myStar: (appUserId: Id, staffId: Id) => ['client', 'myStar', appUserId, staffId] as const,
  myStaffReview: (appUserId: Id, staffId: Id) => ['client', 'myStaffReview', appUserId, staffId] as const,
  favorites: (appUserId: Id) => ['client', 'favorites', appUserId] as const,
};
