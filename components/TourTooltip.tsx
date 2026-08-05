/**
 * TourTooltip
 *
 * Custom tooltip component for react-native-copilot.
 * Uses useCopilot() to access navigation handlers and state — the library
 * only passes `labels` as a prop; everything else must come from the hook.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useCopilot } from 'react-native-copilot';
import type { TooltipProps } from 'react-native-copilot';

export function TourTooltip({ labels }: TooltipProps) {
  const { goToNext, goToPrev, stop, currentStep, isFirstStep, isLastStep } = useCopilot();

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-4">
      {/* Step text */}
      <Text className="text-foreground text-sm leading-relaxed">
        {currentStep?.text}
      </Text>

      {/* Button row */}
      <View className="flex-row items-center justify-between">
        {/* Skip — left side, muted */}
        <TouchableOpacity
          onPress={() => void stop()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-muted-foreground text-sm">
            {labels?.skip ?? 'Skip'}
          </Text>
        </TouchableOpacity>

        {/* Back + Next/Done — right side */}
        <View className="flex-row items-center gap-3">
          {!isFirstStep && (
            <TouchableOpacity
              onPress={() => void goToPrev()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-primary text-sm font-semibold">
                {labels?.previous ?? 'Back'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => isLastStep ? void stop() : void goToNext()}
            className="bg-primary px-4 py-1.5 rounded-full"
          >
            <Text className="text-primary-foreground text-sm font-bold">
              {isLastStep ? (labels?.finish ?? 'Done') : (labels?.next ?? 'Next')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
