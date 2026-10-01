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
import { useApiIdentity } from '@/api/identity';
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
    const ready = dbReady && (identityResolved || dataMode() !== 'api');
    return { ...ctx, ready, locationId, activeLocationIds };
  }, [ctxJson, selected, dbReady, identityResolved]);
}

export function usePermissions(): ReadonlySet<Permission> {
  const { persona } = useDemo();
  const { staffId } = useCurrent();
  const override = useDb((s) => (staffId ? s.access.staffPermissions[staffId] : undefined));
  // Живой сайт: права считает сервер (шаблон роли + галочки владельца, docs/backend/03 §2)
  const serverPermissions = useApiIdentity((s) => s.identity?.permissions);
  return useMemo(() => {
    if (serverPermissions && persona !== 'client' && persona !== 'guest' && persona !== 'platform') return new Set(serverPermissions);
    const list = persona === 'admin' && override ? override : PERSONA_PERMISSIONS[persona];
    return new Set(list);
  }, [persona, override, serverPermissions]);
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
