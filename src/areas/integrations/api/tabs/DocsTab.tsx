'use client';

/**
 * F-13-054: документация и помощь по API — моковый справочник методов по разделам (у каждого метода —
 * параметры и пример ответа), публичная страница статуса платформы и ссылка «для разработчиков»; адрес
 * поддержки. F-13-058: свой виджет записи — порядок вызовов и пример. F-13-061: флаги уведомлений при
 * записи через API.
 */
import { ExternalLink } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { SectionCard } from '@/ui/SectionCard';

type ParamType = 'id' | 'string' | 'number' | 'date' | 'boolean';

interface ApiParam {
  name: string;
  type: ParamType;
  required: boolean;
}

interface ApiMethod {
  id: string;
  group: (typeof METHOD_GROUPS)[number];
  verb: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  params: ApiParam[];
  example: unknown;
}

const METHOD_GROUPS = ['bookings', 'clients', 'services', 'staff', 'schedule', 'reports'] as const;

const METHODS: ApiMethod[] = [
  {
    id: 'bookings_list',
    group: 'bookings',
    verb: 'GET',
    path: '/api/v1/bookings',
    params: [
      { name: 'date_from', type: 'date', required: false },
      { name: 'date_to', type: 'date', required: false },
      { name: 'staff_id', type: 'id', required: false },
      { name: 'page', type: 'number', required: false },
    ],
    example: {
      data: [{ id: 501, staff_id: 7, client_id: 12, service_id: 42, start: '2026-09-26T14:00:00+04:00', status: 'confirmed' }],
      meta: { page: 1, total: 128 },
    },
  },
  {
    id: 'bookings_get',
    group: 'bookings',
    verb: 'GET',
    path: '/api/v1/bookings/{booking_id}',
    params: [{ name: 'booking_id', type: 'id', required: true }],
    example: { id: 501, staff_id: 7, client_id: 12, service_id: 42, start: '2026-09-26T14:00:00+04:00', status: 'confirmed' },
  },
  {
    id: 'bookings_create',
    group: 'bookings',
    verb: 'POST',
    path: '/api/v1/bookings',
    params: [
      { name: 'staff_id', type: 'id', required: true },
      { name: 'service_id', type: 'id', required: true },
      { name: 'client_id', type: 'id', required: false },
      { name: 'date', type: 'date', required: true },
      { name: 'comment', type: 'string', required: false },
    ],
    example: { id: 502, status: 'confirmed', start: '2026-09-26T15:00:00+04:00' },
  },
  {
    id: 'bookings_update',
    group: 'bookings',
    verb: 'PUT',
    path: '/api/v1/bookings/{booking_id}',
    params: [
      { name: 'booking_id', type: 'id', required: true },
      { name: 'date', type: 'date', required: false },
      { name: 'comment', type: 'string', required: false },
    ],
    example: { id: 502, status: 'confirmed', start: '2026-09-26T16:00:00+04:00' },
  },
  {
    id: 'bookings_cancel',
    group: 'bookings',
    verb: 'DELETE',
    path: '/api/v1/bookings/{booking_id}',
    params: [{ name: 'booking_id', type: 'id', required: true }],
    example: { id: 502, status: 'cancelled' },
  },
  {
    id: 'bookings_slots',
    group: 'bookings',
    verb: 'GET',
    path: '/api/v1/slots',
    params: [
      { name: 'staff_id', type: 'id', required: true },
      { name: 'date', type: 'date', required: true },
    ],
    example: { staff_id: 7, date: '2026-09-26', slots: ['10:00', '10:30', '14:00'] },
  },
  {
    id: 'clients_list',
    group: 'clients',
    verb: 'GET',
    path: '/api/v1/clients',
    params: [
      { name: 'phone', type: 'string', required: false },
      { name: 'page', type: 'number', required: false },
    ],
    example: { data: [{ id: 12, name: 'Анна', phone: '+37455000000' }], meta: { page: 1, total: 340 } },
  },
  {
    id: 'clients_get',
    group: 'clients',
    verb: 'GET',
    path: '/api/v1/clients/{client_id}',
    params: [{ name: 'client_id', type: 'id', required: true }],
    example: { id: 12, name: 'Анна', phone: '+37455000000', visits: 14 },
  },
  {
    id: 'clients_create',
    group: 'clients',
    verb: 'POST',
    path: '/api/v1/clients',
    params: [
      { name: 'name', type: 'string', required: true },
      { name: 'phone', type: 'string', required: true },
    ],
    example: { id: 341, name: 'Гоар', phone: '+37477000000' },
  },
  {
    id: 'clients_update',
    group: 'clients',
    verb: 'PUT',
    path: '/api/v1/clients/{client_id}',
    params: [
      { name: 'client_id', type: 'id', required: true },
      { name: 'name', type: 'string', required: false },
      { name: 'phone', type: 'string', required: false },
    ],
    example: { id: 341, name: 'Гоар', phone: '+37477000001' },
  },
  {
    id: 'clients_visits',
    group: 'clients',
    verb: 'GET',
    path: '/api/v1/clients/{client_id}/visits',
    params: [{ name: 'client_id', type: 'id', required: true }],
    example: { data: [{ booking_id: 480, date: '2026-08-14', service_id: 42, staff_id: 7 }] },
  },
  {
    id: 'services_list',
    group: 'services',
    verb: 'GET',
    path: '/api/v1/services',
    params: [{ name: 'category_id', type: 'id', required: false }],
    example: { data: [{ id: 42, name: 'Маникюр', category_id: 3, price_from: 5000, price_to: 8000, duration_min: 60 }] },
  },
  {
    id: 'services_get',
    group: 'services',
    verb: 'GET',
    path: '/api/v1/services/{service_id}',
    params: [{ name: 'service_id', type: 'id', required: true }],
    example: { id: 42, name: 'Маникюр', category_id: 3, price_from: 5000, price_to: 8000, duration_min: 60 },
  },
  {
    id: 'services_categories',
    group: 'services',
    verb: 'GET',
    path: '/api/v1/service-categories',
    params: [],
    example: { data: [{ id: 3, name: 'Ногти' }, { id: 4, name: 'Волосы' }] },
  },
  {
    id: 'services_staff',
    group: 'services',
    verb: 'GET',
    path: '/api/v1/services/{service_id}/staff',
    params: [{ name: 'service_id', type: 'id', required: true }],
    example: { data: [{ id: 7, name: 'Марине' }] },
  },
  {
    id: 'staff_list',
    group: 'staff',
    verb: 'GET',
    path: '/api/v1/staff',
    params: [{ name: 'service_id', type: 'id', required: false }],
    example: { data: [{ id: 7, name: 'Марине', specialization: 'Мастер маникюра' }] },
  },
  {
    id: 'staff_get',
    group: 'staff',
    verb: 'GET',
    path: '/api/v1/staff/{staff_id}',
    params: [{ name: 'staff_id', type: 'id', required: true }],
    example: { id: 7, name: 'Марине', specialization: 'Мастер маникюра' },
  },
  {
    id: 'staff_schedule',
    group: 'staff',
    verb: 'GET',
    path: '/api/v1/staff/{staff_id}/schedule',
    params: [
      { name: 'staff_id', type: 'id', required: true },
      { name: 'date_from', type: 'date', required: false },
      { name: 'date_to', type: 'date', required: false },
    ],
    example: { staff_id: 7, days: [{ date: '2026-09-26', from: '10:00', to: '19:00' }] },
  },
  {
    id: 'schedule_business',
    group: 'schedule',
    verb: 'GET',
    path: '/api/v1/schedule/business',
    params: [],
    example: { days: [{ weekday: 1, from: '10:00', to: '20:00' }] },
  },
  {
    id: 'schedule_staff',
    group: 'schedule',
    verb: 'GET',
    path: '/api/v1/schedule/staff/{staff_id}',
    params: [{ name: 'staff_id', type: 'id', required: true }],
    example: { staff_id: 7, days: [{ weekday: 1, from: '10:00', to: '19:00' }] },
  },
  {
    id: 'schedule_exceptions',
    group: 'schedule',
    verb: 'GET',
    path: '/api/v1/schedule/exceptions',
    params: [
      { name: 'date_from', type: 'date', required: false },
      { name: 'date_to', type: 'date', required: false },
    ],
    example: { data: [{ staff_id: 7, date: '2026-10-01', closed: true }] },
  },
  {
    id: 'reports_revenue',
    group: 'reports',
    verb: 'GET',
    path: '/api/v1/reports/revenue',
    params: [
      { name: 'date_from', type: 'date', required: true },
      { name: 'date_to', type: 'date', required: true },
    ],
    example: { total: 4820000, currency: 'AMD', by_day: [{ date: '2026-09-25', amount: 210000 }] },
  },
  {
    id: 'reports_attendance',
    group: 'reports',
    verb: 'GET',
    path: '/api/v1/reports/attendance',
    params: [
      { name: 'date_from', type: 'date', required: true },
      { name: 'date_to', type: 'date', required: true },
    ],
    example: { bookings: 96, no_shows: 4, cancellations: 7 },
  },
];

