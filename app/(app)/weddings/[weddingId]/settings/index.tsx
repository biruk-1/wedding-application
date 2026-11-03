import { useLocalSearchParams } from 'expo-router';

import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';

export default function WeddingSettingsRoute() {
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  return <SettingsScreen weddingId={weddingId} />;
}
