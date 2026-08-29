/**
 * SubscriptionContext
 *
 * Wraps RevenueCat and exposes subscription state to the whole app.
 * Degrades gracefully when the native module is not yet present
 * (i.e. before the dev client is rebuilt after adding react-native-purchases).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type { CustomerInfo } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/AuthContext';
import {
  configureRevenueCat,
  identifyUser,
  resetUser,
  hasPremiumEntitlement,
  hasLifetimePurchase,
  getSubscriptionTier,
  getCustomerInfo,
  addCustomerInfoListener,
  type SubscriptionTier,
} from '@/lib/revenueCat';

const DEV_MOCK_PREMIUM_KEY = '@historyhadro_dev_mock_premium';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionContextType = {
  /** True when the user has purchased the lifetime unlock. */
  isPremium: boolean;
  /** Alias for isPremium — used by world-gating logic. */
  hasAccess: boolean;
  /** True when the active purchase is the all-apps lifetime bundle (vs individual). */
  isLifetime: boolean;
  tier: SubscriptionTier;
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /**
   * Directly apply a CustomerInfo snapshot (e.g. the one returned by
   * purchasePackage) without a round-trip to the RevenueCat server.
   * Use this immediately after a purchase to avoid stale-cache races.
   */
  applyCustomerInfo: (info: CustomerInfo) => void;
  /**
   * DEV ONLY — toggles a mock premium override stored in AsyncStorage.
   * No-op in production builds.
   */
  toggleMockPremium: () => Promise<void>;
  /** DEV ONLY — whether the mock override is currently active. */
  isMockPremium: boolean;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function useSubscription(): SubscriptionContextType {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isMockPremium, setIsMockPremium] = useState(false);

  // Load persisted mock flag on mount (dev builds only)
  useEffect(() => {
    if (!__DEV__) return;
    AsyncStorage.getItem(DEV_MOCK_PREMIUM_KEY).then((val) => {
      if (val === 'true') setIsMockPremium(true);
    });
  }, []);

  const { isPremium, hasAccess, isLifetime, tier } = useMemo(() => {
    // In dev builds the mock flag acts as a local override, bypassing RevenueCat
    const rcPremium = customerInfo ? hasPremiumEntitlement(customerInfo) : false;
    const isPremium = (__DEV__ && isMockPremium) || rcPremium;
    const isLifetime = customerInfo ? hasLifetimePurchase(customerInfo) : false;
    return {
      isPremium,
      hasAccess: isPremium,
      isLifetime,
      tier: isPremium ? ('premium' as SubscriptionTier) : ('free' as SubscriptionTier),
    };
  }, [customerInfo, isMockPremium]);

  // Configure the SDK once — safe even if native module is missing
  useEffect(() => {
    configureRevenueCat(authUser?.uid);
  }, []);

  // Identify / de-identify when the auth user changes
  useEffect(() => {
    if (authUser?.uid) {
      identifyUser(authUser.uid, authUser.email).then(() => refresh());
    } else {
      resetUser().catch(() => {});
      setCustomerInfo(null);
    }
  }, [authUser?.uid]);

  // Listen for real-time entitlement updates from RevenueCat
  useEffect(() => {
    const listener = addCustomerInfoListener((info) => setCustomerInfo(info));
    return () => listener.remove();
  }, []);

  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    setCustomerInfo(info);
  }, []);

  const toggleMockPremium = useCallback(async () => {
    if (!__DEV__) return;
    const next = !isMockPremium;
    setIsMockPremium(next);
    await AsyncStorage.setItem(DEV_MOCK_PREMIUM_KEY, String(next));
  }, [isMockPremium]);

  const refresh = useCallback(async () => {
    if (!authUser?.uid) return;
    setIsLoading(true);
    try {
      const info = await getCustomerInfo();
      // Only overwrite state when we actually got a response — a null result
      // (SDK unavailable, network error) must never silently clear premium access
      // that was just granted by applyCustomerInfo.
      if (info !== null) {
        setCustomerInfo(info);
      }
    } catch (e) {
      console.warn('[SubscriptionContext] refresh error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [authUser?.uid]);

  return (
    <SubscriptionContext.Provider
      value={{
        isPremium,
        hasAccess,
        isLifetime,
        tier,
        customerInfo,
        isLoading,
        refresh,
        applyCustomerInfo,
        toggleMockPremium,
        isMockPremium,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
