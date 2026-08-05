import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { lightTheme } from '@/lib/theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <View style={[{ flex: 1 }, lightTheme]}>{children}</View>;
}
