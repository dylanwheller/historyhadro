// app/daily-challenge.tsx
import React from 'react';
import { Stack } from 'expo-router';
import DailyChallengeScreen from '@/components/screens/DailyChallengeScreen';

export default function DailyChallengeRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DailyChallengeScreen />
    </>
  );
}
