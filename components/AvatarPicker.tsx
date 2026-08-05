import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image } from 'react-native';
import { AVATARS } from '@/lib/avatars';

type AvatarPickerProps = {
  visible: boolean;
  currentId: number;
  onSelect: (id: number) => void;
  onClose: () => void;
};

export default function AvatarPicker({ visible, currentId, onSelect, onClose }: AvatarPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity
        className="flex-1 bg-black/60 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Sheet — stop propagation so tapping inside doesn't close */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-card rounded-t-3xl px-6 pt-5 pb-10 border-t border-border">
            <Text className="text-lg font-bold text-foreground text-center mb-5 font-nunito">
              Choose your avatar
            </Text>

            {/* 3×2 grid */}
            <View className="flex-row flex-wrap justify-center gap-4">
              {AVATARS.map((source, id) => {
                const selected = id === currentId;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => { onSelect(id); onClose(); }}
                    className="rounded-full overflow-hidden"
                    style={{
                      width: 80,
                      height: 80,
                      borderWidth: 2,
                      borderColor: selected ? '#3b82f6' : 'transparent',
                    }}
                  >
                    <Image
                      source={source}
                      style={{ width: 80, height: 80, borderRadius: 40 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
