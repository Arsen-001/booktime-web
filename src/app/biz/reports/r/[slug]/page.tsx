import { AppointmentsScreen } from '@/areas/reports/AppointmentsScreen';
import { CallsScreen } from '@/areas/reports/CallsScreen';
import { CashDayScreen } from '@/areas/reports/CashDayScreen';
import { DataChangesScreen } from '@/areas/reports/DataChangesScreen';
import { DataExportsScreen } from '@/areas/reports/DataExportsScreen';
import { DataIntegrityScreen } from '@/areas/reports/DataIntegrityScreen';
import { EventsScreen } from '@/areas/reports/EventsScreen';
import { ExternalAnalyticsScreen } from '@/areas/reports/ExternalAnalyticsScreen';
import { FinanceReportScreen } from '@/areas/reports/FinanceReportScreen';
import { MessagesScreen } from '@/areas/reports/MessagesScreen';
import { MyAnalyticsScreen } from '@/areas/reports/MyAnalyticsScreen';
import { PnlScreen } from '@/areas/reports/PnlScreen';
import { PromotionsScreen } from '@/areas/reports/PromotionsScreen';
import { ReportComingSoonScreen } from '@/areas/reports/ReportComingSoonScreen';
import { RetentionScreen } from '@/areas/reports/RetentionScreen';
import { ReviewsScreen } from '@/areas/reports/ReviewsScreen';
import { SalesByClientsScreen } from '@/areas/reports/SalesByClientsScreen';
import { SalesByServicesScreen } from '@/areas/reports/SalesByServicesScreen';
import { SalesByStaffScreen } from '@/areas/reports/SalesByStaffScreen';
import { SalesByStaffDynamicsScreen } from '@/areas/reports/SalesByStaffDynamicsScreen';
import { StockBalanceScreen } from '@/areas/reports/StockBalanceScreen';
import { StockOrdersScreen } from '@/areas/reports/StockOrdersScreen';
import { StockSalesAnalysisScreen } from '@/areas/reports/StockSalesAnalysisScreen';
import { StockTurnoverScreen } from '@/areas/reports/StockTurnoverScreen';
import { StockUsageAnalysisScreen } from '@/areas/reports/StockUsageAnalysisScreen';
import { StockWriteOffAnalysisScreen } from '@/areas/reports/StockWriteOffAnalysisScreen';
import { WorkloadScreen } from '@/areas/reports/WorkloadScreen';

// /biz/reports/r/[slug] — F-12-002 пункты витрины. b03 добавляет склад (057…062), маркетинг
// (акции/отзывы/сообщения/звонки, 064…072) и «Изменения данных» (076/077) — остальное вне
// списка b01…b03 — честная «скоро» (ReportComingSoonScreen).
export default async function Page({ params }: PageProps<'/biz/reports/r/[slug]'>) {
  const { slug } = await params;
  switch (slug) {
    case 'appointments':
      return <AppointmentsScreen />;
    case 'retention':
      return <RetentionScreen />;
    case 'workload':
      return <WorkloadScreen />;
    case 'events':
      return <EventsScreen />;
    case 'finance':
      return <FinanceReportScreen />;
    case 'pnl':
      return <PnlScreen />;
    case 'cashDay':
      return <CashDayScreen />;
    case 'salesByStaff':
      return <SalesByStaffScreen />;
    case 'salesByStaffDynamics':
      return <SalesByStaffDynamicsScreen />;
    case 'salesByServices':
      return <SalesByServicesScreen />;
    case 'salesByClients':
      return <SalesByClientsScreen />;
    case 'dataExports':
      return <DataExportsScreen />;
    case 'stockBalance':
      return <StockBalanceScreen />;
    case 'stockOrders':
      return <StockOrdersScreen />;
    case 'stockSalesAnalysis':
      return <StockSalesAnalysisScreen />;
    case 'stockUsageAnalysis':
      return <StockUsageAnalysisScreen />;
    case 'stockWriteOffAnalysis':
      return <StockWriteOffAnalysisScreen />;
    case 'stockTurnover':
      return <StockTurnoverScreen />;
    case 'promotions':
      return <PromotionsScreen />;
    case 'reviews':
      return <ReviewsScreen />;
    case 'messages':
      return <MessagesScreen />;
    case 'calls':
      return <CallsScreen />;
    case 'dataChanges':
      return <DataChangesScreen />;
    case 'external':
      return <ExternalAnalyticsScreen />;
    case 'dataIntegrity':
      return <DataIntegrityScreen />;
    case 'myAnalytics':
      return <MyAnalyticsScreen />;
    default:
      return <ReportComingSoonScreen slug={slug} />;
  }
}
