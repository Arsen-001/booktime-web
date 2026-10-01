const page = state.m;
await L.as(page, 'owner');
await L.go(page, '/biz/services/photos'); await page.waitForTimeout(2000);
log((await page.innerText('main')).replace(/\n\s*\n+/g, '\n').slice(0, 1500));
log((await L.controls(page)).filter(x => !x.startsWith('a#')).slice(4, 50).join('\n'));
await L.shot(page, 'services', 'ph01-photos');
log('ERR', page.errors.splice(0));
