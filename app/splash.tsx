import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/lib/AuthContext';
import { useUser } from '@/lib/UserContext';

const version =
  (Constants as any)?.expoConfig?.version ??
  (Constants as any)?.manifest?.version ??
  '1.0.0';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoggedIn, user } = useUser();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  // Prevent the background-mounted splash from re-routing when onboardingComplete
  // changes after it has already navigated away (e.g. to /onboarding). Without
  // this guard, the effect re-fires from the background navigation stack and
  // briefly animates back through splash before landing on home.
  const hasNavigated = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 1600);
    return () => clearTimeout(t);
  }, []);

  // Navigate once BOTH the minimum time has elapsed AND Firebase has resolved.
  // For the authenticated path we also wait for isLoggedIn (UserContext sets this
  // only after the Firestore profile fetch completes) so the home screen never
  // renders with default placeholder data.
  useEffect(() => {
    if (!minTimeElapsed || authLoading) return;
    if (hasNavigated.current) return;
    if (!isAuthenticated) {
      hasNavigated.current = true;
      router.replace('/login');
      return;
    }
    if (!isLoggedIn) return;
    hasNavigated.current = true;
    router.replace(user.onboardingComplete ? '/(tabs)' : '/onboarding');
  }, [minTimeElapsed, authLoading, isAuthenticated, isLoggedIn, user.onboardingComplete, router]);

  return (
    <LinearGradient colors={['#030d1a', '#0a1628', '#030d1a']} style={{ flex: 1 }}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center justify-center rounded-3xl bg-white/10 p-10 shadow-lg shadow-black/30">
          <Image
            source={require('../assets/dinos/splash-dino.png')}
            className="h-40 w-40 rounded-3xl opacity-95"
            resizeMode="cover"
          />
          <Text className="mt-1 text-sm font-medium text-white/80">The History Dino</Text>
        </View>
        <Text className="absolute bottom-10 text-xs text-white/40">Version {version}</Text>
      </View>
    </LinearGradient>
  );
}
