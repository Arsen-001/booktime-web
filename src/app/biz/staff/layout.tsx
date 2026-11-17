import { StaffAccessGate } from '@/areas/staff/StaffAccessGate';

// Сотрудники, роли и права — без staff.view закрыты по прямому адресу (кроме своей карточки), по образцу
// src/app/biz/finance/layout.tsx; запросы экранов не уходят на сервер.
export default function StaffLayout({ children }: LayoutProps<'/biz/staff'>) {
  return <StaffAccessGate>{children}</StaffAccessGate>;
}
