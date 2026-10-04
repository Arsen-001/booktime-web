import { AppGate } from '@/areas/client/apps/AppGate';
import { StoriesGeneratorScreen } from '@/areas/client/apps/StoriesGeneratorScreen';
import { NativePurchaseGate } from '@/areas/settings/NativePurchaseGate';

// /biz/apps/stories — раздел «client»: генератор сторис + покупка (F-00-155…163, F-14-033…036, F-14-172).
// Сторис покупаются за монеты — в приложениях iOS/Android экрана нет (App Store 3.1.1).
export default function Page() {
  return (
    <AppGate permission="journal.view">
      <NativePurchaseGate>
        <StoriesGeneratorScreen />
      </NativePurchaseGate>
    </AppGate>
  );
}
