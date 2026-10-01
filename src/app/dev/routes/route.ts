import { routesByArea } from '@/config/nav';
import { EXTENSION_PAIRS } from '@/extensions/pairs';
import { seedCore } from '@/mock/seed';

/**
 * Маршруты для замеров (scripts/measure.mjs --area <id>): все пункты меню раздела + примеры
 * динамических адресов из демо-данных + страницы вкладов раздела /dev/ext/<host>/<area>.
 */
export function GET() {
  const areas = routesByArea();
  const core = seedCore(new Date());
  const salon = core.businesses.find((b) => b.kind === 'salon' && !b.networkId) ?? core.businesses[0];
  const client = salon ? core.clients.find((c) => c.businessId === salon.id) : undefined;
  const master = salon ? core.staff.find((s) => s.businessId === salon.id && s.role === 'master') : undefined;
  const service = salon ? core.services.find((s) => s.businessId === salon.id) : undefined;

  const add = (area: string, route: string) => {
    const list = (areas[area] ??= []);
    if (!list.includes(route)) list.push(route);
  };
  if (salon) add('online', `/b/${salon.slug}`);
  if (client) add('clients', `/biz/clients/${client.id}`);
  if (master) add('staff', `/biz/staff/${master.id}`);
  if (service) add('services', `/biz/services/${service.id}`);
  for (const pair of EXTENSION_PAIRS) add(pair.area, `/dev/ext/${pair.host}/${pair.area}`);

  const all = [...new Set(Object.values(areas).flat())];
  return Response.json({
    areas,
    all,
    samples: { slug: salon?.slug, clientId: client?.id, staffId: master?.id, serviceId: service?.id },
  });
}
