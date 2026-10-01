import { start, log } from './h.mjs';
const h = await start();
try {
  await h.go('/b/kaytsak-barbershop', 'guest');
  await h.shot('s1-public-phone');
  log('PUBLIC:', (await h.text()).slice(0, 1500));
  const db = await h.db();
  log('keys', Object.keys(db), Object.keys(db.areas ?? {}).slice(0, 40));
  const erik = db.core.staff.find((s) => s.id.includes('erik'));
  log('erik', erik.id, JSON.stringify(erik.prepayment), erik.confirmMode);
  log('rules', JSON.stringify(db.areas.online.staffRules[erik.id]));
  await h.go('/b/kaytsak-barbershop/book', 'guest');
  await h.shot('s1-book-phone');
  log('BOOK:', (await h.text()).slice(0, 1500));
  log('errors', h.errors);
} finally { await h.end(); }
