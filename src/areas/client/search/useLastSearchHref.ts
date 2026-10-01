'use client';

import { useSyncExternalStore } from 'react';
import { LAST_SEARCH_KEY } from '@/areas/client/search/searchState';

const noopSubscribe = () => () => {};

function read(): string {
  try {
    const url = sessionStorage.getItem(LAST_SEARCH_KEY);
    return url?.startsWith('/search') ? url : '/search';
  } catch {
    return '/search';
  }
}

/** «Назад к поиску» — туда же, с теми же фильтрами, откуда пришли (поиск пишет адрес в sessionStorage) */
export function useLastSearchHref(): string {
  return useSyncExternalStore(noopSubscribe, read, () => '/search');
}
