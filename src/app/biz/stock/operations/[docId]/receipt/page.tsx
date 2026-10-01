import { ReceiptScreen } from '@/areas/stock/operations/ReceiptScreen';

// /biz/stock/operations/[docId]/receipt — чек продажи для печати (F-08-072).
export default async function Page({ params }: PageProps<'/biz/stock/operations/[docId]/receipt'>) {
  const { docId } = await params;
  return <ReceiptScreen docId={docId} />;
}
