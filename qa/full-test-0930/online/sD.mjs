// D: ссылки (создать/копировать/QR/удалить), «Кого позвать», виджет, публичная страница, пусто/ошибка/en
import { start, log } from './h.mjs';
const h = await start({ device: 'desktop' });
const p = h.page;
const dump = async (tag, n = 900) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); await h.shot('D-fail-' + name); } };
await step('links', async () => {
  await h.go('/biz/online', 'owner');
  await h.shot('D1-links-desktop');
  await dump('D1 links:', 1200);
  const before = (await h.db()).areas.online.links?.length;
  await p.getByRole('button', { name: 'Новая ссылка' }).first().click(); await h.settle(500);
  await h.shot('D1-new-link-sheet');
  await p.getByPlaceholder('Например, «Форма для Instagram»').fill('QA Инстаграм');
  await p.getByRole('button', { name: 'Создать' }).last().click(); await h.settle(800);
  let db = await h.db();
  log('D1 links count', before, '→', db.areas.online.links?.length, (db.areas.online.links ?? []).map((l) => l.name).join(', '));
  await dump('D1 after create:', 600);
  const card = p.locator('[data-f~="F-03-003"], article, li').filter({ hasText: 'QA Инстаграм' }).last();
  await card.getByRole('button', { name: /QR/ }).first().click().catch((e) => log('D1 qr btn', e.message.split('\n')[0]));
  await h.settle(800); await h.shot('D1-qr');
  await p.keyboard.press('Escape'); await h.settle(300);
  // удалить через меню «⋯»
  const more = card.getByRole('button', { name: /Ещё|Действия|⋯|More/ });
  log('D1 more buttons', await more.count());
  if (await more.count()) { await more.first().click(); await h.settle(300); }
  const del = p.getByRole('menuitem', { name: 'Удалить ссылку' }).or(p.getByRole('button', { name: 'Удалить ссылку' }));
  log('D1 delete items', await del.count());
  if (await del.count()) {
    await del.first().click(); await h.settle(400);
    await p.getByRole('button', { name: 'Удалить', exact: true }).last().click(); await h.settle(800);
    db = await h.db();
    log('D1 after delete', (db.areas.online.links ?? []).map((l) => l.name).join(', '));
  }
});
await step('invite', async () => {
  await h.go('/biz/online/requests', 'owner');
  await h.shot('D2-requests-invite', true);
  const sec = p.locator('[data-f~="F-03-052"]');
  log('D2 invite section:', (await sec.count()) ? (await sec.first().innerText()).replace(/\n+/g, ' | ').slice(0, 1500) : 'нет секции');
});
await step('widget', async () => {
  await h.go('/biz/online/widget', 'owner'); await h.shot('D3-widget'); await dump('D3 widget:', 600);
  await h.go('/biz/online/page', 'owner'); await h.shot('D3-page'); await dump('D3 page:', 600);
  await h.go('/biz/online/places', 'individual'); await h.shot('D3-places-individual'); await dump('D3 places:', 600);
  await h.go('/b/nuri-nail-studio/embed', 'guest'); await h.shot('D3-embed'); await dump('D3 embed:', 400);
});
await step('public', async () => {
  await h.setDevice('phone');
  await h.go('/b/nuri-nail-studio', 'guest'); await h.shot('D4-public-phone', true); await dump('D4 public:', 800);
  await h.go('/b/nuri-nail-studio/about', 'guest'); await h.shot('D4-about-phone', true); await dump('D4 about:', 500);
  await h.go('/b/nuri-nail-studio/me', 'guest'); await h.shot('D4-me-phone'); await dump('D4 me:', 400);
  await h.go('/b/nuri-nail-studio/book', 'guest'); await h.shot('D4-book-phone'); await dump('D4 book:', 500);
  await h.go('/b/nuri-nail-studio/booking/bk_nope?h=zzz', 'guest'); await h.shot('D4-booking-notfound'); await dump('D4 notfound:', 300);
  await h.go('/b/no-such-slug', 'guest'); await h.shot('D4-slug-notfound'); await dump('D4 bad slug:', 300);
  await h.go('/b/novyi-salon', 'guest'); await h.shot('D4-empty-business'); await dump('D4 novyi-salon:', 400);
});
await step('states', async () => {
  await h.go('/b/nuri-nail-studio/book', 'guest', '&lang=en'); await h.shot('D5-book-en'); await dump('D5 en:', 500);
  await h.go('/b/nuri-nail-studio', 'guest', '&api=error'); await h.shot('D5-public-error'); await dump('D5 api=error public:', 400);
  await h.setDevice('desktop');
  await h.go('/biz/online', 'owner', '&api=error'); await h.shot('D5-links-error'); await dump('D5 api=error links:', 400);
  await h.go('/biz/online?empty=1', 'owner', '&api=normal'); await h.shot('D5-links-empty'); await dump('D5 empty links:', 500);
  await h.go('/biz/online/requests?empty=1', 'owner'); await h.shot('D5-requests-empty'); await dump('D5 empty requests:', 500);
  await h.go('/biz/online/settings?empty=1', 'owner'); await h.shot('D5-settings-empty'); await dump('D5 empty settings:', 500);
  await h.go('/biz/online/places?empty=1', 'individual'); await h.shot('D5-places-empty'); await dump('D5 empty places:', 500);
  await h.go('/biz/online?empty=0', 'owner');
});
log('errors', h.errors.slice(0, 15));
await h.end();
