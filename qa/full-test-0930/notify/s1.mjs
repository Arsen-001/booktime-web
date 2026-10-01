import { withBrowser, newPage, go, text, shot } from './lib.mjs';
await withBrowser(async (b) => {
  const p = await newPage(b);
  for (const [path, name] of [['/biz/notifications','types'],['/biz/notifications/types/1','type1'],['/biz/notifications/types/73','type73'],['/biz/notifications/channels','channels'],['/biz/notifications/log','log']]) {
    await go(p, path);
    await shot(p, 'd-' + name);
    console.log('=====', path, '\n', (await text(p)).slice(0, 3500));
  }
  console.log('ERR', p.errors);
});
