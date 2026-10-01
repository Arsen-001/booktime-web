import { DocumentDetailScreen } from '@/areas/finance/documents/DocumentDetailScreen';

export default async function Page({ params }: PageProps<'/biz/finance/documents/[documentId]'>) {
  const { documentId } = await params;
  return <DocumentDetailScreen documentId={documentId} />;
}
