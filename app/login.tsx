import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import Constants from 'expo-constants';
import { useAuth } from '@/lib/AuthContext';
import { useUser } from '@/lib/UserContext';

const version =
  (Constants as any)?.expoConfig?.version ??
  (Constants as any)?.manifest?.version ??
  '1.0.0';

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, error, signInWithGoogle, signInWithEmail, signUpWithEmail, clearError } = useAuth();
  // Gate home navigation on isLoggedIn (set by UserContext only after the
  // Firestore profile fetch completes) so the home screen never renders with
  // default placeholder data.
  const { isLoggedIn, user } = useUser();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isLoggedIn) router.replace(user.onboardingComplete ? '/' : '/onboarding');
  }, [isLoggedIn, user.onboardingComplete]);

  const handleEmailSubmit = async () => {
    setLocalError('');
    clearError();
    if (!email.trim()) { setLocalError('Please enter your email.'); return; }
    if (!password) { setLocalError('Please enter your password.'); return; }
    if (mode === 'signup' && !displayName.trim()) { setLocalError('Please enter your name.'); return; }
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, displayName.trim());
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch {
      // error is already set in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError('');
    await signInWithGoogle();
  };

  const displayedError = localError || error;

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#261c00] items-center justify-center">
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#261c00]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* Header */}
        <View className="items-center mb-8">
          <Image
            source={require('../assets/dinos/splash-dino.png')}
            className="h-32 w-32 rounded-3xl mb-4"
            resizeMode="cover"
          />
          <Text className="text-3xl font-bold text-[#fef08a] text-center">
            {mode === 'signin' ? 'Welcome, Explorer!' : 'Create account'}
          </Text>
          <Text className="mt-2 text-sm text-[#eab308] text-center">
            {mode === 'signin'
              ? 'Sign in to continue your history adventure.'
              : 'Join HistoryHadro and explore the past.'}
          </Text>
        </View>

        {/* Form card */}
        <View className="rounded-2xl bg-[#332400] p-6 gap-3 shadow-lg">

          {/* Google sign-in */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={submitting}
            className="flex-row items-center justify-center gap-3 rounded-xl bg-[#3d2c00] border border-[#4d3a00] px-4 py-3"
          >
            <Text className="text-base font-semibold text-[#f0f9ff]">
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center gap-3 my-1">
            <View className="flex-1 h-px bg-[#4d3a00]" />
            <Text className="text-xs text-[#eab308]">or</Text>
            <View className="flex-1 h-px bg-[#4d3a00]" />
          </View>

          {/* Name field (sign-up only) */}
          {mode === 'signup' && (
            <TextInput
              value={displayName}
              onChangeText={(v) => { setDisplayName(v); setLocalError(''); }}
              placeholder="Your name"
              placeholderTextColor="#eab308"
              className="rounded-xl border border-[#4d3a00] bg-[#3d2c00] px-4 py-3 text-[#f0f9ff]"
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}

          {/* Email */}
          <TextInput
            value={email}
            onChangeText={(v) => { setEmail(v); setLocalError(''); clearError(); }}
            placeholder="Email address"
            placeholderTextColor="#eab308"
            className="rounded-xl border border-[#4d3a00] bg-[#3d2c00] px-4 py-3 text-[#f0f9ff]"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* Password */}
          <View className="flex-row items-center rounded-xl border border-[#4d3a00] bg-[#3d2c00]">
            <TextInput
              value={password}
              onChangeText={(v) => { setPassword(v); setLocalError(''); clearError(); }}
              placeholder="Password"
              placeholderTextColor="#eab308"
              className="flex-1 px-4 py-3 text-[#f0f9ff]"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleEmailSubmit}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              className="px-4 py-3"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showPassword
                ? <EyeOff size={18} color="#eab308" />
                : <Eye size={18} color="#eab308" />}
            </TouchableOpacity>
          </View>

          {/* Error */}
          {displayedError ? (
            <Text className="text-xs text-red-400">{displayedError}</Text>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleEmailSubmit}
            disabled={submitting}
            className="rounded-xl bg-[#eab308] px-4 py-3 items-center mt-1"
          >
            {submitting ? (
              <ActivityIndicator color="#f0f9ff" />
            ) : (
              <Text className="text-base font-semibold text-[#f0f9ff]">
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle mode */}
          <TouchableOpacity
            onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setLocalError(''); clearError(); }}
            className="items-center mt-1"
          >
            <Text className="text-sm text-[#eab308]">
              {mode === 'signin'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-center text-xs text-[#eab308]/60 mt-6">
          Version {version}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
