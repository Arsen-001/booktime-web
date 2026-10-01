import { start, newPage, go, text } from '../client-2/h.mjs';
const { browser, done } = await start();
try {
  const { page, errors } = await newPage(browser, { device: 'desktop' });
  for (const r of ['/biz/apps/stories', '/biz/apps/reports', '/biz/apps/events']) {
    await go(page, r, 'master');
    console.log(r, (await text(page)).slice(0, 120).replace(/\n/g, ' | '));
  }
  console.log(await page.evaluate(() => document.cookie));
  console.log(errors.slice(0, 5));
} finally { await done(); }
