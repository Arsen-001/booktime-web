// №2 поиск «стрижка» (мок, jiti): сначала мастера, у которых услуга называется так, окна и ссылка — про стрижку
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const CA = await jiti.import(root + '/src/api/client.ts');
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) process.exitCode = 1; };
for (const q of (process.argv[2] ?? 'стрижка,Стрижки,маникюр,укладка').split(',')) {
  const out = await CA.listCatalog({ search: q });
  console.log(`\n«${q}»: ${out.length}`);
  for (const e of out.slice(0, 12)) console.log(`  ${e.staff.name.padEnd(20)} · ${e.service?.name.ru ?? '—'} · ${e.nearestSlots[0]?.start}`);
  const stem = q.toLowerCase().slice(0, q.length >= 5 ? -1 : undefined);
  const firstMiss = out.findIndex((e) => !e.service?.name.ru.toLowerCase().includes(stem));
  const lastHit = out.map((e) => e.service?.name.ru.toLowerCase().includes(stem)).lastIndexOf(true);
  ok(firstMiss === -1 || lastHit < firstMiss, `«${q}»: совпадения по названию услуги — выше остальных`);
}
const ex = (await CA.listCatalog({ search: 'стрижка' })).find((e) => /стрижк/i.test(e.service?.name.ru ?? ''));
if (ex) {
  const card = await CA.getMasterCard(ex.staff.id, undefined, ex.service.id);
  ok(card.slotService?.id === ex.service.id, `карточка мастера с ?service=: окна под «${card.slotService?.name.ru}»`);
  const plain = await CA.getMasterCard(ex.staff.id);
  console.log('  без service:', plain.slotService?.name.ru);
}
