const { page } = await L.newPage(browser, { persona: 'owner' });
state.owner = page;
await L.go(page, '/biz/services');
log((await page.innerText('main')).slice(0, 1500));
await L.shot(page, 'services', '01-catalog-desktop');
await L.go(page, '/biz/services/new');
log((await L.controls(page)).join('\n'));
log('ERR', page.errors);
await L.shot(page, 'services', '02-new-desktop');
