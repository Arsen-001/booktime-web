'use client';

/**
 * Хуки демо-контекста — ими разделы узнают «кто я, где я, что мне можно».
 *   useDemo()        — настройки: persona, sphere, lang, theme, font, api
 *   useCurrent()     — кто я в данных: appUserId / staffId / businessId / locationIds + выбранный филиал
 *   useCan(perm)     — есть ли право (персона + права администратора, заданные владельцем)
 *   useSphere()      — сфера и её функции: has('palette')
 *   useTerms()       — слова сферы: «клиент/пациент», «мастер/врач/тренер» (F-00-148)
 */
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useApiIdentity, useFrozenBusiness } from '@/api/identity';
import { dataMode } from '@/api/mode';
import { PERSONA_PERMISSIONS, type Permission } from '@/config/permissions';
import { SPHERES, type SphereFeature } from '@/config/spheres';
import type { Id } from '@/domain/core';
import { resolveDemoContext, type DemoContext } from '@/demo/context';
import { useDemoContext } from '@/demo/DemoProvider';
import { identityOf } from '@/demo/settings';
import { useDemoStore } from '@/demo/store';
import { useDb, useDbStatus } from '@/mock/db';

/** Демо-настройки: persona, sphere, lang, theme, font, api */
export function useDemo() {
  return useDemoContext().settings;
}

/** Сменить демо-настройки (для переключателя и экранов «нет доступа») */
export function useApplyDemo() {
  return useDemoContext().apply;
}

export interface CurrentContext extends DemoContext {
  /** База поднята и контекст посчитан. До этого id пустые — не запускайте запросы (enabled: ready). */
  ready: boolean;
  /** Выбранный в верхней полосе филиал; 'all' — все доступные */
  locationId: Id | 'all' | undefined;
  /** Филиалы с учётом выбора: для 'all' — все доступные, иначе один */
  activeLocationIds: Id[];
}

export function useCurrent(): CurrentContext {
  const { persona, sphere, appUser, empty } = useDemo();
  const dbReady = useDbStatus((s) => s.ready);
  // Подписка строкой, а не на всё ядро: любая запись (статус записи, новый клиент) меняла s.core, и
  // перерисовывались ВСЕ экраны с useCurrent. Строка меняется только когда меняется сам контекст.
  // Кто вошёл в приложение и «пустой бизнес» — из настроек (те же cookie читает currentActor в api/core)
  const api = useApiIdentity((s) => s.identity);
  // Живой сайт: пока сессия сервера не прочитана, «кто я» неизвестен — экраны не запускают запросы (enabled: ready)
  const identityResolved = useApiIdentity((s) => s.resolved);
  const apiBusinessId = useApiIdentity((s) => s.identity?.businessId);
  const mirrored = useApiIdentity((s) => s.mirrored);
  const selected = useDemoStore((s) => s.locationId);
  const selectedNetwork = useDemoStore((s) => s.networkId);
  // Выбранный филиал — в контекст: у сети текущий бизнес = бизнес этого филиала (Сеть2)
  const ctxJson = useDb((s) => JSON.stringify(resolveDemoContext(persona, sphere, s.core, identityOf({ appUser, empty }), api, selected, selectedNetwork)));
  return useMemo(() => {
    const ctx = JSON.parse(ctxJson) as DemoContext;
    // Владелец сети по умолчанию видит все филиалы вместе (F-00-049)
    const fallback = ctx.networkId && ctx.locationIds.length > 1 ? 'all' : ctx.locationIds[0];
    const locationId =
      (selected === 'all' && ctx.networkId) || (selected && selected !== 'all' && ctx.locationIds.includes(selected))
        ? selected
        : fallback;
    const activeLocationIds = locationId === 'all' ? ctx.locationIds : locationId ? [locationId] : [];
    // Кабинет на живом сайте ждёт и первого зеркала своего бизнеса (useApiIdentity.mirrored)
    const ready = dbReady && (dataMode() !== 'api' || (identityResolved && (!apiBusinessId || mirrored === apiBusinessId)));
    return { ...ctx, ready, locationId, activeLocationIds };
  }, [ctxJson, selected, dbReady, identityResolved, apiBusinessId, mirrored]);
}

