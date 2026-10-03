'use client';

/**
 * Подключение салона на визите (F-00-176): черновик по шагам и «Подключить» одной транзакцией.
 * Фото, снятые нами на визите, проходят без очереди проверки (F-00-171). Бесплатный месяц — всем, кого
 * подключили на визите (F-00-019); промокод шага «Промокод» списывается только при создании бизнеса (F-00-020).
 */
import { coreTx, moderationHiddenIds } from '@/api/core';
import { isApiMode } from '@/api/http';
import { mutateArea, readArea, readCore } from '@/api/area';
import { staffClientVisibility } from '@/domain/rules';
import { ApiError, request } from '@/api/request';
import type { GeoPoint, Id, SphereId } from '@/domain/core';
import {
  connectIssues,
  defaultConnectWeek,
  type ConnectDraft,
  type ConnectInvite,
  type ConnectResult,
  type ConnectServiceLine,
  type SphereTemplateService,
} from '@/domain/platform';
import { addDays, nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/connect.server';

/** Готовые услуги сферы (F-00-083): на шаге «Услуги» они уже отмечены — снять лишнее быстрее, чем набирать */
const SPHERE_SERVICE_TEMPLATES: Record<SphereId, SphereTemplateService[]> = {
  nails: [
    { templateId: 'nails_manicure', name: { ru: 'Маникюр классический', en: 'Classic manicure' }, durationMin: 60, price: 6000 },
    { templateId: 'nails_gel', name: { ru: 'Покрытие гель-лаком', en: 'Gel polish' }, durationMin: 90, price: 9000 },
    { templateId: 'nails_pedicure', name: { ru: 'Педикюр', en: 'Pedicure' }, durationMin: 75, price: 8000 },
  ],
  barber: [
    { templateId: 'barber_cut', name: { ru: 'Стрижка мужская', en: "Men's haircut" }, durationMin: 40, price: 5000 },
    { templateId: 'barber_beard', name: { ru: 'Оформление бороды', en: 'Beard trim' }, durationMin: 25, price: 3000 },
  ],
  hair: [
    { templateId: 'hair_cut', name: { ru: 'Стрижка', en: 'Haircut' }, durationMin: 50, price: 6000 },
    { templateId: 'hair_color', name: { ru: 'Окрашивание', en: 'Coloring' }, durationMin: 150, price: 20000 },
  ],
  cosmetology: [
    { templateId: 'cosm_clean', name: { ru: 'Чистка лица', en: 'Facial cleansing' }, durationMin: 60, price: 12000 },
    { templateId: 'cosm_peel', name: { ru: 'Пилинг', en: 'Peeling' }, durationMin: 45, price: 10000 },
  ],
  massage: [
    { templateId: 'mass_relax', name: { ru: 'Массаж расслабляющий', en: 'Relaxing massage' }, durationMin: 60, price: 10000 },
    { templateId: 'mass_sport', name: { ru: 'Спортивный массаж', en: 'Sports massage' }, durationMin: 60, price: 12000 },
  ],
  dental: [
    { templateId: 'dental_check', name: { ru: 'Консультация', en: 'Check-up' }, durationMin: 30, price: 5000 },
    { templateId: 'dental_clean', name: { ru: 'Профессиональная чистка', en: 'Professional cleaning' }, durationMin: 60, price: 15000 },
  ],
  fitness: [{ templateId: 'fit_single', name: { ru: 'Персональная тренировка', en: 'Personal training' }, durationMin: 60, price: 8000 }],
  carwash: [
    { templateId: 'wash_full', name: { ru: 'Полная мойка кузова', en: 'Full body wash' }, durationMin: 45, price: 4000 },
    { templateId: 'wash_interior', name: { ru: 'Химчистка салона', en: 'Interior deep clean' }, durationMin: 90, price: 15000 },
  ],
  tailor: [
    { templateId: 'tailor_hem', name: { ru: 'Подшить брюки', en: 'Trouser hemming' }, durationMin: 30, price: 2500 },
    { templateId: 'tailor_zip', name: { ru: 'Замена молнии', en: 'Zip replacement' }, durationMin: 45, price: 3000 },
  ],
  repair: [
    { templateId: 'repair_diag', name: { ru: 'Диагностика', en: 'Diagnostics' }, durationMin: 30, price: 0 },
    { templateId: 'repair_screen', name: { ru: 'Замена экрана', en: 'Screen replacement' }, durationMin: 60, price: 15000 },
  ],
  drycleaning: [
    { templateId: 'dry_suit', name: { ru: 'Химчистка костюма', en: 'Suit dry cleaning' }, durationMin: 30, price: 6000 },
    { templateId: 'dry_coat', name: { ru: 'Химчистка пальто', en: 'Coat dry cleaning' }, durationMin: 30, price: 7000 },
  ],
  detailing: [
    { templateId: 'det_polish', name: { ru: 'Полировка кузова', en: 'Paint polishing' }, durationMin: 240, price: 60000 },
    { templateId: 'det_interior', name: { ru: 'Химчистка салона', en: 'Interior deep clean' }, durationMin: 180, price: 35000 },
  ],
  general: [{ templateId: 'general_basic', name: { ru: 'Услуга', en: 'Service' }, durationMin: 60, price: 5000 }],
};

function templateLines(sphereId: SphereId | undefined): ConnectServiceLine[] {
  return sphereId ? SPHERE_SERVICE_TEMPLATES[sphereId].map((t) => ({ ...t, selected: true })) : [];
}

const FREE_DAYS = 30;

/** Виден ли салон клиентам в каталоге — по правилу ядра, с учётом очереди проверки */
function catalogState(ownerStaffId: Id): { inCatalog: boolean; catalogReasons: string[] } {
  const core = readCore();
  const owner = core.staff.find((s) => s.id === ownerStaffId);
  if (!owner) return { inCatalog: false, catalogReasons: ['staff_inactive'] };
  const v = staffClientVisibility(core, owner, { hiddenIds: moderationHiddenIds() });
  return { inCatalog: v.catalog, catalogReasons: v.reasons };
}

export function listConnectDrafts(): Promise<ConnectDraft[]> {
  if (isApiMode()) return S.listConnectDrafts();
  return request(
    () => readArea(AREA).connectDrafts.filter((d) => d.status === 'draft').sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    PANEL,
  );
}

export function getConnectDraft(id: Id): Promise<ConnectDraft> {
  if (isApiMode()) return S.getConnectDraft(id);
  return request(() => {
    const found = readArea(AREA).connectDrafts.find((d) => d.id === id);
    if (!found) throw new ApiError('not_found');
    return found;
  }, PANEL);
}

/** Новый черновик; начатый из карточки визита — сразу с его названием, контактом, районом и сферой */
export function startConnectDraft(input: { visitId?: Id } = {}): Promise<ConnectDraft> {
  if (isApiMode()) return S.startConnectDraft(input);
  return request(() => {
    const area = readArea(AREA);
    const visit = input.visitId ? area.visits.find((v) => v.id === input.visitId) : undefined;
    const draft: ConnectDraft = {
      id: newId('cd'),
      status: 'draft',
      step: 0,
      kind: 'salon',
      name: visit?.placeName ?? '',
      sphereId: visit?.sphereId,
      ownerName: visit?.contactName ?? '',
      ownerPhone: visit?.phone ?? '',
      district: visit?.district,
      address: visit?.address ?? '',
      yandexMapsUrl: '',
      photos: [],
      invites: [],
      services: templateLines(visit?.sphereId),
      hours: defaultConnectWeek(),
      visitId: visit?.id,
      responsibleId: visit?.responsibleId ?? area.team[0]?.id ?? '',
      startedAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.connectDrafts.push(draft);
    });
    return draft;
  }, PANEL);
}

