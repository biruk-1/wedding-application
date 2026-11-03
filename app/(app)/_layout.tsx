import { Stack } from 'expo-router';

import { useColors } from '@/theme/WeddingThemeContext';

export default function AppLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
