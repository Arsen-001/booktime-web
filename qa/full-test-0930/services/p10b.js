const page = state.owner;
log(page.url()); const t = await page.innerText('body'); log(t.slice(0, 600)); log('has', t.includes('Чат с поддержкой'));
await L.shot(page, 'services', 'x-inbox');
