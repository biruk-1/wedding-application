import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';

/**
 * Shared push/pop transitions for the signed-in app. Tab switches keep their own
 * replace behaviour in WeddingTabBar; detail screens use slide, forms use a soft
 * bottom sheet feel.
 */
export default function AppLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'slide_from_right',
        animationDuration: Platform.OS === 'ios' ? 320 : 250,
        gestureEnabled: true,
        fullScreenGestureEnabled: Platform.OS === 'ios',
      }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="create-wedding" options={{ animation: 'slide_from_bottom', presentation: 'card' }} />
      <Stack.Screen name="weddings/index" options={{ animation: 'fade' }} />
      {/* Main wedding tabs: soft fade so replace() between peers does not hard-cut. */}
      <Stack.Screen name="weddings/[weddingId]/index" options={{ animation: 'fade', animationDuration: 180 }} />
      <Stack.Screen name="weddings/[weddingId]/checklist/index" options={{ animation: 'fade', animationDuration: 180 }} />
      <Stack.Screen name="weddings/[weddingId]/vendors/index" options={{ animation: 'fade', animationDuration: 180 }} />
      <Stack.Screen name="weddings/[weddingId]/guests/index" options={{ animation: 'fade', animationDuration: 180 }} />
      <Stack.Screen name="weddings/[weddingId]/more" options={{ animation: 'fade', animationDuration: 180 }} />
      <Stack.Screen
        name="weddings/[weddingId]/checklist/new"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/checklist/[taskId]/edit"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/guests/new"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/guests/[guestId]/edit"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/budget/edit"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/budget/expenses/new"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/vendors/[vendorId]/inquire"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="weddings/[weddingId]/timeline/new"
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
