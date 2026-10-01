// D: ссылки (создать/копировать/QR/удалить), «Кого позвать», виджет, публичная страница, пусто/ошибка/en
import { start, log } from './h.mjs';
const h = await start({ device: 'phone' });
const p = h.page;
const dump = async (tag, n = 900) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); await h.shot('D-fail-' + name); } };
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
  await h.go('/b/nuri-nail-studio/book', 'guest'); await p.getByRole('button', { name: 'Eng' }).first().click().catch(() => {}); await h.settle(800); await h.shot('D5-book-en'); await dump('D5 en:', 500);
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
