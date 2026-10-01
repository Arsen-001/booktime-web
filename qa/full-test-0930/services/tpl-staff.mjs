import * as L from './lib.mjs';
await L.withBrowser(async (browser) => {
  for (const persona of ['owner', 'individual']) {
    const { page } = await L.newPage(browser, { persona, empty: true });
    await L.go(page, '/biz/online'); await page.waitForTimeout(2000);
    const pub = () => page.getByRole('button', { name: /Опубликовать/ }).first();
    console.log(persona, 'before: publish count', await pub().count(), (await pub().count()) ? await pub().isEnabled() : '-');
    await L.go(page, '/biz/services/templates'); await page.waitForTimeout(2000);
    for (const n of ['Снятие покрытия', 'Детский маникюр']) await page.getByRole('checkbox', { name: n }).click().catch((e) => console.log('cb', n, e.message.slice(0, 80)));
    await page.waitForTimeout(400);
    await L.shot(page, 'services', `tpl-${persona}-empty-picked`);
    console.log(persona, (await page.innerText('main')).match(/Выбрано: \d+/)?.[0]);
    await page.getByRole('button', { name: 'Добавить выбранные' }).click(); await page.waitForTimeout(2500);
    await L.go(page, '/biz/services'); await page.waitForTimeout(1500);
    const t = await page.innerText('main');
    console.log(persona, 'catalog Нет мастеров:', t.match(/Нет мастеров\n+(\d+)/)?.[1]);
    await L.go(page, '/biz/online'); await page.waitForTimeout(2500);
    console.log(persona, 'after: publish enabled', (await pub().count()) ? await pub().isEnabled() : 'no button');
    await L.shot(page, 'services', `tpl-${persona}-empty-online`);
    console.log('ERR', page.errors.filter((e) => !e.includes('WebSocket')));
    await page.context().close();
  }
});
