/**
 * RevenueCat / Google Play Billing integration.
 *
 * This module is intentionally defensive: every call checks whether the
 * native module is actually available before touching it.  This means the
 * app starts normally in a standard Expo dev client that was built before
 * react-native-purchases was added.  Once you rebuild the dev client
 * (npx expo run:android) the real SDK kicks in automatically.
 *
 * Product IDs must match what you create in:
 *   1. Google Play Console → Monetisation → In-app products (one-time)
 *   2. RevenueCat Dashboard → Products (then attach to Entitlements)
 *
 * Entitlements:
 *   "premium"  — lifetime one-time purchase (R250)
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

// ─── Lazy native-module accessor ──────────────────────────────────────────────
// Loaded once on first call; null means the native module is unavailable.

type PurchasesSDK = typeof import('react-native-purchases').default;
let _sdk: PurchasesSDK | null | undefined; // undefined = not yet attempted

function getPurchases(): PurchasesSDK | null {
  if (_sdk !== undefined) return _sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    const sdk = mod?.default ?? mod?.Purchases ?? mod;
    _sdk = typeof sdk?.configure === 'function' ? (sdk as PurchasesSDK) : null;
  } catch {
    _sdk = null;
  }
  return _sdk;
}

function getLogLevel() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-purchases').LOG_LEVEL as typeof import('react-native-purchases').LOG_LEVEL;
  } catch {
    return null;
  }
}

// ─── Product / Entitlement identifiers ────────────────────────────────────────

export const ENTITLEMENT_PREMIUM = 'premium';

export const PRODUCT_IDS = {
  /** R100 — one-time unlock for HistoryHadro only */
  individual: 'smartypants_historyhadro',
  /** R500 — one-time lifetime unlock across all Smarty Pants apps */
  lifetime: 'smartypants_lifetime',
} as const;

// ─── API keys ─────────────────────────────────────────────────────────────────

const extra = (Constants as any)?.expoConfig?.extra ?? {};

const ANDROID_API_KEY: string =
  extra.REVENUECAT_ANDROID_KEY ?? 'appl_REPLACE_WITH_YOUR_ANDROID_KEY';
const IOS_API_KEY: string =
  extra.REVENUECAT_IOS_KEY ?? 'appl_REPLACE_WITH_YOUR_IOS_KEY';

// ─── Initialisation ───────────────────────────────────────────────────────────

let _configured = false;

export function configureRevenueCat(uid?: string): void {
  if (_configured) return;
  _configured = true;

  const sdk = getPurchases();
  if (!sdk) {
    console.warn('[RevenueCat] Native module not available — rebuild dev client to enable subscriptions.');
    return;
  }

  try {
    const logLevel = getLogLevel();
    if (__DEV__ && logLevel) sdk.setLogLevel(logLevel.DEBUG);
    const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
    sdk.configure({ apiKey, appUserID: uid ?? null });
  } catch (e) {
    console.warn('[RevenueCat] configure error:', e);
  }
}

export async function identifyUser(uid: string, email?: string | null): Promise<void> {
  try {
    const sdk = getPurchases();
    if (!sdk) return;
    await sdk.logIn(uid);
    if (email) await sdk.setEmail(email);
  } catch (e) {
    console.warn('[RevenueCat] logIn error:', e);
  }
}

export async function resetUser(): Promise<void> {
  try {
    await getPurchases()?.logOut();
  } catch (e) {
    console.warn('[RevenueCat] logOut error:', e);
  }
}

// ─── Entitlement helpers ──────────────────────────────────────────────────────

export function hasPremiumEntitlement(info: CustomerInfo): boolean {
  // Check entitlement is active AND was granted by this app's individual product or the
  // shared lifetime product. Without this product check, buying any one app's individual
  // product grants the shared "premium" entitlement to every app in the RC project.
  const activeEntitlement = info.entitlements.active[ENTITLEMENT_PREMIUM];
  if (activeEntitlement) {
    const grantedBy = activeEntitlement.productIdentifier;
    if (grantedBy === PRODUCT_IDS.individual || grantedBy === PRODUCT_IDS.lifetime) return true;
  }

  // Fallback: check raw transaction history for either individual OR lifetime product.
  const hasTransaction = info.nonSubscriptionTransactions?.some(
    (t) => t.productIdentifier === PRODUCT_IDS.lifetime || t.productIdentifier === PRODUCT_IDS.individual,
  ) ?? false;
  if (hasTransaction) return true;

  // Second fallback: allPurchasedProductIdentifiers covers both subscriptions and
  // one-time purchases, regardless of entitlement assignment.
  return (info.allPurchasedProductIdentifiers?.includes(PRODUCT_IDS.lifetime) ?? false)
      || (info.allPurchasedProductIdentifiers?.includes(PRODUCT_IDS.individual) ?? false);
}

export function hasLifetimePurchase(info: CustomerInfo): boolean {
  const activeEntitlement = info.entitlements.active[ENTITLEMENT_PREMIUM];
  if (activeEntitlement?.productIdentifier === PRODUCT_IDS.lifetime) return true;
  const hasTransaction = info.nonSubscriptionTransactions?.some(
    (t) => t.productIdentifier === PRODUCT_IDS.lifetime,
  ) ?? false;
  if (hasTransaction) return true;
  return info.allPurchasedProductIdentifiers?.includes(PRODUCT_IDS.lifetime) ?? false;
}

export type SubscriptionTier = 'free' | 'premium';

export function getSubscriptionTier(info: CustomerInfo): SubscriptionTier {
  return hasPremiumEntitlement(info) ? 'premium' : 'free';
}

// ─── Offerings / customer info ────────────────────────────────────────────────

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await getPurchases()?.getOfferings();
    return offerings?.current ?? null;
  } catch (e) {
    console.warn('[RevenueCat] getOfferings error:', e);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return (await getPurchases()?.getCustomerInfo()) ?? null;
  } catch (e) {
    console.warn('[RevenueCat] getCustomerInfo error:', e);
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const info = (await getPurchases()?.restorePurchases()) ?? null;
    if (__DEV__ && info) {
      console.log('[RevenueCat] restorePurchases result:', {
        originalAppUserId: info.originalAppUserId,
        entitlementsActive: Object.keys(info.entitlements.active),
        entitlementsAll: Object.keys(info.entitlements.all),
        allPurchasedProductIdentifiers: info.allPurchasedProductIdentifiers,
        nonSubscriptionTransactions: info.nonSubscriptionTransactions?.map((t) => t.productIdentifier),
      });
    }
    return info;
  } catch (e) {
    console.warn('[RevenueCat] restorePurchases error:', e);
    return null;
  }
}

export async function purchasePackage(pkg: import('react-native-purchases').PurchasesPackage) {
  const sdk = getPurchases();
  if (!sdk) throw new Error('Purchases not available — rebuild the dev client.');
  return sdk.purchasePackage(pkg);
}

export function addCustomerInfoListener(
  cb: (info: CustomerInfo) => void,
): { remove: () => void } {
  try {
    const sdk = getPurchases();
    if (!sdk) return { remove: () => {} };
    const listener = sdk.addCustomerInfoUpdateListener(cb);
    return listener ?? { remove: () => {} };
  } catch {
    return { remove: () => {} };
  }
}
