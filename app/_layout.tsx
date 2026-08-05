import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/lib/AuthContext';
import { UserProvider } from '@/lib/UserContext';
import { GameProvider } from '@/lib/GameContext';
import { AchievementProvider } from '@/components/AchievementSystem';
import { SubscriptionProvider } from '@/lib/SubscriptionContext';
import { CopilotProvider } from 'react-native-copilot';
import { TourProvider } from '@/lib/TourContext';
import { TourTooltip } from '@/components/TourTooltip';
import { soundManager } from '@/lib/sounds';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold });

  // Dismiss the native splash immediately on mount — same pattern as MathRex/ScienceSteggo.
  // Tying hideAsync to font loading keeps the native splash visible long enough that users
  // see it as a distinct first splash before the custom splash.tsx appears ("double splash").
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    soundManager.preload().catch((e) => console.warn('[RootLayout] sound preload failed:', e));
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <UserProvider>
                <GameProvider>
                  <AchievementProvider>
                    <SubscriptionProvider>
                      <CopilotProvider
                        stepNumberComponent={() => null}
                        tooltipComponent={TourTooltip}
                        tooltipStyle={{ backgroundColor: 'transparent', padding: 0, borderRadius: 16 }}
                        backdropColor="rgba(0,0,0,0.75)"
                        animationDuration={300}
                        overlay="view"
                        stopOnOutsideClick={false}
                        margin={8}
                        labels={{ skip: 'Skip', previous: 'Back', next: 'Next', finish: 'Done' }}
                      >
                        <TourProvider>
                          <Stack initialRouteName="splash" screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="splash" />
                            <Stack.Screen name="login" />
                            <Stack.Screen name="onboarding" />
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen name="privacy" />
                            <Stack.Screen name="delete-account" />
                            <Stack.Screen name="daily-challenge" />
                          </Stack>
                        </TourProvider>
                      </CopilotProvider>
                    </SubscriptionProvider>
                  </AchievementProvider>
                </GameProvider>
              </UserProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
