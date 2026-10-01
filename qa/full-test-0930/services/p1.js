const { page } = await L.newPage(browser, { persona: 'platform' });
state.pl = page;
await L.go(page, '/platform/moderation');
log((await page.innerText('main')).slice(0, 2500));
log((await L.controls(page)).slice(0,80).join('\n'));
log('ERR', page.errors);
await L.shot(page, 'platform', 'm01-moderation-desktop');
