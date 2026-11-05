import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, DefaultTheme, Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/features/auth/context/AuthContext';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthGate } from '@/features/auth/hooks/useAuthGate';
import { AuthLoadingScreen } from '@/features/auth/screens/AuthLoadingScreen';
import { subscribeAppFocus } from '@/lib/query/appFocus';
import { queryClient } from '@/lib/query/queryClient';
import { WeddingThemeProvider, useWeddingTheme } from '@/theme/WeddingThemeContext';

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useAuth();
  useAuthGate();
  const { colors, isHydrated } = useWeddingTheme();

  useEffect(() => {
    if (fontsReady && isHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, isHydrated]);

  const kiburanNavigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.primary,
        background: colors.surface,
        card: colors.surfaceElevated,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    }),
    [colors],
  );

  if (!fontsReady || !isHydrated) {
    return <AuthLoadingScreen label="Loading Kiburan…" />;
  }

  if (isLoading) {
    return <AuthLoadingScreen label="Restoring session…" />;
  }

  return (
    <ThemeProvider value={kiburanNavigationTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
        }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="invite/[token]" options={{ animation: 'fade' }} />
        <Stack.Screen name="join/[token]" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false, animation: 'fade' }} />
        {/* Legacy Expo template routes — auth gate sends signed-in users to /(app), not here */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => subscribeAppFocus(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WeddingThemeProvider>
          <RootNavigator fontsReady={fontsReady} />
        </WeddingThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
