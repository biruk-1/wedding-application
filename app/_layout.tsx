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
import { WeddingThemeProvider, useColors } from '@/theme/WeddingThemeContext';

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useAuth();
  useAuthGate();
  const colors = useColors();

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

  if (!fontsReady) {
    return <AuthLoadingScreen label="Loading Kiburan…" />;
  }

  if (isLoading) {
    return <AuthLoadingScreen label="Restoring session…" />;
  }

  return (
    <ThemeProvider value={kiburanNavigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reset-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="invite/[token]" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
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

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

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
