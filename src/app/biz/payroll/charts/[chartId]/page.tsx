import { ChartEditorScreen } from "@/areas/payroll/charts/ChartEditorScreen";

// /biz/payroll/charts/[chartId] — создание/правка схемы, вкладка «Сотрудники» (F-09-054, F-09-055).
export default async function Page({
  params,
}: PageProps<"/biz/payroll/charts/[chartId]">) {
  const { chartId } = await params;
  return <ChartEditorScreen chartId={chartId} />;
}
