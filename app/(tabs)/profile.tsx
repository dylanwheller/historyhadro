import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Modal,
  ToastAndroid,
  Platform,
  Switch,
} from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Trophy, Flame, Target, Award, Calendar, ChevronRight, Crown, Zap } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import Constants from 'expo-constants';
import { useAuth } from '@/lib/AuthContext';
import { useUser } from '@/lib/UserContext';
import { useSubscription } from '@/lib/SubscriptionContext';
import { getUserDailyStats } from '@/lib/firebase';
import { AGE_RANGES, AGE_BAND_LABELS, type AgeRange } from '@/lib/ageBand';
import PaywallScreen from '@/components/screens/PaywallScreen';
import { getAvatarSource } from '@/lib/avatars';
import AvatarPicker from '@/components/AvatarPicker';
import CrossPromoSection from '@/components/CrossPromoSection';
import { useAchievements } from '@/components/AchievementSystem';
import { soundManager } from '@/lib/sounds';

const CopilotView = walkthroughable(View);

cssInterop(Crown, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Zap,   { className: { target: 'style', nativeStyleToProp: { color: true } } });

const version =
  (Constants as any)?.expoConfig?.version ??
  (Constants as any)?.manifest?.version ??
  '1.0.0';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.smartypants.historyhadro';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout: authLogout, user: authUser } = useAuth();
  const { logout: logoutUser, user: localUser, setAgeRange, setAvatar } = useUser();
  const { getUnlockedAchievements } = useAchievements();
  const recentAchievements = getUnlockedAchievements().slice(-4);
  const { hasAccess, isLifetime, toggleMockPremium, isMockPremium } = useSubscription();

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [difficultyUpdated, setDifficultyUpdated] = useState(false);
  const [loginStreak, setLoginStreak] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSoundEnabled(soundManager.isEnabled());
  }, []);

  const handleToggleSound = (value: boolean) => {
    setSoundEnabled(value);
    soundManager.setEnabled(value);
  };

  useEffect(() => {
    // Reset immediately so the UI never shows the previous account's streak
    setLoginStreak(0);
    const uid = authUser?.uid;
    if (!uid) return;

    let cancelled = false;
    getUserDailyStats(uid).then((stats) => {
      if (cancelled) return; // Stale response — user changed while request was in flight
      const activeDates = new Set(
        stats.filter((s) => (s.questionsSolved ?? 0) > 0 || s.loggedIn).map((s) => s.dateKey)
      );
      let streak = 0;
      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      // If user hasn't done anything today, start counting from yesterday
      const startOffset = activeDates.has(todayKey) ? 0 : 1;
      for (let i = startOffset; i < 90; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (activeDates.has(key)) streak++;
        else break;
      }
      setLoginStreak(streak);
    }).catch(console.warn);

    return () => { cancelled = true; };
  }, [authUser?.uid]);

  const displayName = authUser?.displayName ?? localUser?.name ?? 'HistoryHadro Explorer';
  const email = authUser?.email ?? null;
  const avatarSource = getAvatarSource(localUser.avatarId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);

  const handleSignOut = async () => {
    setSignOutConfirmVisible(false);
    try { if (authLogout) await authLogout(); } catch (e) { console.warn('Auth logout failed', e); }
    try { if (logoutUser) logoutUser(); } catch (e) { console.warn('Local logout failed', e); }
    router.replace('/login');
  };

  const handleConfirmSignOut = () => {
    setSignOutConfirmVisible(true);
  };

  const handleAgeRangeChange = (range: AgeRange) => {
    setAgeRange(range);
    setDifficultyUpdated(true);
    setTimeout(() => setDifficultyUpdated(false), 2000);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>

        {/* Header — step 5 of the tour */}
        <CopilotStep
          name="profile-screen"
          order={5}
          text="Your profile — change your avatar, switch age range, and manage settings."
        >
          <CopilotView collapsable={false}>
          <View className="px-6 pt-4 pb-6">
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-row items-center gap-4">
              <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                className="relative"
                activeOpacity={0.8}
              >
                <Image
                  source={avatarSource}
                  className="w-20 h-20 rounded-full border-2 border-primary"
                />
                <View className="absolute bottom-0 right-0 bg-primary rounded-full w-6 h-6 items-center justify-center border-2 border-background">
                  <Text className="text-white text-xs">✏️</Text>
                </View>
              </TouchableOpacity>
              <View>
                <Text className="text-2xl font-bold text-foreground">{displayName}</Text>
                {email
                  ? <Text className="text-xs text-muted-foreground">{email}</Text>
                  : <Text className="text-primary font-medium text-sm">HistoryHadro Explorer</Text>}
                <View className="flex-row items-center gap-2 mt-1">
                  <Calendar size={12} color="#c4b5fd" />
                  <Text className="text-xs text-muted-foreground">Level {localUser.level}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleConfirmSignOut}
              className="p-2 bg-muted rounded-full"
            >
              <Text className="text-sm text-muted-foreground">Sign out</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View className="flex-row flex-wrap gap-3">
            <StatCard icon={<Trophy size={20} color="#eab308" />} label="Points" value={localUser.points} />
            <StatCard icon={<Target size={20} color="#3b82f6" />} label="Solved" value={localUser.totalQuestionsSolved ?? 0} />
            <StatCard icon={<Flame size={20} color="#f97316" />} label="Streak" value={`${loginStreak} days`} />
            <StatCard icon={<Award size={20} color="#ec4899" />} label="Level" value={localUser.level} />
          </View>
          </View>
          </CopilotView>
        </CopilotStep>

        {/* Difficulty */}
        <View className="px-6 mt-6 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">
            Difficulty
          </Text>
          <View className="flex-row gap-2">
            {AGE_RANGES.map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => handleAgeRangeChange(range)}
                className={`flex-1 py-2.5 rounded-xl border-2 items-center ${
                  localUser.ageRange === range
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <Text className={`text-sm font-bold font-nunito ${
                  localUser.ageRange === range ? 'text-primary' : 'text-foreground'
                }`}>
                  {AGE_BAND_LABELS[range]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {difficultyUpdated && (
            <Text className="text-primary text-xs font-nunito mt-2 text-center">
              Difficulty updated ✓
            </Text>
          )}
        </View>

        {/* Achievements */}
        <View className="px-6 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-foreground">Recent Achievements</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/achievements')}>
              <Text className="text-sm text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          {recentAchievements.length === 0 ? (
            <View className="bg-muted rounded-2xl p-6 items-center">
              <Trophy size={32} color="#9CA3AF" />
              <Text className="text-sm text-muted-foreground mt-2 text-center">
                Complete challenges to earn achievements!
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {recentAchievements.map((ach) => (
                <View key={ach.id} className="w-24 p-3 rounded-xl border border-border bg-card items-center gap-2">
                  <Text className="text-2xl">{ach.icon}</Text>
                  <Text className="text-xs font-medium text-foreground text-center leading-tight" numberOfLines={2}>
                    {ach.title}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Settings */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">
            Settings
          </Text>
          <View className="bg-card rounded-xl p-4 border border-border flex-row items-center justify-between">
            <Text className="text-foreground font-nunito text-sm">🔊 Sound Effects</Text>
            <Switch
              value={soundEnabled}
              onValueChange={handleToggleSound}
              trackColor={{ false: 'rgba(120, 113, 108, 0.32)', true: 'rgba(168, 85, 247, 0.5)' }}
              thumbColor={soundEnabled ? '#a855f7' : '#f5f5f4'}
              ios_backgroundColor="#3e3e3e"
            />
          </View>
        </View>

        {/* Subscription card */}
        <View className="px-6 mb-6">
          {hasAccess ? (
            <View className="bg-card rounded-2xl p-4 border border-border">
              <View className="flex-row items-center gap-3">
                <View className="bg-primary/10 p-2 rounded-xl">
                  <Crown size={22} className="text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-bold font-nunito">
                    {isLifetime ? 'All Apps Bundle' : 'HistoryHadro Premium'}
                  </Text>
                  <Text className="text-muted-foreground text-xs font-nunito">
                    {isLifetime ? 'All 6 apps · All worlds' : 'This app · All worlds'}
                  </Text>
                </View>
                <View className="bg-primary/10 px-2 py-1 rounded-full">
                  <Text className="text-primary text-xs font-bold font-nunito">Unlocked</Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setPaywallOpen(true)}
              activeOpacity={0.85}
              className="bg-primary/10 rounded-2xl p-4 border border-primary/30 flex-row items-center gap-3"
            >
              <View className="bg-primary/20 p-2 rounded-xl">
                <Zap size={22} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-bold font-nunito">Unlock Everything</Text>
                <Text className="text-muted-foreground text-xs font-nunito">
                  R100 this app · R500 all 6 apps
                </Text>
              </View>
              <ChevronRight size={20} color="#a855f7" />
            </TouchableOpacity>
          )}
        </View>

        <CrossPromoSection />

        {/* Legal */}
        <View className="px-6 mb-6 gap-3">
          <Text className="text-muted-foreground text-xs font-bold font-nunito uppercase tracking-widest mb-1">
            Legal & Account
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(PLAY_STORE_URL)}
            className="bg-card rounded-xl p-4 border border-border flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <Text className="text-foreground font-nunito text-sm">⭐ Rate this app</Text>
            <ChevronRight size={16} color="#c4b5fd" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/privacy')}
            className="bg-card rounded-xl p-4 border border-border flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <Text className="text-foreground font-nunito text-sm">Privacy Policy</Text>
            <ChevronRight size={16} color="#c4b5fd" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/delete-account')}
            className="bg-card rounded-xl p-4 border border-red-800 flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <Text className="text-red-400 font-nunito text-sm">Delete Account</Text>
            <ChevronRight size={16} color="#f87171" />
          </TouchableOpacity>
        </View>

        {/* Version */}
        <TouchableOpacity
          activeOpacity={0.6}
          onLongPress={__DEV__ ? async () => {
            await toggleMockPremium();
            const msg = isMockPremium
              ? '🔓 Mock premium OFF'
              : '👑 Mock premium ON — all worlds unlocked';
            if (Platform.OS === 'android') {
              ToastAndroid.show(msg, ToastAndroid.SHORT);
            } else {
              Alert.alert('Dev', msg);
            }
          } : undefined}
          delayLongPress={800}
          className="py-4 px-6 items-center"
        >
          <Text className="text-xs text-muted-foreground/60">
            {__DEV__ && isMockPremium ? '👑 ' : ''}Version {version}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {paywallOpen && (
        <PaywallScreen modal onClose={() => setPaywallOpen(false)} />
      )}

      <AvatarPicker
        visible={pickerOpen}
        currentId={localUser.avatarId}
        onSelect={(id) => { setAvatar(id); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />

      {/* Sign out confirmation — themed to match the app */}
      <Modal
        visible={signOutConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutConfirmVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View className="bg-card border border-border rounded-2xl p-6 gap-4">
            <Text className="text-foreground text-lg font-bold text-center">Sign out?</Text>
            <Text className="text-muted-foreground text-sm text-center leading-relaxed">
              You can sign back in at any time.
            </Text>
            <View className="gap-3 mt-2">
              <TouchableOpacity
                onPress={handleSignOut}
                className="bg-red-500/10 border border-red-500/30 rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-red-400 font-semibold">Sign out</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSignOutConfirmVisible(false)}
                className="bg-muted rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <View className="bg-card p-3 rounded-xl border border-border flex-row items-center gap-3 flex-1 min-w-[44%]">
    <View className="p-2 bg-muted rounded-lg">{icon}</View>
    <View className="flex-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-lg font-bold text-foreground">{value}</Text>
    </View>
  </View>
);
