import { StaffSchemeScreen } from '@/areas/payroll/StaffSchemeScreen';

// /biz/payroll/staff/[staffId] — редактор схемы сотрудника (F-09-010…013).
export default async function Page({ params }: PageProps<'/biz/payroll/staff/[staffId]'>) {
  const { staffId } = await params;
  return <StaffSchemeScreen staffId={staffId} />;
}
