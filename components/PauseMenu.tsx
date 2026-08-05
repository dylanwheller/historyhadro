// components/PauseMenu.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

type PauseMenuProps = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
};

export default function PauseMenu({ visible, onResume, onRestart, onExit }: PauseMenuProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onResume}
    >
      <View className="flex-1 bg-black/60 items-center justify-center px-8">
        <View className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border items-center">
          <Text className="text-2xl font-bold text-foreground mb-6">Paused</Text>

          <TouchableOpacity
            onPress={onResume}
            className="w-full bg-primary py-4 rounded-xl mb-3 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-primary-foreground font-bold text-lg">Resume</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onRestart}
            className="w-full bg-muted py-3 rounded-xl mb-3 border border-border items-center"
            activeOpacity={0.8}
          >
            <Text className="text-foreground font-bold">Restart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onExit}
            className="w-full py-3 rounded-xl border border-destructive/40 bg-destructive/5 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-destructive font-bold">Exit to World Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
