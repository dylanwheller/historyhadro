import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/lib/UserContext';
import { AGE_RANGES, AGE_BAND_LABELS, type AgeRange } from '@/lib/ageBand';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setAgeRange, updateUserStats } = useUser();
  const [selected, setSelected] = useState<AgeRange>('junior');
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    setSaving(true);
    setAgeRange(selected);
    updateUserStats({ onboardingComplete: true });
    // Give Firestore write a moment to dispatch before navigating
    setTimeout(() => {
      router.replace('/');
    }, 300);
  };

  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
      <Image
        source={require('../assets/dinos/splash-dino.png')}
        className="w-40 h-40 mb-6"
        resizeMode="contain"
      />

      <Text className="text-3xl font-bold text-foreground text-center mb-2 font-nunito">
        Choose your level
      </Text>
      <Text className="text-base text-muted-foreground text-center mb-10 font-nunito">
        Pick the difficulty that matches your age. You can change this in your profile anytime.
      </Text>

      <View className="w-full gap-4 mb-10">
        {AGE_RANGES.map((range) => (
          <TouchableOpacity
            key={range}
            onPress={() => setSelected(range)}
            className={`w-full py-5 rounded-2xl border-2 items-center ${
              selected === range
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card'
            }`}
          >
            <Text className={`text-xl font-bold font-nunito ${
              selected === range ? 'text-primary' : 'text-foreground'
            }`}>
              {range === 'junior' ? '🚀 Junior' : '🌌 Senior'}
            </Text>
            <Text className={`text-sm mt-1 font-nunito ${
              selected === range ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {AGE_BAND_LABELS[range]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleStart}
        disabled={saving}
        className="w-full py-4 bg-primary rounded-2xl items-center"
      >
        {saving ? (
          <ActivityIndicator color="#f5f3ff" />
        ) : (
          <Text className="text-lg font-bold text-primary-foreground font-nunito">
            Start Exploring!
          </Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
