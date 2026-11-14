import 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BleAutoCheckIn, BoardingPromptModal, ServerRideSync } from '../src/features/ride';
import { useTheme } from '../src/core/theme';
import { installMapLogFilter } from '../src/features/map/mapLogFilter';
import { usePreferences } from '../src/features/settings';
import { queryClient } from '../src/services/api/queryClient';
import { BrandSplashOverlay } from '../src/ui';

installMapLogFilter();

export default function RootLayout() {
  const { scheme } = useTheme();
  // Schimbarea limbii remontează aplicația ca toate textele `t()` să se reia.
  const locale = usePreferences((s) => s.locale);

  return (
    <SafeAreaProvider key={locale}>
      <QueryClientProvider client={queryClient}>
        <View style={styles.root}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="plan" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="inspector" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="ble-log" />
          </Stack>
          <BrandSplashOverlay />
        </View>
        <BoardingPromptModal />
        <BleAutoCheckIn />
        <ServerRideSync />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
