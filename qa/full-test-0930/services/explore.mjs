import { withBrowser, newPage, go, shot, controls } from './lib.mjs';
const path = process.argv[2]; const persona = process.argv[3] || 'owner'; const device = process.argv[4] || 'desktop';
await withBrowser(async (b) => {
  const { page } = await newPage(b, { persona, device });
  await go(page, path);
  console.log((await page.innerText('main').catch(() => page.innerText('body'))).slice(0, 3000));
  console.log('---controls'); console.log((await controls(page)).join('\n'));
  console.log('---errors', page.errors);
  await shot(page, process.argv[5] || 'services', 'explore-' + path.replace(/\W+/g, '_') + '-' + persona + '-' + device);
});
