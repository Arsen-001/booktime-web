const page = state.owner;
await L.go(page, '/biz/journal?new=1&staff=st_nuri_ani&date=2026-10-02&start=11%3A00&services=sv_muol23xgp3l7nm');
await page.waitForTimeout(2500);
const dlg = page.locator('[role=dialog]').last();
log((await dlg.innerText().catch(()=>'no dialog')).slice(0, 1500));
log('ERR', page.errors);
await L.shot(page, 'services', 's04-journal-newbooking');
