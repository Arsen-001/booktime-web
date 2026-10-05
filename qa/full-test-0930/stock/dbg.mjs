import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@': root + '/src' } });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// Сид — отдельный кусок, загружается лениво (src/mock/db.ts, 05.10.2026): createSeedData работает только после bootDb().
// Срезы и сид — заранее: иначе ленивый import('@/mock/slices') внутри db.ts под jiti ловит цикл импортов (SLICES undefined).
await jiti.import('@/mock/slices');
await jiti.import('@/mock/seed');
const { bootDb, createSeedData } = await jiti.import(root + '/src/mock/db.ts');
const warn = console.warn;
console.warn = () => {}; // в node нет localStorage-хранилища zustand — «не удалось прочитать сохранённые данные» ожидаемо
await bootDb();
console.warn = warn;
const d = createSeedData(new Date());
const fin = d.areas.finance.operations.filter((o) => o.amount === 6500 || o.amount === 9800).map((o) => [o.businessId, o.amount, o.date, o.partyName, o.refId]);
console.log(fin.slice(0, 6));
const st = d.areas.stock.operations.filter((o) => o.type === 'sale' && o.id.endsWith('_sale')).map((o) => [o.businessId, o.lines[0].unitPrice, o.date, d.core.clients.find((c) => c.id === o.clientId)?.name, o.bookingId]);
console.log(st.slice(0, 6));
