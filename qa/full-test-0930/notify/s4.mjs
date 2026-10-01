import { withBrowser, newPage, go, text, shot } from './lib.mjs';
await withBrowser(async (b) => {
  const p = await newPage(b);
  for (const r of ['/biz/notifications/types/1', '/biz/notifications/types/73', '/biz/notifications/types/7', '/biz/notifications/mailings/new', '/biz/notifications/types/73/templates']) {
    await go(p, r, 3000);
    await p.screenshot({ path: `/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/notify/after${r.replace(/\//g, '_')}.png`, fullPage: true });
    const t = await text(p);
    console.log('==', r, 'Подключить x', (t.match(/Подключить/g) || []).length, '| note:', t.includes('подключил нашего бесплатного бота'), '| TG не подключён:', /Telegram\s*\n?\s*Не подключён/.test(t), '| hint:', t.includes('Вставьте {clientName}'));
  }
  console.log('ERRORS', JSON.stringify(p.errors));
});
