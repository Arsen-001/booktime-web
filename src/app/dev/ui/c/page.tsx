import type { Metadata } from 'next';
import { ShowcaseC } from '@/dev/showcase/ShowcaseC';

export const metadata: Metadata = { title: 'UI-кит · панели и выбор' };

export default function ShowcaseCPage() {
  return (
    <main data-showcase className="mx-auto max-w-5xl px-4 py-6">
      <ShowcaseC />
    </main>
  );
}
