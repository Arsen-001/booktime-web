import { apiIdentity, type ApiIdentity } from '@/api/identity';
import { dataMode } from '@/api/mode';
import type { CoreData, Id, SphereId } from '@/domain/core';
import { BIZ_PERSONAS, EMPTY_PERSONAS, readIdentityCookies, type DemoIdentity, type PersonaId } from '@/demo/settings';
import { useDemoStore } from '@/demo/store';
import { BIZ, EMPTY_BIZ_IDS } from '@/mock/seed/ids';

/**
 * «Кто я» для демо-персоны: какой пользователь приложения, сотрудник, бизнес и филиалы.
 * Бизнес подбирается под выбранную сферу (владелец + dental → стоматология), если такого нет — первый.
 */
export interface DemoContext {
  persona: PersonaId;
  sphere: SphereId;
  /** Клиент приложения (персона client) */
  appUserId?: Id;
  /** Сотрудник, от имени которого работаем в кабинете */
  staffId?: Id;
  /** Текущий бизнес (для сети — бизнес филиала, выбранного в верхней полосе; «Все филиалы» — первый) */
  businessId?: Id;
  networkId?: Id;
  /** Все доступные персоне бизнесы (сеть — все филиалы) */
  businessIds: Id[];
  /** Все доступные персоне филиалы */
  locationIds: Id[];
  /** Персона смотрит пустой бизнес («Новый салон — пусто» / «Новый мастер — пусто») */
  empty?: boolean;
}

/**
 * identity — кто вошёл в приложение и флаг «пустой бизнес» (DemoSettings.appUser / empty).
 * Не передан — берётся из cookie браузера: так currentActor() в api/core видит того же пользователя, что и экраны.
 */
export function resolveDemoContext(
  persona: PersonaId,
  sphere: SphereId,
  core: CoreData,
  identity: DemoIdentity = readIdentityCookies(),
  api: ApiIdentity | null = apiIdentity(),
  /** Филиал из верхней полосы кабинета ('all' — все); сеть берёт текущим бизнес этого филиала (Сеть2) */
  selectedLocationId: Id | 'all' | undefined = useDemoStore.getState().locationId,
  /** Сеть, выбранная в переключателе (F-11-021); нет такой — первая сеть персоны, как раньше */
  selectedNetworkId: Id | undefined = useDemoStore.getState().networkId,
): DemoContext {
  const base: DemoContext = { persona, sphere, businessIds: [], locationIds: [] };
  // Живой сайт (режим api): бизнес, сотрудник и филиалы — из членства в сессии сервера (SessionBridge)
  if (BIZ_PERSONAS.includes(persona) && dataMode() === 'api') {
    // Сессия ещё не прочитана или бизнеса нет — никакого демо-бизнеса: кабинет ждёт «кто я» от сервера
    if (!api) return base;
    // Сеть: выбран один филиал — текущий бизнес его, если он среди доступных (зеркало ядра знает, чей филиал)
    const pickedBiz =
      api.networkId && selectedLocationId && selectedLocationId !== 'all' && api.locationIds.includes(selectedLocationId)
        ? core.locations?.find((l) => l.id === selectedLocationId)?.businessId
        : undefined;
    return {
      ...base,
      staffId: api.staffId,
      businessId: pickedBiz && api.businessIds.includes(pickedBiz) ? pickedBiz : api.businessId,
      networkId: api.networkId,
      businessIds: api.businessIds,
      locationIds: api.locationIds,
    };
  }
  const bySphere = <T extends { sphereIds: SphereId[] }>(list: T[]): T | undefined =>
    list.find((x) => x.sphereIds.includes(sphere)) ?? list[0];

  if (persona === 'client') {
    // Вошедший по коду клиент (cookie demo_app_user); нет такого в базе — демо-клиент по умолчанию
    const signedIn = identity.appUserId ? core.appUsers.find((u) => u.id === identity.appUserId) : undefined;
    return { ...base, appUserId: (signedIn ?? core.appUsers[0])?.id };
  }
  if (persona === 'guest' || persona === 'platform') return base;

  if (persona === 'network') {
    const network = core.networks.find((n) => n.id === selectedNetworkId) ?? core.networks[0];
    if (!network) return base;
    const businesses = core.businesses.filter((b) => network.businessIds.includes(b.id));
    // Выбран один филиал — текущий бизнес его (Сеть2); «Все филиалы» и ничего — первый, как раньше
    const picked =
      selectedLocationId && selectedLocationId !== 'all'
        ? businesses.find((b) => b.locationIds.includes(selectedLocationId))
        : undefined;
    return {
      ...base,
      networkId: network.id,
      staffId: network.ownerStaffId,
      businessId: (picked ?? businesses[0])?.id,
      businessIds: businesses.map((b) => b.id),
      locationIds: businesses.flatMap((b) => b.locationIds),
    };
  }

  if (identity.empty && EMPTY_PERSONAS.includes(persona)) {
    const empty = core.businesses.find((b) => b.id === (persona === 'individual' ? BIZ.emptySolo : BIZ.empty));
    if (empty) {
      return {
        ...base,
        empty: true,
        staffId: empty.ownerStaffId,
        businessId: empty.id,
        businessIds: [empty.id],
        locationIds: empty.locationIds,
      };
    }
  }

  const kind = persona === 'individual' ? 'individual' : 'salon';
  // Пустые бизнесы — только по флагу: иначе «владелец + сфера без салона» попадал бы в пустоту
  const candidates = core.businesses.filter((b) => b.kind === kind && !b.networkId && !EMPTY_BIZ_IDS.includes(b.id));
  const business = bySphere(candidates);
  if (!business) return base;
  const staffOfBusiness = core.staff.filter((s) => s.businessId === business.id && s.status === 'active');
  let staffId: Id | undefined = business.ownerStaffId;
  if (persona === 'admin') staffId = staffOfBusiness.find((s) => s.role === 'admin')?.id ?? business.ownerStaffId;
  if (persona === 'master') staffId = staffOfBusiness.find((s) => s.role === 'master')?.id ?? business.ownerStaffId;
  return {
    ...base,
    staffId,
    businessId: business.id,
    businessIds: [business.id],
    locationIds: business.locationIds,
  };
}
