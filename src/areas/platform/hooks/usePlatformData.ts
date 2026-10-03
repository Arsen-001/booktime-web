'use client';

/**
 * Чтения нашей панели — ЕДИНСТВЕННОЕ место ключей раздела: каждый хук = один ключ ['platform', '<ресурс>', …параметры]
 * + одна функция api (кэш общий на все экраны; renders.mjs --check-keys читает ключи отсюда).
 * Экраны зовут эти хуки, а не собирают ключи сами. После записи ничего перечитывать не надо — запросы,
 * читавшие изменённые данные, обновятся сами.
 */
import {
  getConnectDraft,
  getConnectResult,
  getDemandReport,
  getModerationCounts,
  getOverview,
  getPaybackInputs,
  getPayingNow,
  getStoryBoard,
  getAdReach,
  getBrand,
  getVisitCounts,
  getProspect,
  listProspects,
  listAdPlacements,
  listAds,
  listAllBusinessesLite,
  listBackupCopies,
  listBusinessesOverview,
  listCallbacks,
  listConnectDrafts,
  listFirstCandidates,
  listIdeas,
  listModerationItems,
  listNameCandidates,
  listPrelaunchItems,
  listPromoCodes,
  listRejectReasons,
  listSphereRequests,
  listSupportTickets,
  listTeam,
  listVisitBusinesses,
  listVisits,
  listWaveItems,
} from '@/api/platform';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { DistrictId, Id } from '@/domain/core';
import type { AdKind, DemandPeriod, ModerationKind, ModerationStatus, ProspectListQuery, SphereRequestKind, SupportChannel, SupportStatus, VisitStatus } from '@/domain/platform';

function useReady(): boolean {
  return useCurrent().ready;
}

export const useOverview = () => useApiQuery(['platform', 'overview'], () => getOverview(), { enabled: useReady() });
export const useTeam = () => useApiQuery(['platform', 'team'], () => listTeam(), { enabled: useReady() });
export const useBusinessesLite = () => useApiQuery(['platform', 'businesses-lite'], () => listAllBusinessesLite(), { enabled: useReady() });

export const useModerationItems = (status: ModerationStatus, kind: ModerationKind | 'all') =>
  useApiQuery(['platform', 'moderation', status, kind], () => listModerationItems({ status, kind: kind === 'all' ? undefined : kind }), { enabled: useReady() });
export const useModerationCounts = () => useApiQuery(['platform', 'moderation-counts'], () => getModerationCounts(), { enabled: useReady() });
export const useRejectReasons = () => useApiQuery(['platform', 'reject-reasons'], () => listRejectReasons(), { enabled: useReady() });

export const useConnectDrafts = () => useApiQuery(['platform', 'connect-drafts'], () => listConnectDrafts(), { enabled: useReady() });
export const useConnectDraft = (id: Id) => useApiQuery(['platform', 'connect-draft', id], () => getConnectDraft(id), { enabled: useReady() && Boolean(id) });
export const useConnectResult = (businessId: Id) =>
  useApiQuery(['platform', 'connect-result', businessId], () => getConnectResult(businessId), { enabled: useReady() && Boolean(businessId) });

export const useVisits = (status: VisitStatus | 'all', district: DistrictId | 'all') =>
  useApiQuery(['platform', 'visits', status, district], () => listVisits({ status: status === 'all' ? undefined : status, district: district === 'all' ? undefined : district }), {
    enabled: useReady(),
  });
export const useVisitCounts = () => useApiQuery(['platform', 'visit-counts'], () => getVisitCounts(), { enabled: useReady() });

/** «Места»: фильтр целиком в ключе (объект), прежняя страница остаётся на экране, пока грузится новая */
export const useProspects = (query: ProspectListQuery) => useApiQuery(['platform', 'prospects', query], () => listProspects(query), { enabled: useReady() });
export const useProspect = (id: Id | null) => useApiQuery(['platform', 'prospect', id], () => getProspect(id ?? ''), { enabled: useReady() && Boolean(id) });
export const useCallbacks = () => useApiQuery(['platform', 'callbacks'], () => listCallbacks(), { enabled: useReady() });

export const usePromoCodes = () => useApiQuery(['platform', 'promocodes'], () => listPromoCodes(), { enabled: useReady() });
export const useVisitBusinesses = () => useApiQuery(['platform', 'visit-businesses'], () => listVisitBusinesses(), { enabled: useReady() });

export const useSupportTickets = (status: SupportStatus | 'active' | 'all', channel: SupportChannel | 'all') =>
  useApiQuery(['platform', 'support', status, channel], () => listSupportTickets({ status: status === 'all' ? undefined : status, channel: channel === 'all' ? undefined : channel }), {
    enabled: useReady(),
  });

export const useDemandReport = (period: DemandPeriod) => useApiQuery(['platform', 'demand', period], () => getDemandReport(period), { enabled: useReady() });
export const useFirstCandidates = () => useApiQuery(['platform', 'first-candidates'], () => listFirstCandidates(), { enabled: useReady() });

export const useAds = (kind: AdKind) => useApiQuery(['platform', 'ads', kind], () => listAds({ kind }), { enabled: useReady() });
export const useAdPlacements = () => useApiQuery(['platform', 'ad-placements'], () => listAdPlacements(), { enabled: useReady() });
export const useAdReach = () => useApiQuery(['platform', 'ad-reach'], () => getAdReach(), { enabled: useReady() });
export const useStoryBoard = (district: DistrictId | 'all') =>
  useApiQuery(['platform', 'story-board', district], () => getStoryBoard(10, district === 'all' ? undefined : district), { enabled: useReady() });

export const useBusinessesOverview = () => useApiQuery(['platform', 'businesses'], () => listBusinessesOverview(), { enabled: useReady() });
export const useBackups = (businessId: Id | undefined) =>
  useApiQuery(['platform', 'backups', businessId ?? ''], () => listBackupCopies(businessId ?? ''), { enabled: useReady() && Boolean(businessId) });

export const useWaveItems = () => useApiQuery(['platform', 'waves'], () => listWaveItems(), { enabled: useReady() });
export const usePrelaunchItems = () => useApiQuery(['platform', 'prelaunch'], () => listPrelaunchItems(), { enabled: useReady() });
export const usePaybackInputs = () => useApiQuery(['platform', 'payback'], () => getPaybackInputs(), { enabled: useReady() });
export const usePayingNow = () => useApiQuery(['platform', 'paying-now'], () => getPayingNow(), { enabled: useReady() });
export const useNameCandidates = () => useApiQuery(['platform', 'name-candidates'], () => listNameCandidates(), { enabled: useReady() });
export const useBrand = () => useApiQuery(['platform', 'brand'], () => getBrand(), { enabled: useReady() });

export const useIdeas = () => useApiQuery(['platform', 'ideas'], () => listIdeas(), { enabled: useReady() });
export const useSphereRequests = (kind: SphereRequestKind) =>
  useApiQuery(['platform', 'sphere-requests', kind], () => listSphereRequests(kind), { enabled: useReady() });
