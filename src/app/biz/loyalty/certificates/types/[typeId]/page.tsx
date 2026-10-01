import { CertificateTypeFormScreen } from '@/areas/loyalty/certificate-types/CertificateTypeFormScreen';

// /biz/loyalty/certificates/types/[typeId] — правка и удаление типа сертификата.
export default async function Page({ params }: PageProps<'/biz/loyalty/certificates/types/[typeId]'>) {
  const { typeId } = await params;
  return <CertificateTypeFormScreen typeId={typeId} />;
}
