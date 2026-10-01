import { OperationDocScreen } from '@/areas/stock/operations/OperationDocScreen';

// /biz/stock/operations/[docId] — документ складской операции (F-08-049…052, F-08-060).
export default async function Page({ params }: PageProps<'/biz/stock/operations/[docId]'>) {
  const { docId } = await params;
  return <OperationDocScreen docId={docId} />;
}