/**
 * Права изменений, которые снимает заморозка подписки (кабинет «только просмотр», сервер отвечает 423): только те,
 * что закрывают кнопки и формы, а не целые разделы меню (loyalty.manage, notify.*, payroll.manage, staff.manage
 * открывают и сами страницы — там остаётся подпись полосы заморозки и понятный ответ сервера). journal.edit не
 * снимаем: «Пришёл / Не пришёл» в заморозке можно (06 §3.4) — остальное в окне записи закрывает useWindowRights.
 */
const FROZEN_BLOCKED: ReadonlySet<Permission> = new Set<Permission>([
  'journal.create',
  'journal.reschedule',
  'clients.edit',
  'clients.delete',
  'schedule.edit',
  'services.edit',
  'stock.edit',
  'finance.edit',
  'loyalty.applyWithoutCode',
  'network.addLocation',
]);

/** Кабинет только для просмотра: подписка текущего бизнеса заморожена */
export function useReadOnly(): boolean {
  const { businessId, locationId } = useCurrent();
  const frozen = useFrozenBusiness((s) => Boolean(businessId) && s.businessId === businessId);
  // Сеть, «Все филиалы»: текущий бизнес — главный филиал, но записывать можно в любой незамороженный — кнопки
  // остаются, а замороженный филиал ответит понятным 423 (Manana: Нор-Норк заморожен, Шенгавит работает)
  return frozen && locationId !== 'all';
}

function useBasePermissions(): readonly Permission[] {
  const { persona } = useDemo();
  const { staffId } = useCurrent();
  const override = useDb((s) => (staffId ? s.access.staffPermissions[staffId] : undefined));
  // Живой сайт: права считает сервер (шаблон роли + галочки владельца, docs/backend/03 §2)
  const serverPermissions = useApiIdentity((s) => s.identity?.permissions);
  if (serverPermissions && persona !== 'client' && persona !== 'guest' && persona !== 'platform') return serverPermissions;
  return persona === 'admin' && override ? override : PERSONA_PERMISSIONS[persona];
}

export function usePermissions(): ReadonlySet<Permission> {
  const base = useBasePermissions();
  const frozen = useReadOnly();
  return useMemo(() => new Set(frozen ? base.filter((p) => !FROZEN_BLOCKED.has(p)) : base), [base, frozen]);
}

/**
 * Право есть, но заморозка его сняла: такую кнопку показываем неактивной с подписью «только просмотр»
 * (журнал: «Записать»), а не прячем — человек видит, почему не может.
 */
export function useBlockedByFreeze(permission: Permission): boolean {
  const base = useBasePermissions();
  const frozen = useReadOnly();
  return frozen && FROZEN_BLOCKED.has(permission) && base.includes(permission);
}

export function useCan(permission: Permission): boolean {
  return usePermissions().has(permission);
}

export function useSphere() {
  const { sphere } = useDemo();
  const config = SPHERES[sphere];
  return {
    id: sphere,
    config,
    has: (feature: SphereFeature) => config.features.includes(feature),
  };
}

export interface Terms {
  client: string;
  clients: string;
  master: string;
  masters: string;
}

/** Слова сферы: у стоматолога «пациент/врач», у тренера «тренер» (F-00-148) */
export function useTerms(): Terms {
  // Хук фундамента: ключ собирается по сфере, поэтому здесь прямой useTranslations (разделам — useT)
  const t = useTranslations('common.terms');
  const { config } = useSphere();
  const set = config.terms;
  return {
    client: t(`${set}.client`),
    clients: t(`${set}.clients`),
    master: t(`${set}.master`),
    masters: t(`${set}.masters`),
  };
}
