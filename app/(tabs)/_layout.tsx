import { Tabs, Redirect } from 'expo-router';
import { Home, Globe, Trophy, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';
import { useAuth } from '@/lib/AuthContext';

cssInterop(Home,   { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Globe,  { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trophy, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(User,   { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { bottom } = useSafeAreaInsets();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#261c00',
          borderTopColor: '#402f00',
          borderTopWidth: 1,
          height: 64 + bottom,
          paddingBottom: 8 + bottom,
          paddingTop: 8,
          position: 'absolute',
        },
        tabBarActiveTintColor: '#eab308',
        tabBarInactiveTintColor: '#7a6020',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"       options={{ title: 'Home',        tabBarIcon: ({ color, size }) => <Home    size={size} color={color} /> }} />
      <Tabs.Screen name="worlds"      options={{ title: 'Worlds',      tabBarIcon: ({ color, size }) => <Globe   size={size} color={color} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: ({ color, size }) => <Trophy  size={size} color={color} /> }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profile',     tabBarIcon: ({ color, size }) => <User    size={size} color={color} /> }} />

      {/* Hidden screens — not tab items */}
      <Tabs.Screen name="achievements"              options={{ href: null }} />
      <Tabs.Screen name="world/[id]"                options={{ href: null }} />
      {/* Game screens — hide the tab bar so they feel full-screen */}
      <Tabs.Screen name="level/[worldId]/[levelId]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="boss/[worldId]"            options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="finalboss"                  options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
