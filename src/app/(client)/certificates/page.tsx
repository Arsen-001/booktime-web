import { redirect } from 'next/navigation';

// /certificates — с 17.11.2026 одна страница «Карты и абонементы» (/cards): старый адрес (закладки, ссылки в приложениях) ведёт туда
export default function Page() {
  redirect('/cards');
}