const WIDGET_EXAMPLE = `GET /api/v1/services
GET /api/v1/staff?service_id=42
GET /api/v1/slots?staff_id=7&date=2026-09-26
POST /api/v1/bookings { "staff_id": 7, "service_id": 42, "start": "2026-09-26T14:00:00+04:00" }`;

const VERB_TONE: Record<ApiMethod['verb'], 'success' | 'info' | 'warning' | 'danger'> = {
  GET: 'info',
  POST: 'success',
  PUT: 'warning',
  DELETE: 'danger',
};

// api.docs.method.<id>.desc и api.docs.param.<name> — ключи собраны из данных METHODS выше, не литералами,
// поэтому t() здесь берётся как обычная функция строка→строка (без потери проверки остальных вызовов t() в
// файле — они по-прежнему литеральные и проверяются компилятором).
function MethodDoc({ method, t }: { method: ApiMethod; t: ReturnType<typeof useT<'integrations'>> }) {
  const tAny = t as unknown as (key: string, values?: Record<string, unknown>) => string;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={VERB_TONE[method.verb]}>{method.verb}</Badge>
        <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-fg">{method.path}</code>
      </div>
      <p className="text-sm text-fg">{tAny(`api.docs.method.${method.id}.desc`)}</p>

      {method.params.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted">{t('api.docs.paramsLabel')}</p>
          <ul className="flex flex-col gap-1">
            {method.params.map((p) => (
              <li key={p.name} className="flex flex-wrap items-baseline gap-1.5 text-xs text-fg">
                <code className="rounded bg-surface-3 px-1 py-0.5 font-mono">{p.name}</code>
                <span className="text-muted">
                  {p.type}
                  {p.required ? `, ${t('api.docs.required')}` : `, ${t('api.docs.optional')}`}
                </span>
                <span className="text-muted">— {tAny(`api.docs.param.${p.name}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-muted">{t('api.docs.responseLabel')}</p>
        <pre className="overflow-x-auto rounded-lg bg-surface-3 p-2 font-mono text-xs text-fg">{JSON.stringify(method.example, null, 2)}</pre>
      </div>
    </div>
  );
}

export function DocsTab() {
  const t = useT('integrations');

  return (
    <div data-f="F-13-054 F-13-058 F-13-061" className="flex flex-col gap-4">
      <SectionCard title={t('api.docs.methodsTitle')} description={t('api.docs.methodsHint')}>
        <Accordion
          items={METHOD_GROUPS.map((g) => {
            const methods = METHODS.filter((m) => m.group === g);
            return {
              id: g,
              title: (
                <span className="flex items-center gap-2">
                  {t(`api.docs.group.${g}.title`)}
                  <Badge tone="neutral">{t(`api.docs.group.${g}.methodsCount`)}</Badge>
                </span>
              ),
              content: (
                <div className="flex flex-col gap-3">
                  {methods.map((m) => (
                    <MethodDoc key={m.id} method={m} t={t} />
                  ))}
                </div>
              ),
            };
          })}
          variant="plain"
        />
      </SectionCard>

      <SectionCard title={t('api.docs.widgetTitle')} description={t('api.docs.widgetHint')}>
        <pre className="overflow-x-auto rounded-lg bg-surface-3 p-3 font-mono text-xs text-fg">{WIDGET_EXAMPLE}</pre>
      </SectionCard>

      <SectionCard title={t('api.docs.aiAgentsTitle')} description={t('api.docs.aiAgentsHint')} data-f="F-13-107">
        <p className="text-sm text-fg">{t('api.docs.aiAgentsText')}</p>
      </SectionCard>

      <SectionCard title={t('api.docs.notifyFlagsTitle')} description={t('api.docs.notifyFlagsHint')}>
        <ul className="flex flex-col gap-1.5 text-sm text-fg">
          <li>
            <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">notify_client</code> — {t('api.docs.notifyClient')}
          </li>
          <li>
            <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs">notify_staff</code> — {t('api.docs.notifyStaff')}
          </li>
        </ul>
      </SectionCard>

      <SectionCard title={t('api.docs.statusTitle')} description={t('api.docs.statusHint')}>
        <div className="flex flex-col gap-2">
          <a
            href="/biz/integrations/api/status"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
          >
            {t('api.docs.statusLink')}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a
            href="/biz/integrations/developers"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
          >
            {t('api.docs.developersLink')}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </SectionCard>

      <SectionCard
        title={t('api.docs.marketplaceProtocolTitle')}
        description={t('api.docs.marketplaceProtocolHint')}
        data-f="F-13-039 F-13-043 F-13-044 F-13-105"
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm font-medium text-fg">{t('api.docs.activationTitle')}</p>
            <pre className="overflow-x-auto rounded-lg bg-surface-3 p-2 font-mono text-xs text-fg">
              {'POST https://app.example.am/marketplace/partner/callback\nAuthorization: Bearer <Partner Token>\n{ "salon_id": 123, "application_id": 45 }'}
            </pre>
            <p className="mt-1 text-xs text-muted">{t('api.docs.activationHint')}</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-fg">{t('api.docs.paySubscriptionTitle')}</p>
            <p className="text-xs text-muted">{t('api.docs.paySubscriptionHint')}</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-fg">{t('api.docs.refundTitle')}</p>
            <p className="text-xs text-muted">{t('api.docs.refundHint')}</p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-fg">{t('api.docs.telephonyPublishTitle')}</p>
            <p className="text-xs text-muted">{t('api.docs.telephonyPublishHint')}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('api.docs.supportTitle')}>
        <p className="text-sm text-fg">{t('api.docs.supportText')}</p>
      </SectionCard>
    </div>
  );
}
