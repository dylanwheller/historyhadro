import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

const LAST_UPDATED = '27 May 2025';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="mb-6">
    <Text className="text-[#e9d5ff] text-base font-black font-nunito mb-2">{title}</Text>
    {children}
  </View>
);

const Body = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-[#c4b5fd]/80 text-sm font-nunito leading-relaxed">{children}</Text>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <View className="flex-row mb-1">
    <Text className="text-[#c4b5fd] text-sm mr-2">•</Text>
    <Text className="text-[#c4b5fd]/80 text-sm font-nunito leading-relaxed flex-1">{children}</Text>
  </View>
);

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-background">

        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
            <ChevronLeft size={24} color="#c4b5fd" />
          </TouchableOpacity>
          <Text className="text-[#e9d5ff] text-lg font-black font-nunito flex-1">
            Privacy Policy
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-[#c4b5fd]/60 text-xs font-nunito mb-6">
            Last updated: {LAST_UPDATED}
          </Text>

          <Section title="1. Who We Are">
            <Body>
              HistoryHadro ("the App") is developed and operated by Smarty Pants
              ("we", "us", or "our"). We are committed to protecting the personal information
              of all our users, including children, in accordance with the Protection of
              Personal Information Act 4 of 2013 (POPIA) and other applicable privacy laws.
            </Body>
          </Section>

          <Section title="2. Information We Collect">
            <Body>When you create an account or use the App, we may collect:</Body>
            <View className="mt-2">
              <Bullet>Email address and display name (provided at registration)</Bullet>
              <Bullet>Profile photo (optional, chosen by you)</Bullet>
              <Bullet>Date of account creation and last login</Bullet>
              <Bullet>Game progress, level completions, and star ratings</Bullet>
              <Bullet>Achievement data and earned points (XP)</Bullet>
              <Bullet>Daily activity statistics (questions solved, time played)</Bullet>
              <Bullet>Age range selection (used to set appropriate difficulty)</Bullet>
              <Bullet>Purchase history (processed securely by RevenueCat/Google Play)</Bullet>
            </View>
          </Section>

          <Section title="3. How We Use Your Information">
            <Body>We use the information we collect to:</Body>
            <View className="mt-2">
              <Bullet>Provide, maintain, and improve the App experience</Bullet>
              <Bullet>Save and synchronise your game progress across devices</Bullet>
              <Bullet>Personalise difficulty levels based on your age range</Bullet>
              <Bullet>Track achievements and award experience points (XP)</Bullet>
              <Bullet>Process and verify premium purchases</Bullet>
              <Bullet>Send important account-related notifications (not marketing)</Bullet>
              <Bullet>Comply with legal obligations</Bullet>
            </View>
            <View className="mt-2">
              <Body>
                We do not sell, rent, or share your personal information with third parties
                for their own marketing purposes.
              </Body>
            </View>
          </Section>

          <Section title="4. Children's Privacy">
            <Body>
              HistoryHadro is designed for children and families. We take children's privacy
              seriously. We collect only the minimum information necessary to provide
              the service. We do not display behavioural advertising, we do not sell
              children's data, and we do not knowingly collect information from children
              under 13 without verifiable parental consent.
            </Body>
            <View className="mt-2">
              <Body>
                Parents or guardians who believe their child has provided personal
                information without consent should contact us immediately so we can
                delete that information.
              </Body>
            </View>
          </Section>

          <Section title="5. Data Storage and Security">
            <Body>
              Your data is stored securely using Google Firebase (Firestore and
              Firebase Authentication), hosted on Google Cloud servers. Google applies
              industry-standard security measures including encryption in transit (TLS)
              and at rest. Your data may be stored on servers located outside South Africa,
              including in the United States, consistent with Firebase's global
              infrastructure. We ensure appropriate safeguards are in place for any
              cross-border data transfers.
            </Body>
          </Section>

          <Section title="6. Third-Party Services">
            <Body>The App uses the following third-party services:</Body>
            <View className="mt-2">
              <Bullet>
                <Text className="font-bold text-[#e9d5ff]">Google Firebase</Text>
                {' — '}authentication, cloud database, and analytics. Privacy policy: firebase.google.com/support/privacy
              </Bullet>
              <Bullet>
                <Text className="font-bold text-[#e9d5ff]">RevenueCat</Text>
                {' — '}in-app purchase management. Privacy policy: revenuecat.com/privacy
              </Bullet>
              <Bullet>
                <Text className="font-bold text-[#e9d5ff]">Google Sign-In</Text>
                {' — '}optional social login. Privacy policy: policies.google.com/privacy
              </Bullet>
            </View>
          </Section>

          <Section title="7. Your Rights (POPIA)">
            <Body>
              Under the Protection of Personal Information Act (POPIA) and other applicable
              laws, you have the right to:
            </Body>
            <View className="mt-2">
              <Bullet>Access the personal information we hold about you</Bullet>
              <Bullet>Correct inaccurate or incomplete information</Bullet>
              <Bullet>Request deletion of your account and associated data</Bullet>
              <Bullet>Object to or restrict certain processing of your information</Bullet>
              <Bullet>Lodge a complaint with the Information Regulator of South Africa</Bullet>
            </View>
            <View className="mt-2">
              <Body>
                To exercise any of these rights, including requesting account deletion,
                please use the "Delete Account" option in the app or contact us directly.
              </Body>
            </View>
          </Section>

          <Section title="8. Data Retention">
            <Body>
              We retain your personal information for as long as your account is active
              or as needed to provide the service. If you delete your account, we will
              delete your personal data within 30 days, except where we are required by
              law to retain it longer.
            </Body>
          </Section>

          <Section title="9. Changes to This Policy">
            <Body>
              We may update this Privacy Policy from time to time. We will notify you
              of any significant changes by displaying a notice in the App. Your continued
              use of the App after changes are posted constitutes your acceptance of the
              updated policy.
            </Body>
          </Section>

          <Section title="10. Contact Us">
            <Body>
              If you have any questions, concerns, or requests regarding this Privacy
              Policy or your personal information, please contact us at:
            </Body>
            <View className="mt-3 bg-primary/10 border border-primary/20 rounded-xl p-4">
              <Text className="text-[#e9d5ff] font-bold font-nunito mb-1">Smarty Pants</Text>
              <Text className="text-[#c4b5fd]/80 text-sm font-nunito">
                Email: support@smartypants.biz
              </Text>
              <Text className="text-[#c4b5fd]/80 text-sm font-nunito">
                South Africa
              </Text>
            </View>
          </Section>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
