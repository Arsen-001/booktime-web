const page = state.pl;
for (const r of ['/platform', '/platform/visits', '/platform/demand', '/platform/support', '/platform/businesses', '/platform/sphere-requests']) {
  await L.go(page, r); await page.waitForTimeout(1200);
  log('=====', r, 'ERR', page.errors.splice(0));
  log((await page.innerText('main')).replace(/\n\s*\n+/g, '\n').slice(0, 1200));
  log('--', (await L.controls(page)).filter(x => !x.startsWith('a#[] "') || !x.includes('->/platform')).slice(0, 40).join('\n'));
  await L.shot(page, 'platform', 'r' + r.replace(/\W+/g, '_'));
}
