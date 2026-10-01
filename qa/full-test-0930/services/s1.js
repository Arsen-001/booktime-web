const { page } = await L.newPage(browser, { persona: 'owner' });
state.owner = page;
await L.go(page, '/biz/services/new');
await page.waitForTimeout(1500);
log((await page.innerText('main')).slice(0, 2500));
log((await L.controls(page)).filter(x=>!x.startsWith('a#')).join('\n'));
log('ERR', page.errors);
await L.shot(page, 'services', 's01-new-desktop');
