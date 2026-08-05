/**
 * TourContext
 *
 * Wraps react-native-copilot to provide a `startTour()` function consumed by
 * HomeScreen. Handles:
 *   - Navigation between tabs as the user progresses through steps
 *   - Writing `walkthroughComplete: true` to Firestore on finish or skip
 *
 * Pre-warm: copilot only knows about steps that are currently registered (i.e.
 * their CopilotStep component is mounted). Worlds and profile tabs are
 * lazy-loaded, so we must navigate to them before calling start(). A brief
 * opaque Modal hides the navigation so the user never sees screens flash.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';
import { useCopilot } from 'react-native-copilot';
import { useRouter } from 'expo-router';
import { useUser } from '@/lib/UserContext';

type TourContextType = {
  startTour: () => void;
};

const TourContext = createContext<TourContextType | null>(null);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function TourProvider({ children }: { children: ReactNode }) {
  const { start, copilotEvents } = useCopilot();
  const router = useRouter();
  const { updateUserStats } = useUser();
  const listenersAttached = useRef(false);
  const [isPrewarming, setIsPrewarming] = useState(false);

  // Always keep a ref to the latest updateUserStats so the event handlers
  // (attached once on mount) never call a stale closure. Without this, the
  // handlers capture the version of updateUserStats from initial render, when
  // uid is still null (auth hasn't resolved yet), causing the Firestore write
  // to be silently skipped.
  const updateUserStatsRef = useRef(updateUserStats);
  useEffect(() => {
    updateUserStatsRef.current = updateUserStats;
  }, [updateUserStats]);

  // Attach copilot event listeners exactly once on mount.
  // The listenersAttached ref guards against double-attachment in StrictMode.
  useEffect(() => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;

    // Navigate to the correct tab when a step becomes active
    const handleStepChange = (step: { name: string } | undefined) => {
      if (!step) return;
      switch (step.name) {
        case 'worlds-list':
        case 'world-levels':
          router.push('/(tabs)/worlds');
          break;
        case 'profile-screen':
          router.push('/(tabs)/profile');
          break;
        // Steps 1 & 2 are on Home — no navigation needed
        default:
          break;
      }
    };

    // Mark complete when user finishes or skips the tour
    const handleFinish = () => {
      updateUserStatsRef.current({ walkthroughComplete: true });
      router.push('/(tabs)/');
    };

    const handleStop = () => {
      updateUserStatsRef.current({ walkthroughComplete: true });
      router.push('/(tabs)/');
    };

    copilotEvents.on('stepChange', handleStepChange);
    copilotEvents.on('finish', handleFinish);
    copilotEvents.on('stop', handleStop);

    return () => {
      copilotEvents.off('stepChange', handleStepChange);
      copilotEvents.off('finish', handleFinish);
      copilotEvents.off('stop', handleStop);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Mount worlds and profile tabs so their CopilotSteps register before
   * copilot calls start(). The opaque Modal hides the navigation from the user.
   */
  const startTour = useCallback(async () => {
    setIsPrewarming(true);
    router.push('/(tabs)/worlds');
    await sleep(100);
    router.push('/(tabs)/profile');
    await sleep(100);
    router.push('/(tabs)/');
    await sleep(100);
    setIsPrewarming(false);
    start();
  }, [start, router]);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {/* Opaque overlay during tab pre-warm so the navigation is invisible.
          Deliberately plain — not splash-styled — to avoid a "double splash" feel. */}
      <Modal visible={isPrewarming} transparent={false} animationType="none" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: '#030d1a', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.3)" />
        </View>
      </Modal>
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}
