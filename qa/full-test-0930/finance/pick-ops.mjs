import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const ops = db.useDb.getState().areas.finance.operations.filter((o) => o.businessId === 'biz_atam' && !o.cancelled);
console.log(JSON.stringify({ booking: ops.find((o) => o.source === 'booking' && o.kind === 'income')?.id, manual: ops.find((o) => o.source === 'manual')?.id }));
process.exit(0);
