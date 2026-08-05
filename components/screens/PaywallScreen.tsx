/**
 * PaywallScreen — HistoryHadro
 *
 * Two-option paywall:
 *   1. HistoryHadro Only — R100 (smartypants_historyhadro)
 *   2. All Apps Bundle — R500 (smartypants_lifetime)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { X, Check, Zap, ExternalLink } from 'lucide-react-native';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '@/lib/SubscriptionContext';
import { PRODUCT_IDS, purchasePackage, restorePurchases, getCurrentOffering } from '@/lib/revenueCat';

cssInterop(X,            { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Check,        { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Zap,          { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ExternalLink, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.smartypants.historyhadro';

const APP_EMOJI = '📜';
const APP_NAME  = 'HistoryHadro';

const INDIVIDUAL_FEATURES = [
  'Unlock all 4 HistoryHadro worlds',
  'Daily history challenge',
  'No ads, ever',
];

const BUNDLE_APPS = ['🔭 AstroAllo', '🌍 GeoGiganto', '📜 HistoryHadro', '🤖 CompSciCarno', '🔬 ScienceSteggo', '🔢 MathRex'];

// ─── Component ────────────────────────────────────────────────────────────────

interface PaywallScreenProps {
  modal?: boolean;
  onClose?: () => void;
}

export default function PaywallScreen({ modal = false, onClose }: PaywallScreenProps) {
  const { refresh, applyCustomerInfo } = useSubscription();
  const router = useRouter();

  const [individualPkg, setIndividualPkg] = useState<PurchasesPackage | null>(null);
  const [lifetimePkg,   setLifetimePkg]   = useState<PurchasesPackage | null>(null);
  const [selected, setSelected]           = useState<'individual' | 'lifetime'>('lifetime');
  const [purchasing, setPurchasing]       = useState(false);
  const [restoring, setRestoring]         = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(true);

  useEffect(() => {
    getCurrentOffering()
      .then((offering) => {
        const pkgs = offering?.availablePackages ?? [];
        setIndividualPkg(pkgs.find((p) => p.product.identifier === PRODUCT_IDS.individual) ?? null);
        setLifetimePkg(pkgs.find((p) => p.product.identifier === PRODUCT_IDS.lifetime) ?? null);
      })
      .catch((e) => console.warn('[Paywall] getOfferings error:', e))
      .finally(() => setLoadingOffers(false));
  }, []);

  const handleClose = useCallback(() => { onClose?.(); }, [onClose]);

  const handlePurchase = useCallback(async () => {
    const pkg = selected === 'individual' ? individualPkg : lifetimePkg;
    if (!pkg) {
      Alert.alert(
        'Not Available Yet',
        'In-app purchases will be available once the app is published to Google Play.',
        [{ text: 'OK' }],
      );
      return;
    }
    setPurchasing(true);
    try {
      const result = await purchasePackage(pkg);
      if (result?.customerInfo) {
        applyCustomerInfo(result.customerInfo);
      } else {
        await refresh();
      }
      Alert.alert(
        selected === 'individual' ? `${APP_EMOJI} Unlocked!` : '🌟 All Apps Unlocked!',
        selected === 'individual'
          ? `Welcome to ${APP_NAME} Premium — all worlds are now yours!`
          : 'You now have access to all 6 Smarty Pants apps!',
        [{ text: "Let's go!", onPress: handleClose }],
      );
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Failed', e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [selected, individualPkg, lifetimePkg, refresh, applyCustomerInfo, handleClose]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (info) {
        applyCustomerInfo(info);
      } else {
        await refresh();
      }
      Alert.alert('✅ Restored!', 'Your purchase has been restored — welcome back!');
      handleClose();
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message ?? 'Nothing to restore.');
    } finally {
      setRestoring(false);
    }
  }, [refresh, applyCustomerInfo, handleClose]);

  const selectedPrice = selected === 'individual' ? 'R100' : 'R500';

  const content = (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} className="px-6 pt-4 pb-2">
          <View className="flex-row items-center justify-between mb-4">
            <View />
            <TouchableOpacity onPress={handleClose} className="p-2 rounded-full bg-muted">
              <X size={20} className="text-muted-foreground" />
            </TouchableOpacity>
          </View>
          <Text className="text-4xl text-center mb-1">{APP_EMOJI}</Text>
          <Text className="text-2xl font-black text-[#e9d5ff] text-center font-nunito">
            Unlock {APP_NAME}
          </Text>
          <Text className="text-[#c4b5fd] text-center text-sm mt-1 font-nunito">
            Choose your plan · Pay once · Yours forever
          </Text>
        </Animated.View>

        {/* Plan options */}
        <Animated.View entering={FadeInDown.duration(500).delay(80)} className="px-6 mt-4 gap-3">

          {/* Individual option */}
          <TouchableOpacity
            onPress={() => setSelected('individual')}
            activeOpacity={0.85}
            className={`rounded-2xl p-4 border-2 ${selected === 'individual' ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1">
                <Text className="text-xl">{APP_EMOJI}</Text>
                <View className="flex-1">
                  <Text className={`font-bold text-sm font-nunito ${selected === 'individual' ? 'text-primary' : 'text-foreground'}`}>
                    {APP_NAME} Only
                  </Text>
                  <Text className="text-muted-foreground text-xs font-nunito">All 4 worlds in this app</Text>
                </View>
              </View>
              <View className="items-end ml-3">
                <Text className={`font-black text-lg font-nunito ${selected === 'individual' ? 'text-primary' : 'text-foreground'}`}>R100</Text>
                <Text className="text-muted-foreground text-[10px] font-nunito">one-time</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Lifetime / bundle option */}
          <TouchableOpacity
            onPress={() => setSelected('lifetime')}
            activeOpacity={0.85}
            className={`rounded-2xl p-4 border-2 ${selected === 'lifetime' ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-xl">🌟</Text>
                  <View className="flex-1">
                    <Text className={`font-bold text-sm font-nunito ${selected === 'lifetime' ? 'text-primary' : 'text-foreground'}`}>
                      All 6 Apps Bundle
                    </Text>
                    <Text className="text-muted-foreground text-xs font-nunito">Best value</Text>
                  </View>
                </View>
                <Text className="text-muted-foreground text-[11px] font-nunito leading-relaxed">
                  {BUNDLE_APPS.join(' · ')}
                </Text>
              </View>
              <View className="items-end ml-3">
                <Text className={`font-black text-lg font-nunito ${selected === 'lifetime' ? 'text-primary' : 'text-foreground'}`}>R500</Text>
                <Text className="text-muted-foreground text-[10px] font-nunito">one-time</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.duration(500).delay(160)} className="px-6 mt-5">
          <View className="bg-card rounded-2xl p-4 border border-border gap-2">
            {INDIVIDUAL_FEATURES.map((text) => (
              <View key={text} className="flex-row items-center gap-3">
                <View className="bg-primary/10 rounded-full p-1">
                  <Check size={12} className="text-primary" />
                </View>
                <Text className="text-foreground font-nunito text-sm">{text}</Text>
              </View>
            ))}
            {selected === 'lifetime' && (
              <View className="flex-row items-center gap-3">
                <View className="bg-primary/10 rounded-full p-1">
                  <Check size={12} className="text-primary" />
                </View>
                <Text className="text-foreground font-nunito text-sm">Access to all 6 Smarty Pants apps</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.duration(500).delay(240)} className="px-6 mt-5 gap-3">
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing || loadingOffers}
            activeOpacity={0.85}
            className="bg-primary py-4 rounded-2xl items-center justify-center flex-row gap-2"
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Zap size={18} className="text-white" />
                <Text className="text-white font-black text-base font-nunito">
                  Unlock Now — {selectedPrice}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} disabled={restoring} className="py-2 items-center">
            {restoring ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-[#c4b5fd] text-sm font-nunito">Restore purchase</Text>
            )}
          </TouchableOpacity>

          <Text className="text-[#c4b5fd]/70 text-xs text-center font-nunito leading-relaxed">
            One-time purchase. No subscription. No renewal.{'\n'}
            Price in South African Rand (ZAR).
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL(PLAY_STORE_URL)}
            className="flex-row items-center justify-center gap-2 mt-3"
            activeOpacity={0.7}
          >
            <Text className="text-xl">▶</Text>
            <Text className="text-[#c4b5fd]/80 text-xs font-nunito">Find us on Google Play</Text>
            <ExternalLink size={12} className="text-[#c4b5fd]/60" />
          </TouchableOpacity>

          <View className="flex-row justify-center gap-4 mt-2">
            <TouchableOpacity onPress={() => { onClose?.(); router.push('/privacy'); }}>
              <Text className="text-[#c4b5fd]/60 text-xs font-nunito underline">Privacy Policy</Text>
            </TouchableOpacity>
            <Text className="text-[#c4b5fd]/40 text-xs">·</Text>
            <TouchableOpacity onPress={() => { onClose?.(); router.push('/delete-account'); }}>
              <Text className="text-[#c4b5fd]/60 text-xs font-nunito underline">Delete Account</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );

  if (modal) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        {content}
      </Modal>
    );
  }

  return content;
}
