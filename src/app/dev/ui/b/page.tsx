import type { Metadata } from 'next';
import { ShowcaseB } from '@/dev/showcase/ShowcaseB';

export const metadata: Metadata = { title: 'UI-кит · оверлеи и данные' };

export default function ShowcaseBPage() {
  return (
    <main data-showcase className="mx-auto max-w-5xl px-4 py-6">
      <ShowcaseB />
    </main>
  );
}