/** Сохранить поля шага. Смена сферы подставляет её услуги (все отмечены). Салону режим календаря — всегда «свободно». */
/** Поля черновика, которые правит мастер подключения */
export type ConnectDraftPatch = Partial<Omit<ConnectDraft, 'id' | 'status' | 'businessId' | 'startedAt' | 'finishedAt'>>;

export function saveConnectDraft(id: Id, patch: ConnectDraftPatch): Promise<ConnectDraft> {
  if (isApiMode()) return S.saveConnectDraft(id, patch);
  return request(() => {
    let result: ConnectDraft | undefined;
    mutateArea(AREA, (s) => {
      const draft = s.connectDrafts.find((d) => d.id === id);
      if (!draft) throw new ApiError('not_found');
      if (draft.status !== 'draft') throw new ApiError('conflict');
      const sphereChanged = patch.sphereId !== undefined && patch.sphereId !== draft.sphereId;
      Object.assign(draft, patch);
      // Сменили сферу — её типовые услуги (все отмечены); услуги прежней сферы не годятся
      if (sphereChanged) draft.services = templateLines(draft.sphereId);
      if (draft.kind === 'salon') draft.calendarMode = undefined;
      result = draft;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

/** «Я сейчас на месте работы»: точка без карт (F-00-176) */
export function markConnectHere(id: Id, coords: GeoPoint): Promise<ConnectDraft> {
  return saveConnectDraft(id, { coords, coordsAt: nowDateTime() });
}

/** «Удалить черновик» — черновик удаляется совсем */
export function deleteConnectDraft(id: Id): Promise<void> {
  if (isApiMode()) return S.deleteConnectDraft(id);
  return request(() => {
    mutateArea(AREA, (s) => {
      s.connectDrafts = s.connectDrafts.filter((d) => d.id !== id);
    });
  }, PANEL);
}

export function addConnectInvite(draftId: Id, invite: Omit<ConnectInvite, 'id'>): Promise<ConnectDraft> {
  if (isApiMode()) return S.addConnectInvite(draftId, invite);
  return request(() => {
    const phone = normalizePhone(invite.phone);
    if (!phone) throw new ApiError('validation', 'phone');
    let result: ConnectDraft | undefined;
    mutateArea(AREA, (s) => {
      const draft = s.connectDrafts.find((d) => d.id === draftId);
      if (!draft) throw new ApiError('not_found');
      if (draft.invites.some((i) => i.phone === phone)) throw new ApiError('duplicate');
      draft.invites.push({ id: newId('inv'), name: invite.name.trim(), phone });
      result = draft;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

export function removeConnectInvite(draftId: Id, inviteId: Id): Promise<ConnectDraft> {
  if (isApiMode()) return S.removeConnectInvite(draftId, inviteId);
  return request(() => {
    let result: ConnectDraft | undefined;
    mutateArea(AREA, (s) => {
      const draft = s.connectDrafts.find((d) => d.id === draftId);
      if (!draft) throw new ApiError('not_found');
      draft.invites = draft.invites.filter((i) => i.id !== inviteId);
      result = draft;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

/**
 * «Подключить»: бизнес, филиал, владелец, приглашённые мастера, график, услуги, фото с визита, бесплатный месяц,
 * промокод и визит — ОДНОЙ транзакцией (ядро — синхронными coreTx внутри одного request()). Упало посередине —
 * откатится всё, полсалона не останется. Незаполненное — ApiError('connect_incomplete', 'name,sphere,…').
 */
export function finishConnectDraft(id: Id, patch: ConnectDraftPatch = {}): Promise<ConnectResult> {
  if (isApiMode()) return S.finishConnectDraft(id, patch);
  return request(() => {
    const area = readArea(AREA);
    const stored = area.connectDrafts.find((d) => d.id === id);
    if (!stored) throw new ApiError('not_found');
    if (stored.status !== 'draft') throw new ApiError('conflict');
    // Поля последнего шага приходят вместе с командой — одна операция, один запрос
    const draft: ConnectDraft = { ...stored, ...patch };
    const issues = connectIssues(draft);
    const sphereId = draft.sphereId;
    const ownerPhone = normalizePhone(draft.ownerPhone);
    if (issues.length || !sphereId || !ownerPhone) throw new ApiError('connect_incomplete', issues.join(','));

    const now = nowDateTime();
    const name = draft.name.trim();
    const businessId = newId('biz');
    const ownerId = newId('st');
    const locationId = newId('loc');
    const categoryId = newId('cat');
    const lines = draft.services.filter((s) => s.selected);
    const serviceIds = lines.map(() => newId('sv'));
    // F-00-052: салону — «всё свободно»; индивидуал выбрал сам (проверено connectIssues)
    const calendarMode = draft.kind === 'salon' ? 'free' : (draft.calendarMode ?? 'free');
    const staffBase = {
      businessId,
      locationIds: [locationId],
      sphereIds: [sphereId],
      photos: [],
      materials: [],
      workplaces: ['salon' as const],
      accepts: 'all' as const,
      calendarVisibility: 'all' as const,
      // В-03: новый мастер по умолчанию «с подтверждением» — мастер сам переключает на «сразу»
      confirmMode: 'manual' as const,
      hiredAt: today(),
    };

    const slug = coreTx.uniqueBusinessSlug(name);
    coreTx.create('businesses', {
      id: businessId,
      kind: draft.kind,
      name,
      slug,
      sphereIds: [sphereId],
      ownerStaffId: ownerId,
      locationIds: [locationId],
      phone: ownerPhone,
      photos: [...draft.photos],
      status: 'active',
      createdAt: now,
    });
    coreTx.create('locations', {
      id: locationId,
      businessId,
      name: { ru: name },
      address: { ru: draft.address.trim() },
      district: draft.district ?? 'kentron',
      yandexMapsUrl: draft.yandexMapsUrl.trim() || undefined,
      coords: draft.coords,
      openHours: draft.hours,
    });
    coreTx.create('staff', {
      ...staffBase,
      id: ownerId,
      name: draft.ownerName.trim() || name,
      phone: ownerPhone,
      role: 'owner',
      // Фото, снятые на визите, — и портфолио владельца: без фото мастер не попадает в каталог (F-00-072)
      photos: [...draft.photos],
      calendarMode,
      colorIndex: 1,
      serviceIds,
      status: 'active',
    });
    // Без графика мастер не появляется ни в одном свободном окне — салон был бы невидим в каталоге
    coreTx.create('schedules', { staffId: ownerId, locationId, workplace: 'salon', week: draft.hours, overrides: {} });
    draft.invites.forEach((invite, i) => {
      coreTx.create('staff', {
        ...staffBase,
        name: invite.name || invite.phone,
        phone: normalizePhone(invite.phone) ?? invite.phone,
        role: 'master',
        calendarMode: 'free',
        colorIndex: ((i + 1) % 8) + 1,
        serviceIds: [],
        status: 'invited',
      });
    });
    coreTx.create('serviceCategories', { id: categoryId, businessId, name: { ru: 'Услуги', en: 'Services' }, order: 1 });
    lines.forEach((line, i) => {
      coreTx.create('services', {
        id: serviceIds[i],
        businessId,
        categoryId,
        sphereId,
        name: line.name,
        kind: 'individual',
        durationMin: line.durationMin,
        priceMin: line.price,
        photos: [],
        materials: [],
        staffIds: [ownerId],
        workplaces: ['salon'],
        onlineBookable: true,
        active: true,
        order: i + 1,
      });
    });

    const freeUntil = addDays(today(), FREE_DAYS);
    const promo = draft.promoCodeId ? area.promoCodes.find((p) => p.id === draft.promoCodeId) : undefined;
    mutateArea(AREA, (s) => {
      // Фото сняты нами на визите — показываются сразу, в очереди видны во вкладке «Без проверки» (F-00-171)
      draft.photos.forEach((url) => {
        s.moderationItems.unshift({
          id: newId('mod'),
          kind: 'salonPhoto',
          businessId,
          refId: url,
          imageUrl: url,
          status: 'auto',
          source: 'visit',
          submittedAt: now,
          decidedAt: now,
          history: [{ id: newId('mev'), at: now, kind: 'auto' }],
        });
      });
      const target = s.connectDrafts.find((d) => d.id === id);
      if (target) Object.assign(target, patch, { status: 'done', businessId, finishedAt: now });
      s.bizMeta[businessId] = { businessId, source: 'visit', freeUntil, responsibleId: draft.responsibleId, promoCodeId: draft.promoCodeId };
      const code = draft.promoCodeId ? s.promoCodes.find((p) => p.id === draft.promoCodeId) : undefined;
      if (code && !code.usedAt && !code.revokedAt) {
        code.usedAt = now;
        code.usedByBusinessId = businessId;
      }
      const visit = draft.visitId ? s.visits.find((v) => v.id === draft.visitId) : undefined;
      if (visit) {
        visit.status = 'connected';
        visit.businessId = businessId;
        visit.callbackDate = undefined;
        visit.updatedAt = now;
        visit.history.push({ id: newId('vev'), at: now, kind: 'connected' });
      }
    });

    return {
      businessId,
      name,
      slug,
      kind: draft.kind,
      ownerPhone,
      freeUntil,
      services: lines.length,
      staff: 1 + draft.invites.length,
      photos: draft.photos.length,
      promoCode: promo?.code,
      ...catalogState(ownerId),
    };
  }, PANEL);
}

/** Итог подключения для экрана «передать владельцу» (переживает перезагрузку страницы) */
export function getConnectResult(businessId: Id): Promise<ConnectResult> {
  if (isApiMode()) return S.getConnectResult(businessId);
  return request(() => {
    const business = coreTx.get('businesses', businessId);
    const meta = readArea(AREA).bizMeta[businessId];
    const promo = meta?.promoCodeId ? readArea(AREA).promoCodes.find((p) => p.id === meta.promoCodeId) : undefined;
    return {
      businessId,
      name: business.name,
      slug: business.slug,
      kind: business.kind,
      ownerPhone: business.phone,
      freeUntil: meta?.freeUntil,
      services: coreTx.list('services', { businessId }).length,
      staff: coreTx.list('staff', { businessId }).length,
      photos: business.photos.length,
      promoCode: promo?.code,
      ...catalogState(business.ownerStaffId),
    };
  }, PANEL);
}
