import React from 'react';
import { View, Text, TouchableOpacity, Image, Linking } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useSubscription } from '@/lib/SubscriptionContext';

type PromoApp = {
  name: string;
  tagline: string;
  icon: number;
  playStoreUrl: string;
};

const OTHER_APPS: PromoApp[] = [
  {
    name: 'AstroAllo',
    tagline: 'Explore the solar system',
    icon: require('@/assets/images/astroallo-icon.png'),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.smartypants.astroallo',
  },
  {
    name: 'MathRex',
    tagline: 'Math practice with a hungry dino',
    icon: require('@/assets/images/mathrex-icon.png'),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.smartypants.mathrex',
  },
  {
    name: 'ScienceSteggo',
    tagline: 'Science adventures with a dino',
    icon: require('@/assets/images/sciencesteggo-icon.png'),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.smartypants.sciencesteggo',
  },
  {
    name: 'GeoGiganto',
    tagline: 'Geography quests with a giant dino',
    icon: require('@/assets/images/geogiganto-icon.png'),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.smartypants.geogiganto',
  },
  {
    name: 'CompSciCarno',
    tagline: 'Computer science with a fearsome dino',
    icon: require('@/assets/images/compscicarno-icon.png'),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.smartypants.compscicarno',
  },
];

export default function CrossPromoSection() {
  const { isLifetime } = useSubscription();

  return (
    <View className="px-6 mb-6 gap-3">
      <View className="mb-1">
        <Text className="text-muted-foreground text-xs font-bold font-nunito uppercase tracking-widest">
          {isLifetime ? 'Already unlocked — try our other games!' : 'More from Smarty Pants'}
        </Text>
        {!isLifetime && (
          <Text className="text-muted-foreground text-xs font-nunito mt-1">
            One purchase unlocks all 6 apps
          </Text>
        )}
      </View>

      {OTHER_APPS.map((app) => (
        <TouchableOpacity
          key={app.name}
          onPress={() => Linking.openURL(app.playStoreUrl).catch(() => {})}
          className="bg-card rounded-xl p-4 border border-border flex-row items-center justify-between"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-3 flex-1">
            <Image
              source={app.icon}
              style={{ width: 40, height: 40, borderRadius: 12 }}
              resizeMode="cover"
            />
            <View className="flex-1">
              <Text className="text-foreground font-bold font-nunito text-sm">{app.name}</Text>
              <Text className="text-muted-foreground text-xs font-nunito">{app.tagline}</Text>
            </View>
          </View>
          {isLifetime ? (
            <Text className="text-primary text-xs font-bold font-nunito">✓ Included</Text>
          ) : (
            <ChevronRight size={16} color="#c4b5fd" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
