import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
console.log(Object.keys(db).slice(0, 40));
