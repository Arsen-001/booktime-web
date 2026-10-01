import { call, CLIENT, remember } from './lib.mjs';
const c = await call('owner', 'POST', '/v1/biz/biz_nuri/bookings', { staffId: 'st_nuri_ani', clientId: CLIENT, locationId: 'loc_nuri', start: process.argv[2], durationMin: 45, status: 'scheduled', services: [{ serviceId: 'sv_nuri_classic', qty: 1, price: 5000, staffId: 'st_nuri_ani', durationMin: 45 }], source: 'journal' });
remember('booking', c.d.id); console.log(c.d.id);
