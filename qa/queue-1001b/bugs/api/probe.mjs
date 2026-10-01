import { login } from './lib.mjs';
const o = await login('+37400110001', 'business');
console.log(o.status, JSON.stringify(o.body).slice(0, 400));
