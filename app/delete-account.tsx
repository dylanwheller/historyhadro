import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, AlertTriangle, Trash2 } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { deleteUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

cssInterop(AlertTriangle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2,        { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronLeft,   { className: { target: 'style', nativeStyleToProp: { color: true } } });

// Subcollections to purge before deleting the root user document
const USER_SUBCOLLECTIONS = [
  'achievements',
  'sessions',
  'dailyStats',
  'worldProgress',
  'claims',
];

/** Delete all documents in a subcollection using batched writes. */
async function purgeSubcollection(uid: string, subcollection: string) {
  const col = collection(db, 'historyhadro_users', uid, subcollection);
  const snap = await getDocs(col);
  if (snap.empty) return;

  // Firestore batch limit is 500 operations
  const chunks: typeof snap.docs[] = [];
  for (let i = 0; i < snap.docs.length; i += 500) {
    chunks.push(snap.docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Delete all known Firestore data for a user, then delete their Auth account. */
async function deleteAccount(uid: string): Promise<void> {
  // 1. Purge subcollections
  for (const sub of USER_SUBCOLLECTIONS) {
    await purgeSubcollection(uid, sub);
  }

  // 2. Delete root user document
  await deleteDoc(doc(db, 'historyhadro_users', uid));

  // 3. Delete Firebase Auth account
  //    This can fail with auth/requires-recent-login if the session is old.
  //    In that case the caller should prompt re-authentication.
  const currentUser = auth.currentUser;
  if (currentUser) {
    await deleteUser(currentUser);
  }
}

// What gets deleted — shown in the confirmation list
const DELETION_ITEMS = [
  'Your account and login credentials',
  'All game progress and world completions',
  'Achievements and earned XP',
  'Daily statistics and activity history',
  'Profile photo and display name',
  'Session history and saved games',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();

  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmation.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete || !authUser?.uid) return;

    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be deleted immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, delete everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(authUser.uid);
              // Auth listener in AuthContext will pick up the deletion and
              // redirect to the login screen automatically.
            } catch (e: any) {
              setDeleting(false);

              if (e?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication Required',
                  'For security, please sign out and sign back in before deleting your account.',
                  [{ text: 'OK' }],
                );
              } else {
                Alert.alert(
                  'Deletion Failed',
                  e?.message ?? 'Something went wrong. Please try again or contact support.',
                  [{ text: 'OK' }],
                );
              }
            }
          },
        },
      ],
    );
  };

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
            Delete Account
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Warning banner */}
          <View className="bg-red-500/20 border border-red-400/40 rounded-2xl p-4 flex-row gap-3 mb-6">
            <AlertTriangle size={22} color="#f87171" />
            <View className="flex-1">
              <Text className="text-red-300 font-black font-nunito mb-1">
                This action is permanent
              </Text>
              <Text className="text-red-300/80 text-sm font-nunito leading-relaxed">
                Deleting your account cannot be undone. All your data will be
                permanently removed and cannot be recovered.
              </Text>
            </View>
          </View>

          {/* What gets deleted */}
          <Text className="text-[#e9d5ff] font-black font-nunito text-base mb-3">
            The following will be permanently deleted:
          </Text>
          <View className="bg-card border border-border rounded-2xl p-4 mb-6 gap-2">
            {DELETION_ITEMS.map((item) => (
              <View key={item} className="flex-row items-start gap-2">
                <Text className="text-red-500 mt-0.5">✕</Text>
                <Text className="text-foreground text-sm font-nunito flex-1">{item}</Text>
              </View>
            ))}
          </View>

          {/* Note about purchases */}
          <View className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
            <Text className="text-[#c4b5fd]/80 text-sm font-nunito leading-relaxed">
              <Text className="font-bold text-[#e9d5ff]">Note: </Text>
              If you have purchased HistoryHadro Premium, deleting your account will not
              automatically issue a refund. Purchases made through Google Play are
              subject to Google Play's refund policy. Your purchase history is managed
              by Google Play, not by us.
            </Text>
          </View>

          {/* Confirmation input */}
          <Text className="text-[#e9d5ff] font-bold font-nunito mb-2">
            Type{' '}
            <Text className="text-red-400 font-black">DELETE</Text>
            {' '}to confirm
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Type DELETE here"
            placeholderTextColor="#7c3aed"
            autoCapitalize="characters"
            autoCorrect={false}
            className="border rounded-xl px-4 py-3 font-nunito text-base mb-6"
            style={{
              borderColor: canDelete ? '#f87171' : '#4c2d7a',
              backgroundColor: canDelete ? 'rgba(239,68,68,0.15)' : 'rgba(76,45,122,0.3)',
              color: canDelete ? '#fca5a5' : '#e9d5ff',
            }}
          />

          {/* Delete button */}
          <TouchableOpacity
            onPress={handleDelete}
            disabled={!canDelete || deleting}
            activeOpacity={0.85}
            className="rounded-2xl py-4 items-center justify-center flex-row gap-2 mb-4"
            style={{
              backgroundColor: canDelete ? '#ef4444' : '#1f2937',
            }}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Trash2 size={18} color={canDelete ? '#fff' : '#4b5563'} />
                <Text
                  className="font-black text-base font-nunito"
                  style={{ color: canDelete ? '#fff' : '#4b5563' }}
                >
                  Delete My Account
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} className="py-3 items-center">
            <Text className="text-[#c4b5fd]/70 font-nunito">Cancel — keep my account</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}
