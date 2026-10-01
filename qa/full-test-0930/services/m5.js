const page = state.m;
await L.go(page, '/biz/services/templates'); await page.waitForTimeout(1500);
log((await page.innerText('main')).replace(/\n\s*\n+/g, '\n').slice(0, 1500));
log((await L.controls(page)).filter(x => !x.startsWith('a#')).slice(4, 40).join('\n'));
await L.shot(page, 'services', 't01-templates');
