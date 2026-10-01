import { RuleEditorScreen } from "@/areas/payroll/rules/RuleEditorScreen";

// /biz/payroll/rules/[ruleId] — создание/правка правила (F-09-050, F-09-027).
export default async function Page({
  params,
}: PageProps<"/biz/payroll/rules/[ruleId]">) {
  const { ruleId } = await params;
  return <RuleEditorScreen ruleId={ruleId} />;
}
