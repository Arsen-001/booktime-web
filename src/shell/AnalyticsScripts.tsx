'use client';

/**
 * Подключение аналитики (03.10.2026, src/lib/analytics.ts): только на живом сайте и без Do Not Track / GPC —
 * иначе ничего не рендерит и ничего не грузит. Vercel Web Analytics — просмотры страниц (свои события — на платном
 * тарифе Vercel); PostHog — воронки, если задан NEXT_PUBLIC_POSTHOG_KEY, отдельным куском после загрузки страницы.
 */
import { useEffect, useState } from 'react';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { track as vercelTrack } from '@vercel/analytics';
import {
  ANALYTICS_DEBUG,
  POSTHOG_HOST,
  POSTHOG_KEY,
  analyticsEnabled,
  captureAttribution,
  flushAnalyticsQueue,
  registerAnalyticsProvider,
  sanitizeUrl,
  vercelProps,
} from '@/lib/analytics';

/** Адрес страницы для Vercel — без строки запроса (кроме utm_*) и без токенов в пути */
function vercelBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = sanitizeUrl(event.url);
  return url ? { ...event, url } : null;
}

/** Свойства PostHog, где лежат адреса: чистим так же */
const URL_PROPS = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer', '$session_entry_url', '$session_entry_referrer', '$prev_pageview_pathname', '$pathname'];

function cleanUrlProps(obj: Record<string, unknown> | undefined): void {
  if (!obj) return;
  for (const k of URL_PROPS) {
    const v = obj[k];
    if (typeof v !== 'string' || !v) continue;
    if (k.endsWith('pathname')) obj[k] = sanitizeUrl(`https://x${v.startsWith('/') ? '' : '/'}${v}`).replace(/^https:\/\/x/, '');
    else if (/^https?:\/\//.test(v)) obj[k] = sanitizeUrl(v);
  }
}

async function startPostHog(): Promise<void> {
  const { default: posthog } = await import('posthog-js');
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Только просмотры страниц (и при переходах внутри приложения) и наши события из track()
    capture_pageview: 'history_change',
    capture_pageleave: false,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    advanced_disable_flags: true,
    // Без профилей людей: никого не опознаём (identify не вызываем) — анонимные события
    person_profiles: 'identified_only',
    // Без cookie: идентификатор браузера — в localStorage, на наш сервер не уходит
    persistence: 'localStorage',
    respect_dnt: true,
    mask_personal_data_properties: true,
    before_send: (event) => {
      if (!event) return null;
      cleanUrlProps(event.properties);
      cleanUrlProps(event.$set as Record<string, unknown> | undefined);
      cleanUrlProps(event.$set_once as Record<string, unknown> | undefined);
      return event;
    },
  });
  registerAnalyticsProvider({ name: 'posthog', track: (event, props) => posthog.capture(event, props) });
}

export function AnalyticsScripts() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (ANALYTICS_DEBUG) captureAttribution();
    if (!analyticsEnabled()) return;
    captureAttribution();
    // Включение после монтирования: Do Not Track / GPC известны только в браузере
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(true);
  }, []);

  // <Analytics/> уже смонтирован (его эффект создал window.va раньше этого) — подключаем провайдеров
  useEffect(() => {
    if (!on) return;
    registerAnalyticsProvider({ name: 'vercel', track: (event, props) => vercelTrack(event, vercelProps(event, props)) });
    if (!POSTHOG_KEY) {
      flushAnalyticsQueue();
      return;
    }
    // После загрузки страницы — PostHog не тормозит первый показ
    const id = window.setTimeout(() => {
      startPostHog()
        .catch(() => undefined)
        .finally(flushAnalyticsQueue);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [on]);

  return on ? <Analytics beforeSend={vercelBeforeSend} /> : null;
}
