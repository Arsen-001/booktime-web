import { CriterionEditorScreen } from "@/areas/payroll/criteria/CriterionEditorScreen";

// /biz/payroll/criteria/[criterionId] — создание/правка критерия (F-09-052).
export default async function Page({
  params,
}: PageProps<"/biz/payroll/criteria/[criterionId]">) {
  const { criterionId } = await params;
  return <CriterionEditorScreen criterionId={criterionId} />;
}
