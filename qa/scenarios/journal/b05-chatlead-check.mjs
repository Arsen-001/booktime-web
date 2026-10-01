import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://localhost:3710/biz/clients?demo=owner&sphere=nails&lang=ru', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    const clients = db.core.clients ?? [];
    const leads = clients.filter((c) => c.category === 'Chat lead' || (c.categories ?? []).includes('Chat lead') || /chat.?lead/i.test(JSON.stringify(c.category ?? c.categories ?? '')));
    return { total: clients.length, leadsFound: leads.length, sample: leads[0] };
  });
  console.log(JSON.stringify(res, null, 2));
  await browser.close();
} finally { release(); }
