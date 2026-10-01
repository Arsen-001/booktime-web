import { OperationDetailScreen } from '@/areas/finance/operations/OperationDetailScreen';

export default async function Page({ params }: PageProps<'/biz/finance/operations/[operationId]'>) {
  const { operationId } = await params;
  return <OperationDetailScreen operationId={operationId} />;
}
