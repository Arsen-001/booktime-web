export default async (t, log) => {
  await t.go('owner', '/biz/stock');
  const db = await t.db();
  const S = db.areas?.stock;
  log('keys', Object.keys(db), Object.keys(db.areas||{}).slice(0,30));
  const biz = S.goods.find(g=>g.id.startsWith('gd_')).businessId;
  const bizGoods = S.goods.filter(g=>g.businessId===biz);
  for (const g of bizGoods) {
    const byType = {};
    for (const o of S.operations) if (o.businessId===biz) for (const l of o.lines) if (l.goodId===g.id) { const k=o.type+(o.autoWriteoff?'-auto':''); byType[k]=+((byType[k]||0)+l.qtySale).toFixed(3); }
    log(g.name, g.locationId, 'crit', g.criticalStock, 'exp', g.expiryDate, JSON.stringify(byType));
  }
  const arrived = db.core.bookings.filter(b=>b.businessId===biz && b.status==='arrived').length;
  log('biz', biz, 'arrived bookings', arrived, 'techcards', S.techCards.filter(c=>c.businessId===biz).map(c=>c.serviceId+'/'+c.staffId+':'+JSON.stringify(c.lines)).join(' | '));
};
